// BTSnoop Tab Module - Handles all BTSnoop log processing, rendering, and filtering
import * as XLSX from 'xlsx'; // Assuming global or bundler handles this, based on main.js

// --- State Variables ---
let btsnoopPackets = [];
let filteredBtsnoopPackets = [];
let btsnoopConnectionEvents = [];
let btsnoopConnectionMap = new Map();
let localBtAddress = '00:00:00:00:00:00';
let activeBtsnoopFilters = new Set(['cmd', 'evt', 'acl', 'l2cap', 'smp', 'att']);
let btsnoopCollapsedFiles = new Set();
let btsnoopRowPositions = new Float32Array(0);
let btsnoopTotalHeight = 0;
let btsnoopAnchorPacketNumber = null;
let selectedBtsnoopPacket = null;
let currentBtsnoopGridTemplate = null;
let isProgrammaticBtsnoopScroll = false;
let isBtsnoopProcessed = false;
let btsnoopScrollListenerAttached = false;

// DOM Elements Cache
let btsnoopLogContainer = null;
let btsnoopLogSizer = null;
let btsnoopLogViewport = null;
let btsnoopRowPool = [];

// Sort & Filter State
let btsnoopSortColumn = null; // 0-based index
let btsnoopSortOrder = 'asc';
let btsnoopColumnFilters = [];
let btsnoopColumnFilterDebounceTimer = null;

const BTSNOOP_STORE_NAME = 'btsnoopStore';
const BOOKMARK_STORE_NAME = 'bookmarkStore'; // Assuming this might be needed, or we pass deps
const BUFFER_LINES = 50;

// --- Public API ---

export function getIsBtsnoopProcessed() {
    return isBtsnoopProcessed;
}

export function setIsBtsnoopProcessed(value) {
    isBtsnoopProcessed = value;
}

export function getBtsnoopPackets() {
    return btsnoopPackets;
}

export function getBtsnoopConnectionMap() {
    return btsnoopConnectionMap;
}

export function getBtsnoopConnectionEvents() {
    return btsnoopConnectionEvents;
}

export function getSelectedBtsnoopPacket() {
    return selectedBtsnoopPacket;
}

export function setSelectedBtsnoopPacket(packet) {
    selectedBtsnoopPacket = packet;
}

/**
 * Setup the BTSnoop tab - attaches listeners and prepares the view.
 * @param {Object} deps - Dependencies { db, saveData, loadData, TimeTracker }
 */
export async function setupBtsnoopTab(deps) {
    console.log('[BTSnoop Debug] 1. setupBtsnoopTab called.');
    btsnoopLogContainer = document.getElementById('btsnoopLogContainer');
    btsnoopLogSizer = document.getElementById('btsnoopLogSizer');
    btsnoopLogViewport = document.getElementById('btsnoopLogViewport');

    if (!btsnoopScrollListenerAttached && btsnoopLogContainer instanceof HTMLElement) {
        // FIX: Attach the correct virtual scroll listener.
        btsnoopLogContainer.addEventListener('scroll', () => {
            // Clear the anchor when user manually scrolls
            if (!window.btsnoopScrollFrame) {
                window.btsnoopScrollFrame = requestAnimationFrame(() => {
                    renderBtsnoopVirtualLogs();
                    window.btsnoopScrollFrame = null;

                    // Sync horizontal scroll
                    const header = document.getElementById('btsnoopHeader');
                    if (header && header.firstChild) {
                        header.scrollLeft = btsnoopLogContainer.scrollLeft;
                    }

                    // Clear anchor after manual scroll (debounced)
                    if (!isProgrammaticBtsnoopScroll) {
                        clearTimeout(window.btsnoopAnchorClearTimer);
                        window.btsnoopAnchorClearTimer = setTimeout(() => {
                            btsnoopAnchorPacketNumber = null;
                        }, 100);
                    }
                });
            }
        });

        // Handle clicks for selection and copy
        btsnoopLogContainer.addEventListener('click', handleBtsnoopClick);

        btsnoopScrollListenerAttached = true;
    }

    console.log('[BTSnoop Debug] 2. Attaching btsnoop filters and calling render.');
    createBtsnoopFilterHeader();
    attachBtsnoopFilterListeners();
    attachHeaderButtonListeners();

    // Render potentially cached or existing data
    await renderBtsnoopPackets(deps);
}

/**
 * Process BTSnoop files using a web worker.
 * @param {Array} fileTasks - List of file tasks
 * @param {Object} deps - Dependencies { db, getDb, saveData, loadData, TimeTracker, btsnoopInitialView, btsnoopContentView, btsnoopFilterContainer }
 */
export async function processForBtsnoop(fileTasks, { db, getDb, saveData, loadData, TimeTracker, btsnoopInitialView, btsnoopContentView, btsnoopFilterContainer }) {
    console.log('[BTSnoop Debug] processForBtsnoop called');
    return new Promise(async (resolve, reject) => {
        const exportXlsxBtn = document.getElementById('exportBtsnoopXlsxBtn');

        const database = getDb ? getDb() : db;

        // FIX: Ensure the database is open before proceeding.
        if (!database) {
            console.error('[BTSnoop Debug] DB not open');
            return reject('DB not open');
        }

        if (!btsnoopInitialView || !btsnoopContentView || !btsnoopFilterContainer) {
            console.error('[BTSnoop Debug] UI elements missing', { btsnoopInitialView, btsnoopContentView, btsnoopFilterContainer });
            return reject('BTSnoop UI elements not found');
        }

        // Check if worker code has changed    // Versioning for worker cache invalidation
        const btsnoopWorkerVersion = '2025-12-07-21:50'; // Updated for Address Resolution & UTC Fix
        const storedVersion = localStorage.getItem('btsnoopWorkerVersion');
        if (storedVersion !== btsnoopWorkerVersion) {
            console.log('[BTSnoop] Worker code changed (v' + btsnoopWorkerVersion + '), clearing ALL cache...');
            // Clear IndexedDB btsnoopStore
            if (database) {
                const tx = database.transaction([BTSNOOP_STORE_NAME], 'readwrite');
                await tx.objectStore(BTSNOOP_STORE_NAME).clear();
                await new Promise((resolve, reject) => {
                    tx.oncomplete = resolve;
                    tx.onerror = reject;
                });
            }
            await saveData('btsnoopPackets', null);
            btsnoopPackets = [];
            btsnoopConnectionEvents = [];
            isBtsnoopProcessed = false;
            localStorage.setItem('btsnoopWorkerVersion', btsnoopWorkerVersion);
        }

        TimeTracker.start('BTSnoop Processing');
        const tasks = fileTasks.filter(task => /btsnoop_hci\.log.*/.test(task.path));

        if (tasks.length === 0) {
            btsnoopInitialView.innerHTML = '<p>No btsnoop_hci.log files found.</p>';
            TimeTracker.stop('BTSnoop Processing');
            isBtsnoopProcessed = true;
            return resolve();
        }

        // Reset state
        btsnoopConnectionEvents = [];
        btsnoopPackets = [];
        btsnoopInitialView.innerHTML = `<p>Found ${tasks.length} file(s). Parsing...</p><div id="btsnoop-progress"></div>`;
        const progressDiv = document.getElementById('btsnoop-progress');

        try {
            const bufferPromises = tasks.map(task => (task.file || task.blob).arrayBuffer());
            const fileBuffers = await Promise.all(bufferPromises);
            const fileNames = tasks.map(task => {
                if (task.path) return task.path;
                if (task.file && task.file.webkitRelativePath) return task.file.webkitRelativePath;
                return task.file ? task.file.name : 'unknown.log';
            });

            const workerScript = getBtsnoopWorkerScript();
            const blob = new Blob([workerScript], { type: 'application/javascript' });
            const workerURL = URL.createObjectURL(blob);
            const worker = new Worker(workerURL);
            let totalPacketsStored = 0;
            let storedHighlights = null; // Local highlights cache if needed

            worker.onmessage = async (event) => {
                const { type, packets, message, stack, connectionMap } = event.data;

                if (type === 'chunk') {
                    for (const packet of packets) {
                        btsnoopPackets.push(packet);
                    }
                    totalPacketsStored += packets.length;
                    progressDiv.textContent = `Parsed ${totalPacketsStored.toLocaleString()} packets...`;
                } else if (type === 'connectionEvent') {
                    btsnoopConnectionEvents.push(event.data.event);
                } else if (type === 'localAddressFound') {
                    localBtAddress = event.data.address;
                    // Note: We might need to expose this boostrap info back or use it locally
                } else if (type === 'complete') {
                    btsnoopConnectionMap = new Map(Object.entries(connectionMap));
                    progressDiv.textContent = `Parsed ${totalPacketsStored.toLocaleString()} packets. Finalizing...`;

                    await resolveBtsnoopHandles(btsnoopConnectionMap);

                    progressDiv.textContent = `Saving...`;
                    await saveData('btsnoopPackets', btsnoopPackets);

                    // UI Updates
                    const btsnoopToolbar = document.getElementById('btsnoopToolbar');
                    btsnoopContentView.style.display = 'flex';
                    btsnoopFilterContainer.style.display = 'block';
                    btsnoopInitialView.style.display = 'none';
                    if (btsnoopToolbar) btsnoopToolbar.style.display = 'block';

                    TimeTracker.stop('BTSnoop Processing');
                    isBtsnoopProcessed = true;

                    renderBtsnoopConnectionEvents();
                    // Initial render call - deps is in parent scope from processForBtsnoop
                    await setupBtsnoopTab({ db: database, getDb, saveData, loadData, TimeTracker, btsnoopInitialView, btsnoopContentView, btsnoopFilterContainer });

                    worker.terminate();
                    URL.revokeObjectURL(workerURL);

                    // Resolve with a flag indicating completion
                    resolve({ needsHighlightsUpdate: true });
                } else if (type === 'error') {
                    reject(new Error(`BTSnoop Worker Error: ${message}\n${stack}`));
                }
            };

            worker.onerror = (err) => {
                console.error(err);
                URL.revokeObjectURL(workerURL);
                TimeTracker.stop('BTSnoop Processing');
                reject(err);
            };

            worker.postMessage({ fileBuffers, fileNames, localBtAddress }, fileBuffers);

        } catch (error) {
            console.error('Error processing btsnoop:', error);
            btsnoopInitialView.innerHTML = `<p>Error: ${error.message}</p>`;
            TimeTracker.stop('BTSnoop Processing');
            reject(error);
        }
    });
}

// --- Internal Helper Functions ---

function getBtsnoopWorkerScript() {
    return `
    const HCI_COMMANDS = { 0x200C: 'LE Set Scan Enable', 0x200B: 'LE Set Scan Parameters', 0x2006: 'LE Set Advertising Parameters', 0x200A: 'LE Set Advertising Enable', 0x200D: 'LE Create Connection' };
    const HCI_EVENTS = { 0x05: 'Disconnect Complete', 0x0E: 'Command Complete', 0x0F: 'Command Status', 0x3E: 'LE Meta Event' };
    const LE_META_EVENTS = { 0x01: 'LE Connection Complete', 0x02: 'LE Advertising Report', 0x0A: 'LE Enhanced Connection Complete', 0x0B: 'LE Connection Update Complete' };
    const L2CAP_CIDS = { 0x0004: 'ATT', 0x0005: 'LE Signaling', 0x0006: 'SMP' };
    const ATT_OPCODES = { 0x01: 'Error Rsp', 0x02: 'Exchange MTU Req', 0x03: 'Exchange MTU Rsp', 0x04: 'Find Info Req', 0x05: 'Find Info Rsp', 0x08: 'Read By Type Req', 0x09: 'Read By Type Rsp', 0x0A: 'Read Req', 0x0B: 'Read Rsp', 0x0C: 'Read Blob Req', 0x0D: 'Read Blob Rsp', 0x10: 'Read By Group Type Req', 0x11: 'Read By Group Type Rsp', 0x12: 'Write Req', 0x13: 'Write Rsp', 0x52: 'Write Cmd', 0x1B: 'Notification', 0x1D: 'Indication', 0x1E: 'Confirmation' };
    const SMP_CODES = { 0x01: 'Pairing Req', 0x02: 'Pairing Rsp', 0x03: 'Pairing Confirm', 0x04: 'Pairing Random', 0x05: 'Pairing Failed', 0x06: 'Encryption Info (LTK)', 0x07: 'Master Identification', 0x08: 'Identity Info (IRK)' };
    const DISCONNECT_REASONS = {
        0x00: 'Success',
        0x01: 'Unknown HCI Command',
        0x02: 'Unknown Connection Identifier',
        0x03: 'Hardware Failure',
        0x04: 'Page Timeout',
        0x05: 'Authentication Failure',
        0x06: 'PIN or Key Missing',
        0x07: 'Memory Capacity Exceeded',
        0x08: 'Connection Timeout',
        0x09: 'Connection Limit Exceeded',
        0x0A: 'Synchronous Connection Limit Exceeded',
        0x0B: 'Connection Already Exists',
        0x0C: 'Command Disallowed',
        0x0D: 'Connection Rejected (Limited Resources)',
        0x0E: 'Connection Rejected (Security)',
        0x0F: 'Connection Rejected (Unacceptable BD_ADDR)',
        0x10: 'Connection Accept Timeout',
        0x11: 'Unsupported Feature or Parameter',
        0x12: 'Invalid HCI Command Parameters',
        0x13: 'Remote User Terminated Connection',
        0x14: 'Remote Device Terminated (Low Resources)',
        0x15: 'Remote Device Terminated (Power Off)',
        0x16: 'Connection Terminated by Local Host',
        0x17: 'Repeated Attempts',
        0x18: 'Pairing Not Allowed',
        0x19: 'Unknown LMP PDU',
        0x1A: 'Unsupported Remote/LMP Feature',
        0x1B: 'SCO Offset Rejected',
        0x1C: 'SCO Interval Rejected',
        0x1D: 'SCO Air Mode Rejected',
        0x1E: 'Invalid LMP/LL Parameters',
        0x1F: 'Unspecified Error',
        0x20: 'Unsupported LMP/LL Parameter',
        0x21: 'Role Change Not Allowed',
        0x22: 'LMP/LL Response Timeout',
        0x23: 'LMP/LL Error Transaction Collision',
        0x24: 'LMP PDU Not Allowed',
        0x25: 'Encryption Mode Not Acceptable',
        0x26: 'Link Key Cannot Be Changed',
        0x27: 'Requested QoS Not Supported',
        0x28: 'Instant Passed',
        0x29: 'Pairing with Unit Key Not Supported',
        0x2A: 'Different Transaction Collision',
        0x2E: 'QoS Unacceptable Parameter',
        0x2F: 'QoS Rejected',
        0x30: 'Channel Assessment Not Supported',
        0x31: 'Insufficient Security',
        0x32: 'Parameter Out of Mandatory Range',
        0x34: 'Role Switch Pending',
        0x36: 'Reserved Slot Violation',
        0x37: 'Role Switch Failed',
        0x38: 'Extended Inquiry Response Too Large',
        0x39: 'Secure Simple Pairing Not Supported',
        0x3A: 'Host Busy - Pairing',
        0x3B: 'Connection Rejected (No Suitable Channel)',
        0x3C: 'Controller Busy',
        0x3D: 'Unacceptable Connection Parameters',
        0x3E: 'Advertising Timeout',
        0x3F: 'Connection Terminated (MIC Failure)',
        0x40: 'Connection Failed to be Established',
        0x41: 'MAC Connection Failed',
        0x42: 'Coarse Clock Adjustment Rejected'
    };

    self.onmessage = async (event) => {
        let { fileBuffers, fileNames, localBtAddress } = event.data;
        if (!fileBuffers || fileBuffers.length === 0) {
            self.postMessage({ type: 'error', message: 'No file buffers received.' });
            return;
        }

        try {
            let packetNumber = 1;
            const BTSNOOP_EPOCH_DELTA = 0x00dcddb30f2f8000n;
            const connectionMap = new Map();
            const CHUNK_SIZE = 1000;
            const packets = [];

            for (let fIndex = 0; fIndex < fileBuffers.length; fIndex++) {
                const buffer = fileBuffers[fIndex];
                const currentFileName = fileNames ? fileNames[fIndex] : '';
                const dataView = new DataView(buffer);
                const magic = new TextDecoder().decode(buffer.slice(0, 8));
                if (magic !== 'btsnoop\\0') continue;

                packets.push({ type: 'META', fileName: currentFileName, number: 0, timestamp: '', source: '', destination: '', summary: 'File: ' + currentFileName, data: '' });

                let offset = 16;
                while (offset < buffer.byteLength) {
                    if (offset + 24 > buffer.byteLength) break;
                    const includedLength = dataView.getUint32(offset + 4, false);
                    const flags = dataView.getUint32(offset + 8, false);
                    const timestampMicro = dataView.getBigUint64(offset + 16, false);
                    const timestampMs = Number(timestampMicro - BTSNOOP_EPOCH_DELTA) / 1000;
                    const date = new Date(timestampMs);
                    const timestampStr = \`\${(date.getUTCMonth()+1).toString().padStart(2, '0')}-\${date.getUTCDate().toString().padStart(2, '0')} \${date.getUTCHours().toString().padStart(2, '0')}:\${date.getUTCMinutes().toString().padStart(2, '0')}:\${date.getUTCSeconds().toString().padStart(2, '0')}.\${date.getUTCMilliseconds().toString().padStart(3, '0')}\`;

                    offset += 24;
                    if (offset + includedLength > buffer.byteLength) break;

                    const packetData = new Uint8Array(buffer, offset, includedLength);
                    const direction = (flags & 1) === 0 ? 'Host -> Controller' : 'Controller -> Host';
                    
                    // Simplified interpretation call (assume standard helper exists or inline it)
                    // In a real refactor we should bundle this properly. For now we stringify the logic.
                    // For the sake of this tool step, I'm omitting the full interpretHciPacket function body recursion 
                    // to save space, but it essentially matches the one in main.js.
                    // ... interpretHciPacket logic would go here ... 
                    
                     const interpretation = interpretHciPacket(packetData, connectionMap, packetNumber, direction, timestampStr, localBtAddress);
                     if (interpretation.foundLocalAddress) {
                         localBtAddress = interpretation.foundLocalAddress;
                         self.postMessage({ type: 'localAddressFound', address: localBtAddress });
                     }
                     
                     packets.push({ ...interpretation, number: packetNumber, timestamp: timestampStr, fileName: currentFileName, direction });
                     packetNumber++;

                     if (packets.length >= CHUNK_SIZE) {
                         self.postMessage({ type: 'chunk', packets: packets.splice(0, packets.length) });
                         await new Promise(r => setTimeout(r, 0));
                     }
                     offset += includedLength;
                }
            }
            
            if (packets.length > 0) self.postMessage({ type: 'chunk', packets: packets });
            self.postMessage({ type: 'complete', connectionMap: Object.fromEntries(connectionMap) });

        } catch (e) {
            self.postMessage({ type: 'error', message: e.message, stack: e.stack });
        }
    };
    
    // Helper function duplication for worker scope
    function interpretHciPacket(data, connectionMap, packetNumber, direction, timestampStr, localBtAddress) {
        if (data.length === 0) return { type: 'Empty', summary: 'Empty Packet', tags: [], data: '' };
        const packetType = data[0];
        const tags = [];
        const hexData = Array.from(data, byte => byte.toString(16).padStart(2, '0')).join(' ');
        let source, destination;

        switch (packetType) {
            case 1: // HCI Command - ALWAYS Host -> Controller
                tags.push('cmd');
                source = 'Host';
                destination = 'Controller';
                if (data.length < 4) return { type: 'HCI Cmd', summary: 'Malformed', tags, source, destination, data: hexData };
                const ocf = data[1] | ((data[2] & 0x03) << 8);
                const ogf = (data[2] >> 2) & 0x3F;
                const opcode = (ogf << 10) | ocf;
                const paramLength = data[3];
                
                // HCI LTK Extraction from LE Start Encryption (0x2019) and LE LTK Request Reply (0x201A)
                if ((opcode === 0x2019 && data.length >= 32) || (opcode === 0x201A && data.length >= 22)) {
                    const hciHandle = data[4] | (data[5] << 8);
                    let ltkBytes;
                    if (opcode === 0x2019) ltkBytes = data.slice(16, 32);
                    else ltkBytes = data.slice(6, 22);
                    const ltk = Array.from(ltkBytes).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
                    const connInfo = connectionMap.get(hciHandle);
                    const peerAddr = connInfo ? connInfo.address : '';
                    self.postMessage({ type: 'connectionEvent', event: { packetNum: packetNumber, handle: hciHandle, keyType: 'LTK', keyValue: ltk, timestamp: timestampStr, peerAddress: peerAddr, data: hexData } });
                }
                
                const opName = HCI_COMMANDS[opcode] || \`Unknown OpCode: 0x\${opcode.toString(16).padStart(4, '0')}\`;
                return { type: 'HCI Cmd', summary: \`\${opName}, Len: \${paramLength}\`, tags, source, destination, data: hexData };
            case 2: // ACL Data - Direction from flags, use connection map for address
                tags.push('acl');
                if (data.length < 5) return { type: 'ACL Data', summary: 'Malformed', tags, source: 'Host', destination: 'Controller', data: hexData };
                const handle = ((data[2] & 0x0F) << 8) | data[1];
                const dataLength = (data[4] << 8) | data[3];
                const connInfo = connectionMap.get(handle);
                const remoteAddr = connInfo ? connInfo.address : \`Handle 0x\${handle.toString(16)}\`;
                // Direction determines who is source and who is destination
                if (direction === 'Host -> Controller') {
                    source = localBtAddress;
                    destination = remoteAddr;
                } else {
                    source = remoteAddr;
                    destination = localBtAddress;
                }
                let aclSummary = \`Len: \${dataLength}\`;
                if (data.length >= 9) {
                    tags.push('l2cap');
                    const l2capLength = (data[6] << 8) | data[5];
                    const cid = (data[8] << 8) | data[7];
                    aclSummary += \`, L2CAP Len: \${l2capLength}, CID: \${L2CAP_CIDS[cid] || '0x' + cid.toString(16)}\`;
                    if (cid === 4 && data.length >= 10) {
                        tags.push('att');
                        const attOpcode = data[9];
                        aclSummary += \` > ATT: \${ATT_OPCODES[attOpcode] || 'Op ' + attOpcode.toString(16)}\`;
                    }
                    else if (cid === 6 && data.length >= 10) {
                        tags.push('smp');
                        const smpCode = data[9];
                        aclSummary += \` > SMP: \${SMP_CODES[smpCode] || 'Code ' + smpCode.toString(16)}\`;
                        
                        // Extract IRK and LTK keys from SMP packets
                        if (smpCode === 0x06 && data.length >= 26) { // Encryption Info (LTK) - 16 bytes
                            const ltk = Array.from(data.slice(10, 26)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
                            aclSummary += ' [LTK Found]';
                            // FIX: Use source address to identify who sent the key (Owner)
                            const peerAddr = source;
                            self.postMessage({ type: 'connectionEvent', event: { packetNum: packetNumber, handle, keyType: 'LTK', keyValue: ltk, timestamp: timestampStr, peerAddress: peerAddr, data: hexData } });
                        }
                        else if (smpCode === 0x08 && data.length >= 26) { // Identity Info (IRK) - 16 bytes
                            const irk = Array.from(data.slice(10, 26)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
                            // FIX: Use source address to identify who sent the key (Owner)
                            const peerAddr = source;
                            self.postMessage({ type: 'connectionEvent', event: { packetNum: packetNumber, handle, keyType: 'IRK', keyValue: irk, timestamp: timestampStr, peerAddress: peerAddr, data: hexData } });
                            aclSummary += \` [IRK Found]\`;
                        }
                    }
                }
                return { type: 'ACL Data', summary: aclSummary, tags, source, destination, data: hexData, handle };
            case 4: // HCI Event - ALWAYS Controller -> Host (destination is localBtAddress)
                tags.push('evt');
                source = 'Controller';
                destination = localBtAddress;
                if (data.length < 3) return { type: 'HCI Evt', summary: 'Malformed', tags, source, destination, data: hexData};
                const eventCode = data[1];
                const eventLength = data[2];
                let summary = \`\${HCI_EVENTS[eventCode] || 'Unknown Event'}, Len: \${eventLength}\`;
                let foundLocalAddress = null;

                if (eventCode === 0x05 && data.length >= 7) { // Disconnect Complete - need 7 bytes minimum
                    // Disconnect Complete: Status(3) Handle(4-5) Reason(6)
                    const status = data[3];
                    const disconnectHandle = (data[5] << 8) | data[4]; // Little endian
                    const reason = data[6];
                    const connInfo = connectionMap.get(disconnectHandle);
                    const peerAddress = connInfo ? connInfo.address : 'Unknown';
                    const reasonText = DISCONNECT_REASONS[reason] || 'Unknown Reason (0x' + reason.toString(16).padStart(2, '0') + ')';
                    const statusText = status === 0x00 ? 'Success (0x00)' : 'Error 0x' + status.toString(16).padStart(2, '0');
                    summary += ' (Handle: 0x' + disconnectHandle.toString(16) + ', Reason: 0x' + reason.toString(16) + ')';
                    // Send disconnect event with descriptive reason
                    const parameters = 'Status: ' + statusText + ' | Reason: ' + reasonText + ' | Handle: 0x' + disconnectHandle.toString(16).padStart(4, '0');
                    self.postMessage({ type: 'connectionEvent', event: { packetNum: packetNumber, timestamp: timestampStr, eventType: 'disconnect', handle: '0x' + disconnectHandle.toString(16).padStart(4, '0') + ' ', address: peerAddress, parameters: parameters, rawData: hexData } });
                    // Remove from connection map
                    connectionMap.delete(disconnectHandle);
                }
                else if (eventCode === 0x0E && data.length >= 7) {
                    const cmdOpcode = (data[5] << 8) | data[4];
                    summary += \` (for \${HCI_COMMANDS[cmdOpcode] || '0x' + cmdOpcode.toString(16)})\`;
                    
                    // FIX: Detect Read BD_ADDR Complete
                    if (cmdOpcode === 0x1009 && data.length >= 13) { // 6 header + 1 status + 6 addr = 13 bytes
                        const status = data[6];
                        if (status === 0x00) {
                            const addrSlice = data.slice(7, 13);
                            foundLocalAddress = Array.from(addrSlice).reverse().map(b => b.toString(16).padStart(2, '0')).join(':').toUpperCase();
                            summary += \` [Read BD_ADDR: \${foundLocalAddress}]\`;
                            destination = foundLocalAddress; // Self-correct destination for this packet
                        }
                    }
                }
                else if (eventCode === 0x3E && data.length >= 4) {
                    const subEventCode = data[3];
                    summary += \` > \${LE_META_EVENTS[subEventCode] || 'Unknown Sub-event'}\`;
                    const isEnhanced = subEventCode === 0x0A;
                    const isLegacy = subEventCode === 0x01;
                    if ((isLegacy || isEnhanced) && data.length >= 15) {
                        const status = data[4];
                        const connectionHandle = (data[6] << 8) | data[5];
                        const role = data[7]; // 0x00 = Master, 0x01 = Slave
                        const peerAddrType = data[8]; // 0x00 = Public, 0x01 = Random
                        const peerAddressSlice = isEnhanced ? data.slice(10, 16) : data.slice(9, 15);
                        const peerAddress = Array.from(peerAddressSlice).reverse().map(b => b.toString(16).padStart(2, '0')).join(':').toUpperCase();
                        
                        // Extract RPA addresses for Enhanced events
                        let localRpaAddress = '';
                        let peerRpaAddress = '';
                        if (isEnhanced && data.length >= 27) {
                            const localRpaSlice = data.slice(15, 21);
                            const peerRpaSlice = data.slice(21, 27);
                            localRpaAddress = Array.from(localRpaSlice).reverse().map(b => b.toString(16).padStart(2, '0')).join(':').toUpperCase();
                            peerRpaAddress = Array.from(peerRpaSlice).reverse().map(b => b.toString(16).padStart(2, '0')).join(':').toUpperCase();
                        }
                        
                        // Extract connection parameters with correct byte offsets per Bluetooth HCI spec
                        // Legacy LE Connection Complete (0x01): Parameters start after 6-byte peer address at byte 9
                        // Enhanced LE Connection Complete (0x0A): Has extra resolvable addresses, parameters start later
                        let connInterval = 0, connLatency = 0, supervisionTimeout = 0, masterClockAccuracy = 0;
                        if (isLegacy && data.length >= 21) {
                            // Legacy: Status(4) Handle(5-6) Role(7) AddrType(8) Addr(9-14) Interval(15-16) Latency(17-18) Timeout(19-20) ClockAcc(21)
                            connInterval = (data[16] << 8) | data[15];
                            connLatency = (data[18] << 8) | data[17];
                            supervisionTimeout = (data[20] << 8) | data[19];
                            if (data.length >= 22) masterClockAccuracy = data[21];
                        } else if (isEnhanced && data.length >= 31) {
                            // Enhanced: After Status(4) Handle(5-6) Role(7) AddrType(8) Addr(9-14) Local_RPA(15-20) Peer_RPA(21-26) Interval(27-28) Latency(29-30) Timeout(31-32) ClockAcc(33)
                            connInterval = (data[28] << 8) | data[27];
                            connLatency = (data[30] << 8) | data[29];
                            supervisionTimeout = (data[32] << 8) | data[31];
                            if (data.length >= 34) masterClockAccuracy = data[33];
                        }

                        
                        // Build detailed parameter string in CCC format
                        const statusText = status === 0x00 ? 'Success (connection established)' : 'Error 0x' + status.toString(16).padStart(2, '0');
                        const roleText = role === 0x00 ? 'Master (0x00)' : 'Slave/Peripheral (0x01)';
                        const addrTypeText = peerAddrType === 0x00 ? 'Public Device Address (0x00)' : 'Random Device Address (0x01)';
                        const intervalMs = (connInterval * 1.25).toFixed(2);
                        const timeoutMs = supervisionTimeout * 10;
                        const clockAccText = role === 0x00 ? 'Not applicable for Master' : '0x' + masterClockAccuracy.toString(16).padStart(2, '0');
                        
                        let parameters = 'Status: ' + statusText + ' | Handle: 0x' + connectionHandle.toString(16).padStart(4, '0') + ' | Role: ' + roleText + ' | Peer Addr Type: ' + addrTypeText;
                        
                        // Add RPA addresses for Enhanced events
                        if (isEnhanced && localRpaAddress && peerRpaAddress) {
                            parameters += ' | Local RPA: ' + localRpaAddress + ' | Peer RPA: ' + peerRpaAddress;
                        }
                        
                        parameters += ' | Interval: ' + intervalMs + 'ms (0x' + connInterval.toString(16).padStart(4, '0') + ' × 1.25ms) | Latency: ' + connLatency + ' | Timeout: ' + timeoutMs + 'ms (0x' + supervisionTimeout.toString(16).padStart(4, '0') + ' × 10ms) | Clock: ' + clockAccText;
                        
                        if (connectionHandle) { connectionMap.set(connectionHandle, { address: peerAddress, packetNum: packetNumber }); }
                        // Destination is always the host for an event. The peer is the remote device.
                        summary += \` (Handle: 0x\${connectionHandle.toString(16)}, Peer: \${peerAddress})\`;
                        // Send connection event with timestamp and detailed parameters
                        self.postMessage({ type: 'connectionEvent', event: { packetNum: packetNumber, timestamp: timestampStr, eventType: 'connect', handle: \`0x\${connectionHandle.toString(16).padStart(4, '0')}\`, address: peerAddress, parameters: parameters, rawData: hexData } });
                    }
                }
                return { type: 'HCI Evt', summary, tags, source, destination, data: hexData, foundLocalAddress };
            default:
                source = 'Unknown';
                destination = 'Unknown';
                return { type: \`Unknown (0x\${packetType.toString(16)})\`, summary: 'Unknown packet type', tags, source, destination, data: hexData };
        }
    }
    `;
}

async function resolveBtsnoopHandles(connectionMap) {
    console.log('[Perf] Resolving handles...');
    // Iterating btsnoopPackets to fill in addresses based on connectionMap
    // ... logic from main.js ...
    for (let i = 0; i < btsnoopPackets.length; i++) {
        const packet = btsnoopPackets[i];
        if (packet.handle !== undefined && connectionMap.has(packet.handle)) {
            const connInfo = connectionMap.get(packet.handle);
            // Update source/destination if they are just Handles
            if (String(packet.source).startsWith('Handle')) packet.source = connInfo.address;
            if (String(packet.destination).startsWith('Handle')) packet.destination = connInfo.address;
        }
        if (i % 20000 === 0 && i > 0) await new Promise(r => setTimeout(r, 0));
    }
}

function renderBtsnoopConnectionEvents() {
    const tbody = document.getElementById('btsnoopConnectionEventsTable')?.querySelector('tbody');
    if (!tbody) return;
    const connectionEventsOnly = btsnoopConnectionEvents.filter(e => !e.keyType);
    if (connectionEventsOnly.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">No connection events found.</td></tr>';
    } else {
        tbody.innerHTML = connectionEventsOnly.map(event => {
            // Format parameters with CCC-style badges (matching CCC decode format)
            let formattedParams = '';
            if (event.parameters) {
                const params = event.parameters.split(' | ');
                formattedParams = params.map(param => {
                    const [label, ...valueParts] = param.split(': ');
                    const value = valueParts.join(': ');
                    return `<span class="ccc-pair"><span class="ccc-param">${label}:</span><span class="ccc-value">${value}</span></span>`;
                }).join(' ');
            }

            return `
            <tr class="${event.eventType === 'connect' ? 'connect-event' : 'disconnect-event'}">
                <td>${event.packetNum}</td>
                <td>${event.timestamp}</td>
                <td><span class="event-badge ${event.eventType === 'connect' ? 'badge-connect' : 'badge-disconnect'}">${event.eventType}</span></td>
                <td>${event.handle}</td>
                <td>${event.address}</td>
                <td class="params-cell">${formattedParams}</td>
                <td>${event.rawData}</td>
            </tr>
        `}).join('');
    }
}

export async function renderBtsnoopPackets(deps = {}) {
    console.log('[BTSnoop Debug] 3. Rendering btsnoop packets (virtual scroll).');
    const { loadData, TimeTracker } = deps;
    if (TimeTracker) TimeTracker.start('BTSnoop Filtering');

    // --- LIVE Scroll Restoration Logic ---
    if (!btsnoopAnchorPacketNumber && btsnoopLogContainer && btsnoopLogContainer.scrollTop > 0) {
        const scrollTop = btsnoopLogContainer.scrollTop;
        let topVisibleIndex = 0;
        if (btsnoopRowPositions && btsnoopRowPositions.length > 0) {
            let low = 0, high = btsnoopRowPositions.length - 1;
            while (low <= high) {
                const mid = (low + high) >>> 1;
                if (btsnoopRowPositions[mid] < scrollTop) low = mid + 1;
                else high = mid - 1;
            }
            topVisibleIndex = Math.max(0, Math.min(high, filteredBtsnoopPackets.length - 1));
        }
        if (filteredBtsnoopPackets[topVisibleIndex]) {
            btsnoopAnchorPacketNumber = filteredBtsnoopPackets[topVisibleIndex].number;
        }
    }
    if (selectedBtsnoopPacket) {
        btsnoopAnchorPacketNumber = selectedBtsnoopPacket.number;
    }

    const columnFilters = Array.from(btsnoopColumnFilters || [])
        .map(input => ({
            index: parseInt(input.dataset.column, 10),
            value: input.value.toLowerCase()
        }))
        .filter(f => f.value);

    let allPackets = btsnoopPackets;
    if ((!allPackets || allPackets.length === 0) && loadData) {
        try {
            const stored = await loadData('btsnoopPackets');
            if (stored && stored.value) allPackets = stored.value;
            btsnoopPackets = allPackets;
        } catch (e) { console.log('No cached packets'); }
    }

    // SORTING
    let sortedPackets = allPackets;
    if (allPackets.length > 0 && btsnoopSortColumn !== null) {
        const columnFields = ['number', 'timestamp', 'source', 'destination', 'type', 'summary', 'data'];
        const sortField = columnFields[btsnoopSortColumn] || 'number';

        sortedPackets = [...allPackets].sort((a, b) => {
            // Primary: Group by Filename for collapsible headers
            if (a.fileName > b.fileName) return 1;
            if (a.fileName < b.fileName) return -1;

            // Secondary: Meta first
            if (a.type === 'META') return -1;
            if (b.type === 'META') return 1;

            let aVal = a[sortField] || '';
            let bVal = b[sortField] || '';
            // Numeric check
            const aNum = parseFloat(String(aVal).replace(/[^0-9.-]/g, ''));
            const bNum = parseFloat(String(bVal).replace(/[^0-9.-]/g, ''));
            if (!isNaN(aNum) && !isNaN(bNum)) {
                return btsnoopSortOrder === 'asc' ? aNum - bNum : bNum - aNum;
            }
            return btsnoopSortOrder === 'asc'
                ? String(aVal).localeCompare(String(bVal))
                : String(bVal).localeCompare(String(aVal));
        });
    }

    // FILTERING
    filteredBtsnoopPackets = [];
    for (const packet of sortedPackets) {
        if (packet.type === 'META') {
            filteredBtsnoopPackets.push(packet);
            continue;
        }
        if (btsnoopCollapsedFiles.has(packet.fileName)) continue;

        const passesTags = activeBtsnoopFilters.size === 0 || packet.tags.some(tag => activeBtsnoopFilters.has(tag));
        if (!passesTags) continue;

        let match = true;
        if (columnFilters.length > 0) {
            const columnData = [packet.number, packet.timestamp, packet.source || '', packet.destination || '', packet.type, packet.summary, packet.data];
            match = columnFilters.every(filter => columnData[filter.index].toString().toLowerCase().includes(filter.value));
        }
        if (match) filteredBtsnoopPackets.push(packet);
    }

    // Row Positions
    btsnoopRowPositions = new Float32Array(filteredBtsnoopPackets.length);
    btsnoopTotalHeight = 0;
    for (let i = 0; i < filteredBtsnoopPackets.length; i++) {
        btsnoopRowPositions[i] = btsnoopTotalHeight;
        const packet = filteredBtsnoopPackets[i];
        if (packet.type === 'META') {
            btsnoopTotalHeight += 30;
        } else {
            const dataLength = packet.data?.length || 0;
            const estimatedLines = Math.max(1, Math.ceil(dataLength / 100));
            btsnoopTotalHeight += 20 * estimatedLines;
        }
    }

    if (TimeTracker) TimeTracker.stop('BTSnoop Filtering');

    // Scroll Restoration (Step 2 & 3 combined logic from main.js)
    let targetScrollTop = null;
    let shouldCenterSelected = false;

    if (btsnoopAnchorPacketNumber !== null) {
        let foundPacketIndex = -1;
        for (let i = 0; i < filteredBtsnoopPackets.length; i++) {
            if (filteredBtsnoopPackets[i].number === btsnoopAnchorPacketNumber) {
                foundPacketIndex = i;
                break;
            }
        }
        if (foundPacketIndex !== -1) {
            targetScrollTop = btsnoopRowPositions[foundPacketIndex];
            if (selectedBtsnoopPacket && btsnoopAnchorPacketNumber === selectedBtsnoopPacket.number && btsnoopLogContainer) {
                const containerHeight = btsnoopLogContainer.clientHeight;
                targetScrollTop = Math.max(0, targetScrollTop - (containerHeight / 2) + 10);
                shouldCenterSelected = true;
            }
        } else {
            btsnoopAnchorPacketNumber = null;
        }
    }

    renderBtsnoopVirtualLogs();

    if (targetScrollTop !== null && btsnoopLogContainer) {
        clearTimeout(window.btsnoopAnchorClearTimer);
        requestAnimationFrame(() => {
            if (btsnoopLogContainer) { // Check existence again
                btsnoopLogContainer.scrollHeight; // Force layout
                isProgrammaticBtsnoopScroll = true;
                btsnoopLogContainer.scrollTop = targetScrollTop;
                renderBtsnoopVirtualLogs(); // Force re-render at new pos
                setTimeout(() => { isProgrammaticBtsnoopScroll = false; }, 200);
            }
        });
    }
}

function renderBtsnoopVirtualLogs() {
    if (!btsnoopLogViewport || !btsnoopLogSizer || !btsnoopLogContainer) return;
    btsnoopLogSizer.style.height = btsnoopTotalHeight + 'px';
    const scrollTop = btsnoopLogContainer.scrollTop;
    const containerHeight = btsnoopLogContainer.clientHeight;
    const viewportBottom = scrollTop + containerHeight;

    // Binary search start index
    let startIndex = 0;
    let low = 0, high = btsnoopRowPositions.length - 1;
    while (low <= high) {
        const mid = (low + high) >>> 1;
        if (btsnoopRowPositions[mid] < scrollTop) low = mid + 1;
        else high = mid - 1;
    }
    startIndex = Math.max(0, high - BUFFER_LINES);

    // Find end index
    let endIndex = startIndex;
    for (let i = startIndex; i < filteredBtsnoopPackets.length; i++) {
        if (btsnoopRowPositions[i] > viewportBottom) { endIndex = i; break; }
        endIndex = i + 1;
    }
    endIndex = Math.min(filteredBtsnoopPackets.length, endIndex + BUFFER_LINES);
    if (endIndex <= startIndex) endIndex = Math.min(filteredBtsnoopPackets.length, startIndex + 50);

    const visibleRows = [];
    for (let i = startIndex; i < endIndex; i++) {
        const packet = filteredBtsnoopPackets[i];
        if (!packet) continue;

        let row = btsnoopRowPool.pop();
        if (!row) {
            row = document.createElement('div');
            row.className = 'btsnoop-row';
            for (let j = 0; j < 7; j++) row.appendChild(document.createElement('div'));
        }

        if (packet.type === 'META') {
            row.className = 'btsnoop-row btsnoop-meta-row';
            row.innerHTML = '';
            const headerDiv = document.createElement('div');
            headerDiv.className = 'btsnoop-file-header';
            const isCollapsed = btsnoopCollapsedFiles.has(packet.fileName);
            headerDiv.textContent = `${isCollapsed ? '▶' : '▼'} ${packet.fileName}`;
            headerDiv.onclick = (e) => {
                e.stopPropagation();
                if (btsnoopCollapsedFiles.has(packet.fileName)) btsnoopCollapsedFiles.delete(packet.fileName);
                else btsnoopCollapsedFiles.add(packet.fileName);
                renderBtsnoopPackets();
            };
            row.appendChild(headerDiv);
            row.style.position = 'absolute';
            row.style.top = '0';
            row.style.left = '0';
            row.style.transform = `translateY(${btsnoopRowPositions[i]}px)`;
            row.style.width = '100%';
            row.style.height = '30px';
            row.style.display = 'block';
        } else {
            row.className = 'btsnoop-row';
            if (selectedBtsnoopPacket && selectedBtsnoopPacket.number === packet.number) row.classList.add('selected');
            else row.classList.remove('selected');
            row.classList.add(packet.number % 2 === 0 ? 'even-row' : 'odd-row');
            row.classList.remove(packet.number % 2 === 0 ? 'odd-row' : 'even-row');
            row.dataset.packetNumber = packet.number;

            if (row.children.length !== 7) {
                row.innerHTML = '';
                for (let j = 0; j < 7; j++) row.appendChild(document.createElement('div'));
            }
            const cellData = [packet.number, packet.timestamp, packet.source, packet.destination, packet.type, packet.summary, packet.data];
            const cells = row.children;
            for (let j = 0; j < 7; j++) {
                const val = (cellData[j] !== undefined && cellData[j] !== null) ? String(cellData[j]) : '';
                cells[j].textContent = val;
                cells[j].title = val + " (Ctrl+Click to copy)";
                cells[j].dataset.logText = val;
                cells[j].className = 'btsnoop-cell btsnoop-copy-cell';
                cells[j].style.color = '#e0e0e0';
                cells[j].style.fontFamily = "'JetBrains Mono', monospace";
                cells[j].style.fontSize = '13px';
                if (j === 6) { // Data column
                    cells[j].style.whiteSpace = 'pre-wrap';
                    cells[j].style.wordBreak = 'break-all';
                    cells[j].style.minHeight = '20px';
                    cells[j].style.height = 'auto';
                } else {
                    cells[j].style.whiteSpace = 'nowrap';
                }
            }

            row.style.position = 'absolute';
            row.style.top = '0'; // using transform
            row.style.left = '0';
            row.style.width = '100%';
            row.style.transform = `translateY(${btsnoopRowPositions[i]}px)`;
            row.style.minHeight = '20px';
            row.style.height = 'auto';
            row.style.display = 'grid';
            row.style.gridTemplateColumns = currentBtsnoopGridTemplate || '60px 120px 160px 160px 80px minmax(200px, 2fr) minmax(200px, 3fr)';
        }
        visibleRows.push(row);
    }

    while (btsnoopLogViewport.firstChild) btsnoopRowPool.push(btsnoopLogViewport.removeChild(btsnoopLogViewport.firstChild));
    visibleRows.forEach(row => btsnoopLogViewport.appendChild(row));
}

function createBtsnoopFilterHeader() {
    const header = document.getElementById('btsnoopHeader');
    if (!header) return;
    if (header.hasChildNodes()) {
        const grid = header.querySelector('.btsnoop-header-grid');
        if (grid && grid.children.length === 14) return;
        header.innerHTML = '';
    }

    const headerGrid = document.createElement('div');
    headerGrid.className = 'btsnoop-header-grid';
    headerGrid.style.gridTemplateColumns = '60px 120px 160px 160px 80px minmax(200px, 2fr) minmax(200px, 3fr)';

    const columns = ['No.', 'Timestamp', 'Source', 'Destination', 'Type', 'Summary', 'Data'];

    // Titles
    columns.forEach((text, i) => {
        const cell = document.createElement('div');
        cell.className = 'btsnoop-header-cell sortable';
        cell.style.cursor = 'pointer';
        cell.dataset.column = i;
        const sortIndicator = document.createElement('span');
        sortIndicator.className = 'sort-indicator';
        if (i === btsnoopSortColumn) {
            sortIndicator.textContent = btsnoopSortOrder === 'asc' ? ' ▲' : ' ▼';
            sortIndicator.style.color = '#a0cfff';
        } else {
            sortIndicator.textContent = ' ⇅';
            sortIndicator.style.opacity = '0.3';
        }
        cell.innerHTML = `${text}<div class="resize-handle-col"></div>`;
        cell.appendChild(sortIndicator);
        cell.addEventListener('click', (e) => {
            if (e.target.classList.contains('resize-handle-col')) return;
            if (btsnoopSortColumn === i) btsnoopSortOrder = btsnoopSortOrder === 'asc' ? 'desc' : 'asc';
            else { btsnoopSortColumn = i; btsnoopSortOrder = 'desc'; }

            // Validate UI update for sort indicators
            const allCells = headerGrid.querySelectorAll('.btsnoop-header-cell');
            allCells.forEach((c, idx) => {
                const ind = c.querySelector('.sort-indicator');
                if (ind) {
                    if (idx === btsnoopSortColumn) {
                        ind.textContent = btsnoopSortOrder === 'asc' ? ' ▲' : ' ▼';
                        ind.style.color = '#a0cfff';
                        ind.style.opacity = '1';
                    } else {
                        ind.textContent = ' ⇅';
                        ind.style.color = '';
                        ind.style.opacity = '0.3';
                    }
                }
            });
            btsnoopAnchorPacketNumber = null;
            if (btsnoopLogContainer) btsnoopLogContainer.scrollTop = 0;
            renderBtsnoopPackets();
        });
        headerGrid.appendChild(cell);
    });

    // Filters
    columns.forEach((text, i) => {
        const cell = document.createElement('div');
        cell.className = 'btsnoop-filter-cell';
        const input = document.createElement('input');
        input.type = 'text';
        input.dataset.column = i;
        input.placeholder = `Filter ${text}...`;
        cell.appendChild(input);
        headerGrid.appendChild(cell);
    });

    header.appendChild(headerGrid);
    btsnoopColumnFilters = document.querySelectorAll('.btsnoop-filter-cell input');
    btsnoopColumnFilters.forEach(input => {
        input.addEventListener('input', () => {
            clearTimeout(btsnoopColumnFilterDebounceTimer);
            btsnoopColumnFilterDebounceTimer = setTimeout(() => renderBtsnoopPackets(), 300);
        });
    });

    // Resize Logic
    let thBeingResized = null, startX, startWidths;
    headerGrid.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('resize-handle-col')) {
            thBeingResized = e.target.parentElement;
            startX = e.pageX;
            const computedStyle = window.getComputedStyle(headerGrid);
            startWidths = computedStyle.gridTemplateColumns.split(' ').map(parseFloat);
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            e.preventDefault();
        }
    });

    function onMouseMove(e) {
        if (thBeingResized) {
            const diffX = e.pageX - startX;
            const cells = Array.from(headerGrid.children); // These include title cells then filter cells
            // The title cells are indices 0-6
            const cellIndex = cells.indexOf(thBeingResized);
            if (cellIndex >= 0 && cellIndex < startWidths.length) {
                const newWidth = Math.max(50, startWidths[cellIndex] + diffX);
                const newTemplate = startWidths.map((w, i) => i === cellIndex ? `${newWidth}px` : `${w}px`).join(' ');
                headerGrid.style.gridTemplateColumns = newTemplate;
                currentBtsnoopGridTemplate = newTemplate;
                const bodyRows = document.querySelectorAll('.btsnoop-row');
                bodyRows.forEach(row => row.style.gridTemplateColumns = newTemplate);
            }
        }
    }
    function onMouseUp() {
        thBeingResized = null;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }
}

function attachBtsnoopFilterListeners() {
    // ... logic ...
    const container = document.getElementById('btsnoopFilterContainer');
    if (!container) return;
    const buttons = container.querySelectorAll('.filter-icon');
    buttons.forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', () => {
            const type = newBtn.dataset.btsnoopFilter;
            newBtn.classList.toggle('active');
            if (newBtn.classList.contains('active')) activeBtsnoopFilters.add(type);
            else activeBtsnoopFilters.delete(type);
            renderBtsnoopPackets();
        });
        // Sync
        if (activeBtsnoopFilters.has(newBtn.dataset.btsnoopFilter)) newBtn.classList.add('active');
        else newBtn.classList.remove('active');
    });
}

function attachHeaderButtonListeners() {
    const toggleBtn = document.getElementById('btsnoopToggleCollapseBtn');
    if (toggleBtn) {
        const newBtn = toggleBtn.cloneNode(true);
        toggleBtn.parentNode.replaceChild(newBtn, toggleBtn);
        newBtn.addEventListener('click', () => {
            const metaPackets = btsnoopPackets.filter(p => p.type === 'META');
            if (metaPackets.length === 0) return;
            const allCollapsed = metaPackets.every(p => btsnoopCollapsedFiles.has(p.fileName));
            if (allCollapsed) {
                btsnoopCollapsedFiles.clear();
                newBtn.textContent = '⊟';
            } else {
                metaPackets.forEach(p => btsnoopCollapsedFiles.add(p.fileName));
                newBtn.textContent = '⊞';
            }
            renderBtsnoopPackets();
        });
    }

    const exportBtn = document.getElementById('exportBtsnoopXlsxBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => exportBtsnoopToXlsx());
    }
}

export function exportBtsnoopToXlsx() {
    if (!filteredBtsnoopPackets.length) return alert("No packets to export.");
    const data = filteredBtsnoopPackets.map(p => [p.number, p.timestamp, p.source, p.destination, p.type, p.summary, p.data]);
    const ws = XLSX.utils.aoa_to_sheet([['No.', 'Time', 'Src', 'Dst', 'Type', 'Summary', 'Data'], ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'BTSnoop');
    XLSX.writeFile(wb, 'btsnoop_packets.xlsx');
}

function handleBtsnoopClick(e) {
    const target = e.target;
    // Copy Logic
    const copyCell = target.closest('.btsnoop-copy-cell');
    if (copyCell) {
        let text = copyCell.dataset.logText;
        if (text) {
            if (e.ctrlKey || e.metaKey) {
                // Check if we should copy the whole row (if the cell is part of a row and intention is implied, 
                // but previously it was explicit or based on context. 
                // The old code in main.js did: if (isCopyBtn || (isCtrlClick && copyTarget)) ... 
                // and checks if it's a row to aggregate.

                // However, the user request "Extend BTSnoop Row Copy" implies we want row copy.
                // Let's implement row copy on Ctrl+Click if it's a row, OR single cell.
                // Actually, standard behavior usually allows single cell. 
                // But let's check main.js logic:
                // "BTSnoop Row: Aggregate all BTSnoop cells" was used if `btsnoopRow` was found.
                // So Ctrl+Click on ANY cell in a BTSnoop row copied the WHOLE row? 
                // Let's look at main.js again.
                // if (btsnoopRow) { logText = cells.map... }
                // Yes, it aggregated the row.

                const row = target.closest('.btsnoop-row');
                if (row && !row.classList.contains('btsnoop-meta-row')) {
                    const cells = Array.from(row.querySelectorAll('.btsnoop-cell'));
                    text = cells.map(c => c.dataset.logText || c.textContent).join('  ');
                }

                navigator.clipboard.writeText(text).then(() => {
                    const originalTitle = copyCell.title;
                    copyCell.title = "Row Copied!";
                    copyCell.classList.add('copied-feedback'); // We might need to style this class if not global
                    // Also maybe provide feedback on the whole row?
                    // For now, feedback on the clicked cell is fine.
                    setTimeout(() => {
                        copyCell.title = originalTitle;
                        copyCell.classList.remove('copied-feedback');
                    }, 1000);
                });
            }
        }
    }

    // Selection Logic
    const row = target.closest('.btsnoop-row');
    if (row && !row.classList.contains('btsnoop-meta-row')) {
        const packetNum = parseInt(row.dataset.packetNumber, 10);
        const packet = filteredBtsnoopPackets.find(p => p.number === packetNum);
        if (packet) {
            if (selectedBtsnoopPacket === packet) selectedBtsnoopPacket = null; // Toggle off
            else selectedBtsnoopPacket = packet;
            renderBtsnoopVirtualLogs();
        }
    } else if (!target.closest('.btsnoop-copy-cell') && !target.closest('.btsnoop-header-cell') && !target.closest('input')) {
        // Deselect if clicking empty space
        selectedBtsnoopPacket = null;
        renderBtsnoopVirtualLogs();
    }
}
