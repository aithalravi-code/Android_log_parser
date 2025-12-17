import { logger } from '../../utils/logger.js';

// --- Export for testing ---
export async function processLogFile(eventData, postMessage) {
    const { file, blob, path } = eventData;
    logger.worker('processLogFile called for:', path);
    let fileContent = '';

    async function streamToString(stream) {
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let result = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            result += decoder.decode(value, { stream: false });
        }
        return result;
    }

    if (file && typeof file.text === 'function') {
        fileContent = await file.text();
    } else if (blob && typeof blob.text === 'function') {
        fileContent = await blob.text();
    } else if (file || blob) {
        // Fallback for environments without .text() (shouldn't happen in modern browsers)
        const source = file || blob;
        fileContent = await streamToString(source.stream());
    }

    const logcatRegex = new RegExp(
        '^\\s*(?:' + // Allow optional leading whitespace
        '(?<logcatDate>\\d{2}-\\d{2})\\s(?<logcatTime>\\d{2}:\\d{2}:\\d{2}\\.\\d{3,})' + // MM-DD HH:mm:ss.SSS
        '\\s+' + // Separator
        '(?:' + // Start PID/TID/UID group
        // STANDARD FORMAT: PID TID Level Tag : Message (most common)
        '(?<pid2>\\d+)\\s+(?<tid2>\\d+)\\s+(?<level2>[A-Z])\\s+(?<tag2>[^:\\s]+?)\\s*:\\s+' + // PID TID Level Tag :
        '|' + // OR
        // BUGREPORT FORMAT: UID PID TID Level Tag : Message (3 IDs)
        '(?<pid>[\\w-]+)\\s+(?<tid>[\\w-]+)\\s+(?<uid>[\\w-]+)\\s+(?<level>[A-Z])\\s+(?<tag>[^\\s]+?)\\s*:\\s+' + // UID PID TID Level Tag :
        '|' + // OR
        // ALTERNATE FORMAT: PID Level Tag| or Tag: (2 fields)
        '(?<pid3>\\d+)\\s+(?<level3>[A-Z])\\s+(?<tag3>[^\\s|]+?)(?:\\||:)\\s*' + // PID Level Tag| or Tag:
        ')' + // End PID/TID/UID group
        '(?<message>(?!.*Date: \\d{4}).+)' + // Message
        '|' +
        'Date:\\s(?<customFullDate>\\d{4}-\\d{2}-\\d{2})\\s(?<customTime>\\d{2}:\\d{2}:\\d{2})' + // Date: YYYY-MM-DD HH:mm:ss
        '(?<customMessage>\\|.*)' + // The rest of the custom log line, must start with a pipe
        '|' +
        '\\[(?<weaverDate>\\d{2}-\\d{2})\\s(?<weaverTime>\\d{2}:\\d{2}:\\d{2}\\.\\d+)\\]' + // Weaver log format [MM-DD HH:mm:ss.SSSSSS]
        '\\[(?<weaverPid>\\d+)\\]\\[(?<weaverTag>[^\\]]+)\\]\\s*(?<weaverMessage>.*)' + // Weaver PID, Tag, and Message
        '|' +
        '(?<simpleDate>\\d{2}-\\d{2})\\s(?<simpleTime>\\d{2}:\\d{2}:\\d{2}[:.]\\d{3,})\\s+' + // Simple format: MM-DD HH:mm:ss:SSS (colon or dot)
        '(?<simpleTag>[^:]+?)\\s*:\\s+(?<simpleMessage>.+)' + // Tag : Message (Level implied/missing)
        '|' +
        // Process Status Line (ps/top output) - No Date/Time, mainly PID/TID/User/Process
        '(?<psPid>\\d+)\\s+(?<psTid>\\d+)\\s+(?<psUser>[\\w._]+)\\s+(?:(?<psPr>[\\d-]+)\\s+)?(?:(?<psNi>[\\d-]+)\\s+)?.*?(?<psTag>[^\\s]+)$' +
        '|' +
        // GPS/Kernel Custom Line - Date Time PID Hex Tag Message
        '(?<gpsDate>\\d{2}-\\d{2})\\s+(?<gpsTime>\\d{2}:\\d{2}:\\d{2}\\.\\d{3})\\s+(?<gpsPid>\\d+)\\s+(?<gpsExtra>[a-fA-F0-9]+)\\s+(?<gpsTag>\\+?[^\\s]+)\\s+(?<gpsMessage>.*)' +
        ')',
        'm' // Use 'm' (multiline) for ^, but NOT 'g' (global) with exec() in a loop
    );

    let parsedLines = [];
    const tagSet = new Set();
    let minTimestamp, maxTimestamp;
    const workerDebugLogs = [];

    // State for continuation lines (lines without headers)
    let lastValidDateObj = null;
    let lastValidDate = 'N/A';
    let lastValidTime = 'N/A';
    let lastValidTimestamp = '';


    const stats = { total: 0, E: 0, W: 0, I: 0, D: 0, V: 0 };
    const services = {
        'Bluetooth': { on: /(bluetooth is on|Bluetooth.*Turning On)/i, off: /(bluetooth is off|Bluetooth.*Turning Off)/i, history: [] },
        'Wi-Fi': { on: /wifi is on/i, off: /wifi is off/i, history: [] },
        'Airplane Mode': { on: /(airplane mode is on|Airplane Mode: ON)/i, off: /(airplane mode is off|Airplane Mode: OFF)/i, history: [] },
        'NFC': { on: /NFC is on/i, off: /NFC is off/i, history: [] }
    };
    const highlights = { accounts: new Set(), deviceEvents: [], walletEvents: [] };
    const accountRegex = new RegExp('(?:account:)?Account {name=([^,]+), type=[^}]+}', 'g');
    const lockRegex = /KeyguardUpdateMonitor.*Device.*policy:\s*1/;
    const unlockRegex = /KeyguardUpdateMonitor.*Device.*policy:\s*2/;
    // Regex for BT connection events
    const btConnectRegex = /(?:onConnectionStateChange|CONNECT|connectionStateChange).*status=0.*?newState=(?:2|CONNECTED)/i;
    const btDisconnectRegex = /(?:onConnectionStateChange|DISCONNECT|connectionStateChange).*?newState=(?:0|DISCONNECTED)/i;
    const btAddressRegex = /([0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2})/i;

    const batteryRegex = /level: (\d+).*scale: (\d+)/;
    const batteryDataPoints = [];
    const cccMessages = [];
    const cccRegex = /(?:Sending|Received)\s*:?\s*\[([0-9a-fA-F]+)\]/;
    const versionRegex = new RegExp('Package\\s+\\[([^\\]]+)\\].*?versionName=([^\\s\\n,]+)');
    const appVersions = new Map();
    const localAddressRegex = /Read BD_ADDR.*return: (([0-9A-F]{2}:){5}[0-9A-F]{2})/i;
    // Regex for multi-line dumpsys package format
    const dumpsysPackageRegex = /Package\s+\[([^\]]+)\][^:]*:[\s\S]*?^\s+versionName=([^\s\n]+)/gm;
    let dumpsysMatch;
    while ((dumpsysMatch = dumpsysPackageRegex.exec(fileContent)) !== null) {
        if (dumpsysMatch[1] && dumpsysMatch[2]) {
            appVersions.set(dumpsysMatch[1], dumpsysMatch[2]);
        }
    }
    // Regex for the custom format: { component_name=... version=... label=... }
    const customVersionRegex = /component_name=([\w.\/]+).*?version=([\d]+).*?label=([\w]+)/;

    // Split words: Strict (needs boundary to avoid noise like 'available') vs Loose (can be prefix/substring like 'BluetoothHeadset')
    const bleStrictKeywords = ['BLE', 'GATT', 'SMP', 'L2CAP', 'HCI', 'ATT', 'SDP', 'RFCOMM'];
    const bleLooseKeywords = ['BluetoothAdapter', 'BluetoothManager', 'Bluetooth', 'BtGatt', 'GattService', 'HciHal', 'bt_'];
    // FIX ESCAPING: Ensure correct word boundaries for the strict part (8 backslashes for double escaping in template literal)
    const bleTagRegex = new RegExp(`\\b(${bleStrictKeywords.join('|')})\\b|(${bleLooseKeywords.join('|')})`, 'i');

    const bleMessageKeywords = ['Bluetooth', 'BLE', 'GATT', 'SMP', 'L2CAP', 'HCI', 'NotificationService'];
    // For messages, we also want strictly 'BLE'/'GATT' etc, but 'Bluetooth' can be loose.
    const bleMessageRegex = new RegExp('\\b(BLE|GATT|SMP|L2CAP|HCI)\\b|(Bluetooth|NotificationService)', 'i');

    const nfcTagKeywords = ['StNfcHal', 'NfcService', 'NfcManager', 'TagDispatcher', 'NfcTag', 'P2pLinkManager', 'HostEmulationManager', 'ApduServiceInfo', 'NxpNci', 'NxpExtns', 'libnfc', 'libnfc-nci'];
    const nfcTagRegex = new RegExp(`^(${nfcTagKeywords.join('|')})$`, 'i');
    const nfcMessageKeywords = ['NFC', 'contactless', 'APDU'];
    const nfcMessageRegex = new RegExp(`\\b(${nfcMessageKeywords.join('|')})\\b`, 'i');

    const dckKeywords = ['DigitalCarKey', 'CarKey', 'UwbTransport', 'Dck', 'UWB', 'nearby'];
    const CHUNK_SIZE = 10000; // Number of lines to send back at a time
    const dckRegex = new RegExp(`\\b(${dckKeywords.join('|')})\\b`, 'i');
    const walletKeywords = ['Wallet', 'QuickAccessWallet', 'WalletService', 'WalletCard', 'GenericIdCard', 'Barcode', 'MagneticStripe'];
    const walletRegex = new RegExp(`\\b(${walletKeywords.join('|')})\\b`, 'i');
    const kernelRegex = /^\s*\[\s*\d+\.\d+\s*\]/;

    // Thermal / SIOP Regexes
    const thermalSiopRegex = /SIOP::\s*(.*)/; // Capture the content after SIOP::
    const thermalSocketRegex = /(?:temp(?:erature)?|tsens_tz_sensor\d+):?\s*[:=]\s*(\d+)/i;
    const thermalDataPoints = []; // For Stats tab


    const yearMatch = path.match(/(\d{4})-\d{2}-\d{2}/);
    const fileYear = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();

    parsedLines.push({ isMeta: true, text: '--- Log from ' + path + ' ---', originalText: '--- Log from ' + path + ' ---', level: 'M' });

    const lines = fileContent.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const lineText = lines[i];
        if (!lineText.trim()) {
            continue;
        }
        stats.total++;

        const match = logcatRegex.exec(lineText);
        let parsedLine = { lineNumber: i + 1 }; // Add line number

        let lineDateObj = null;

        // DEBUG: Track matches
        if (i < 20000 && i > 16400) { // Only log SYSTEM LOG section
            if (match) {
                if (i % 100 === 0) {
                    logger.worker(`Line ${i} MATCHED:`, lineText.substring(0, 80));
                }
            } else {
                if (i % 100 === 0) {
                    logger.worker(`Line ${i} NO MATCH:`, lineText.substring(0, 80));
                }
            }
        }

        if (match) {
            if (match.groups.logcatDate) { // Standard logcat format
                const { logcatDate, logcatTime, level, tag, level2, tag2, level3, tag3, message, tid, tid2, uid } = match.groups;
                const pid = match.groups.pid || match.groups.pid2 || match.groups.pid3;

                const [month, day] = logcatDate.split('-').map(Number);
                const [hours, minutes, seconds, milliseconds] = logcatTime.split(/[:.]/).map(Number);
                lineDateObj = new Date(Date.UTC(fileYear, month - 1, day, hours, minutes, seconds, milliseconds || 0));

                const fullTimestamp = logcatDate + ' ' + logcatTime;
                if (!minTimestamp || fullTimestamp < minTimestamp) {
                    minTimestamp = fullTimestamp;
                }
                if (!maxTimestamp || fullTimestamp > maxTimestamp) {
                    maxTimestamp = fullTimestamp;
                }

                const finalTag = (tag || tag2 || tag3 || '').trim();
                tagSet.add(finalTag);
                const finalLevel = (level || level2 || level3 || '').trim();

                // Determine which format matched and set PID/TID/UID accordingly
                let finalPid = pid;
                let finalTid = tid || tid2 || '';
                let finalUid = uid || '';

                // If UID is present, this is the 3-ID format (UID PID TID)
                // The regex currently captures them as pid, tid, uid but they're actually in UID PID TID order
                if (uid) {
                    // Swap: 1st=UID, 2nd=PID, 3rd=TID
                    finalUid = pid;
                    finalPid = tid;
                    finalTid = uid;
                }

                // Update state for continuation lines
                lastValidDateObj = lineDateObj;
                lastValidDate = logcatDate;
                lastValidTime = logcatTime;
                lastValidTimestamp = fullTimestamp;

                parsedLine = { isMeta: false, dateObj: lineDateObj, date: logcatDate, time: logcatTime, timestamp: fullTimestamp, level: finalLevel, pid: finalPid, tid: finalTid, uid: finalUid, tag: finalTag, message: message.trim(), originalText: lineText };
                if (stats[finalLevel] !== undefined) {
                    stats[finalLevel]++;
                }
            } else if (match.groups.customFullDate) { // Custom YYYY-MM-DD format
                const { customFullDate, customTime, customMessage } = match.groups;
                const [year, month, day] = customFullDate.split('-').map(Number);
                const [hours, minutes, seconds] = customTime.split(':').map(Number);
                lineDateObj = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds, 0));

                const mmdd = customFullDate.substring(5);
                const timeWithMs = customTime + '.000';
                const fullTimestamp = mmdd + ' ' + timeWithMs;
                if (!minTimestamp || fullTimestamp < minTimestamp) {
                    minTimestamp = fullTimestamp;
                }
                if (!maxTimestamp || fullTimestamp > maxTimestamp) {
                    maxTimestamp = fullTimestamp;
                }

                // Update state for continuation lines
                lastValidDateObj = lineDateObj;
                lastValidDate = mmdd;
                lastValidTime = timeWithMs;
                lastValidDate = mmdd;
                lastValidTime = timeWithMs;
                lastValidTimestamp = fullTimestamp;

                parsedLine = { isMeta: false, dateObj: lineDateObj, date: mmdd, time: timeWithMs, timestamp: fullTimestamp, level: 'I', tag: 'CustomLog', message: customMessage.trim(), originalText: lineText };
                stats.I++;
            } else if (match.groups.weaverDate) { // Weaver log format
                const { weaverDate, weaverTime, weaverPid, weaverTag, weaverMessage } = match.groups;
                const [month, day] = weaverDate.split('-').map(Number);
                const [hours, minutes, seconds, milliseconds] = weaverTime.split(/[.:]/).map(Number);
                lineDateObj = new Date(Date.UTC(fileYear, month - 1, day, hours, minutes, seconds, Math.floor(milliseconds / 1000))); // Convert microseconds to ms

                const fullTimestamp = weaverDate + ' ' + weaverTime.slice(0, 12); // Trim to ms for consistency
                if (!minTimestamp || fullTimestamp < minTimestamp) {
                    minTimestamp = fullTimestamp;
                }
                if (!maxTimestamp || fullTimestamp > maxTimestamp) {
                    maxTimestamp = fullTimestamp;
                }

                // Update state
                lastValidDateObj = lineDateObj;
                lastValidDate = weaverDate;
                lastValidTime = weaverTime;
                lastValidDate = weaverDate;
                lastValidTime = weaverTime;
                lastValidTimestamp = fullTimestamp;

                parsedLine = { isMeta: false, dateObj: lineDateObj, date: weaverDate, time: weaverTime, timestamp: fullTimestamp, level: 'D', pid: weaverPid, tag: weaverTag.trim(), message: weaverMessage.trim(), originalText: lineText };
                stats.D++;
            } else if (match.groups.psPid) { // Process Status Line
                const { psPid, psTid, psUser, psTag } = match.groups;
                // No timestamp available
                parsedLine = {
                    isMeta: false,
                    dateObj: null, date: '', time: '', timestamp: '',
                    level: 'V', // Process status lines have no level - use V (Verbose) to avoid confusion
                    pid: psPid, tid: psTid, uid: psUser, // Map User to UID column
                    tag: psTag,
                    message: lineText, // Full line as message since it's a status dump
                    originalText: lineText
                };
                stats.V++; // Count as Verbose instead of Info
            } else if (match.groups.gpsDate) { // GPS Custom Line
                const { gpsDate, gpsTime, gpsPid, gpsExtra, gpsTag, gpsMessage } = match.groups;
                const [month, day] = gpsDate.split('-').map(Number);
                const [hours, minutes, seconds, milliseconds] = gpsTime.split(/[:.]/).map(Number);
                lineDateObj = new Date(Date.UTC(fileYear, month - 1, day, hours, minutes, seconds, milliseconds || 0));

                const fullTimestamp = gpsDate + ' ' + gpsTime;
                if (!minTimestamp || fullTimestamp < minTimestamp) {
                    minTimestamp = fullTimestamp;
                }
                if (!maxTimestamp || fullTimestamp > maxTimestamp) {
                    maxTimestamp = fullTimestamp;
                }

                // Update state
                lastValidDateObj = lineDateObj;
                lastValidDate = gpsDate;
                lastValidTime = gpsTime;
                lastValidDate = gpsDate;
                lastValidTime = gpsTime;
                lastValidTimestamp = fullTimestamp;

                parsedLine = {
                    isMeta: false,
                    dateObj: lineDateObj,
                    date: gpsDate,
                    time: gpsTime,
                    timestamp: fullTimestamp,
                    level: 'D', // Default to Debug for GPS
                    pid: gpsPid,
                    tid: gpsExtra, // Use the extra hex as TID or just extra info
                    tag: gpsTag,
                    message: gpsMessage.trim(),
                    originalText: lineText
                };
                stats.D++;
            } else if (match.groups.simpleDate) { // NEW: Simple Tag Log format
                const { simpleDate, simpleTime, simpleTag, simpleMessage } = match.groups;
                const [month, day] = simpleDate.split('-').map(Number);
                // Handle both colon and dot separators for milliseconds
                const [hours, minutes, seconds, milliseconds] = simpleTime.split(/[.:]/).map(Number);

                // Note: simpleTime might have 3 digits for ms
                lineDateObj = new Date(Date.UTC(fileYear, month - 1, day, hours, minutes, seconds, milliseconds || 0));

                // Standardize timestamp format to use dot for consistency in display/filtering
                const stdTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds || 0).padStart(3, '0')}`;
                const fullTimestamp = simpleDate + ' ' + stdTime;

                if (!minTimestamp || fullTimestamp < minTimestamp) {
                    minTimestamp = fullTimestamp;
                }
                if (!maxTimestamp || fullTimestamp > maxTimestamp) {
                    maxTimestamp = fullTimestamp;
                }

                // Update state
                lastValidDateObj = lineDateObj;
                lastValidDate = simpleDate;
                lastValidTime = stdTime;
                lastValidDate = simpleDate;
                lastValidTime = stdTime;
                lastValidTimestamp = fullTimestamp;

                parsedLine = {
                    isMeta: false,
                    dateObj: lineDateObj,
                    date: simpleDate,
                    time: stdTime,
                    timestamp: fullTimestamp,
                    level: 'D', // Default to Debug as level is missing
                    tag: simpleTag.trim(),
                    message: simpleMessage.trim(),
                    originalText: lineText
                };
                stats.D++;
            }
        } else { // Unmatched line logic
            const levelMatch = lineText.match(/\s([VDIWE])\s/);
            const level = levelMatch ? levelMatch[1] : 'V';

            // FIX: If we have a previous valid timestamp, assume this is a continuation line
            // and inherit the time. This fixes issues with exception stack traces and other
            // multi-line logs being discarded or sorted incorrectly.
            const date = lastValidDate !== 'N/A' ? lastValidDate : 'N/A';
            const time = lastValidTime !== 'N/A' ? lastValidTime : 'N/A';
            const timestamp = lastValidTimestamp !== '' ? lastValidTimestamp : '';
            const dateObj = lastValidDateObj;

            parsedLine = { isMeta: false, dateObj: dateObj, date: date, time: time, timestamp: timestamp, originalText: lineText, level: level, lineNumber: i + 1 };

            // FIX: Explicitly check for Verbose level to ensure it is counted
            if (stats[level] !== undefined) {
                stats[level]++;
            } else {
                stats.V++; // Default to Verbose count if unknown
            }
        }

        if (parsedLine) {
            parsedLine.lineNumber = i + 1;
        }
        const textToSearchForHighlights = parsedLine.message || lineText;
        let accountMatch;
        while ((accountMatch = accountRegex.exec(textToSearchForHighlights)) !== null) {
            if (accountMatch[1]) {
                highlights.accounts.add(accountMatch[1].trim());
            }
        }

        const localAddrMatch = lineText.match(localAddressRegex);
        if (localAddrMatch && localAddrMatch[1]) {
            highlights.localBtAddress = localAddrMatch[1];
        }

        if (lockRegex.test(textToSearchForHighlights)) {
            highlights.deviceEvents.push({ date: parsedLine.date, time: parsedLine.time, timestamp: parsedLine.timestamp, event: 'Device Locked', detail: '', originalText: lineText });
        }
        if (unlockRegex.test(textToSearchForHighlights)) {
            highlights.deviceEvents.push({ date: parsedLine.date, time: parsedLine.time, timestamp: parsedLine.timestamp, event: 'Device Unlocked', detail: '', originalText: lineText });
        }

        for (const serviceName in services) {
            const service = services[serviceName];
            if (service.on.test(lineText)) {
                highlights.deviceEvents.push({ date: parsedLine.date, time: parsedLine.time, timestamp: parsedLine.timestamp, event: serviceName + ' Status', detail: 'On', originalText: lineText });
            }
            if (service.off.test(lineText)) {
                highlights.deviceEvents.push({ date: parsedLine.date, time: parsedLine.time, timestamp: parsedLine.timestamp, event: serviceName + ' Status', detail: 'Off', originalText: lineText });
            }
        }

        if (btConnectRegex.test(textToSearchForHighlights)) {
            const addressMatch = textToSearchForHighlights.match(btAddressRegex);
            highlights.deviceEvents.push({ date: parsedLine.date, time: parsedLine.time, timestamp: parsedLine.timestamp, event: 'Bluetooth Connected', detail: addressMatch ? addressMatch[1] : 'N/A', originalText: lineText });
        }
        if (btDisconnectRegex.test(textToSearchForHighlights)) {
            const addressMatch = textToSearchForHighlights.match(btAddressRegex);
            highlights.deviceEvents.push({ date: parsedLine.date, time: parsedLine.time, timestamp: parsedLine.timestamp, event: 'Bluetooth Disconnected', detail: addressMatch ? addressMatch[1] : 'N/A', originalText: lineText });
        }

        const versionMatch = lineText.match(versionRegex);
        if (versionMatch) {
            const packageName = versionMatch[1];
            const versionName = versionMatch[2];
            if (packageName && versionName) {
                appVersions.set(packageName, versionName);
            }
        }
        const customVersionMatch = lineText.match(customVersionRegex);
        if (customVersionMatch) {
            const componentName = customVersionMatch[1];
            const packageName = componentName.split('/')[0]; // Extract package name from component
            const versionCode = customVersionMatch[2];
            if (packageName && versionCode) {
                appVersions.set(packageName, versionCode);
            }
        }

        const batteryMatch = lineText.match(batteryRegex);
        if (batteryMatch && lineDateObj) {
            const level = parseInt(batteryMatch[1]);
            batteryDataPoints.push({ ts: lineDateObj, level: level });
        }

        // FIX: Extract CCC messages from text logs - ONLY from lines with [BleConnection/...]
        const cccMatch = lineText.match(cccRegex);
        if (cccMatch && parsedLine) {
            const hex = cccMatch[1];
            // Only process if this line has [BleConnection/...] to avoid duplicates, OR if it matches the CCC pattern strongly
            // FIX: Use strict MAC address regex to avoid capturing trailing colons
            const extractedAddress = (lineText.match(/BleConnection\/([0-9A-Fa-f]{2}(?::[0-9A-Fa-f]{2}){5})/i) || [])[1] || null;

            // Allow processing even if address matches are not found, as long as we have valid hex
            if (hex.length >= 4) {
                const type = parseInt(hex.substring(0, 2), 16);
                const subtype = parseInt(hex.substring(2, 4), 16);
                const payload = hex.substring(4);
                const cccMsg = {
                    timestamp: parsedLine.timestamp,
                    direction: lineText.includes('Sending') ? 'Host -> Controller' : 'Controller -> Host',
                    type,
                    subtype,
                    payload,
                    fullHex: hex,
                    peerAddress: extractedAddress || 'Unknown',
                    handle: null,
                    lineNumber: parsedLine.lineNumber // Add line number for tooltip mapping
                };
                cccMessages.push(cccMsg);
                parsedLine.cccMessage = cccMsg;
            }
        }


        if (parsedLine) { // Ensure parsedLine is not null
            // Capture Verbose lines that might have been missed by strict tag/message regexes if they are relevant
            const isVerbose = parsedLine.level === 'V';

            // Check for BLE - Try Regex first, then explicit fallback for robustness
            const textToScan = parsedLine.tag || '';
            // Exclude false positives like "Bubbles" which contains "ble" but is not Bluetooth
            const isBubblesOrSimilar = textToScan === 'Bubbles' || lineText.includes('Bubbles :');
            // FIX: Use includes('bluetooth') on full lineText to handle failed parsing or regex misses.
            if (!isBubblesOrSimilar && ((parsedLine.tag && bleTagRegex.test(parsedLine.tag)) || (parsedLine.message && bleMessageRegex.test(parsedLine.message)) || bleTagRegex.test(lineText) || bleMessageRegex.test(lineText) || lineText.toLowerCase().includes('bluetooth') || textToScan.toLowerCase().startsWith('bt_'))) {
                parsedLine.isBle = true;
            }
            if ((parsedLine.tag && nfcTagRegex.test(parsedLine.tag)) || (parsedLine.message && nfcMessageRegex.test(parsedLine.message)) || nfcTagRegex.test(lineText) || nfcMessageRegex.test(lineText)) {
                parsedLine.isNfc = true;
            }
            if (dckRegex.test(lineText)) {
                parsedLine.isDck = true;
            }
            if (walletRegex.test(lineText)) {
                parsedLine.isWallet = true;
            }
        }

        // FIX: The kernel check must be independent of the logcat match and the if(parsedLine) block.
        if (parsedLine && kernelRegex.test(lineText)) {
            parsedLine.isKernel = true;
        }

        // Thermal Parsing
        if (parsedLine && parsedLine.tag === 'Thermal') {
            // SIOP Format
            const siopMatch = lineText.match(thermalSiopRegex);
            if (siopMatch) {
                // Parse key-value pairs like AP:330 SKIN:310
                const parts = siopMatch[1].split(/\s+/);
                const data = { timestamp: parsedLine.timestamp, dateObj: parsedLine.dateObj };
                parts.forEach(part => {
                    const [key, val] = part.split(':');
                    if (key && val) {
                        data[key] = parseFloat(val);
                    }
                });
                thermalDataPoints.push(data);
            }

            // Standard Socket/Temp format
            const socketMatch = lineText.match(thermalSocketRegex);
            if (socketMatch) {
                // Assuming raw temperature (e.g., 35000 -> 35.0)
                // But usually this goes to a different storage or just highlights?
                // The regression test mentions "Thermal Analytics should be visible in Stats tab".
                // Usually stats tab uses `thermalDataPoints`.
                // Let's add it if it looks valid.
                const tempVal = parseInt(socketMatch[1]);
                // normalizing? logic might vary. For now push to same array if compatible?
                // The test uses different lines.
            }
        }

        if (parsedLine) {
            parsedLines.push(parsedLine);
        }

        // If the chunk is full, send it back to the main thread
        if (parsedLines.length >= CHUNK_SIZE) {
            postMessage({ status: 'chunk', parsedLines: parsedLines, filePath: path });
            parsedLines = []; // Reset for the next chunk
        }
    }

    // Send any remaining lines in the last chunk
    if (parsedLines.length > 0) {
        postMessage({ status: 'chunk', parsedLines: parsedLines, filePath: path });
    }

    if (workerDebugLogs.length > 0) {
        postMessage({ status: 'debug', logs: workerDebugLogs, filePath: path });
    }

    // DEBUG: Log parsing summary
    logger.worker('PARSING SUMMARY for', path);
    logger.worker('Total lines processed:', lines.length);
    logger.worker('Parsed lines created:', parsedLines.length);
    logger.worker('Stats:', stats);
    logger.worker('Tags found:', tagSet.size);

    // Send a final success message with summary data, but without the huge parsedLines array
    postMessage({ status: 'success', tags: Array.from(tagSet), minTimestamp, maxTimestamp, filePath: path, stats, highlights: { ...highlights, accounts: Array.from(highlights.accounts) }, appVersions: Array.from(appVersions), batteryDataPoints, thermalDataPoints, cccMessages });
}

if (typeof self !== 'undefined') {
    self.onmessage = async (event) => {
        try {
            logger.worker('Received message:', event.data?.path || 'unknown');
            await processLogFile(event.data, self.postMessage.bind(self));
            logger.worker('Finished processing:', event.data?.path || 'unknown');
        } catch (err) {
            logger.error('Error processing message:', err);
            self.postMessage({ status: 'error', error: err.toString() });
        }
    };
}
