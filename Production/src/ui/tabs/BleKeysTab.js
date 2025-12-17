import { makeSortable } from '../../table-sort.js';
import { makeTableResizable } from '../../table-resize.js';

const bleKeysData = [];

/**
 * Renders the BLE Security Keys table.
 * @param {Array} connectionEvents - The global BTSnoop connection events list.
 * @param {Map} connectionMap - The global BTSnoop connection map (handle -> info).
 * @param {HTMLElement} tableElement - The HTML element (tbody) to render into.
 */
export function renderBleKeys(connectionEvents, connectionMap, tableElement, textKeys = null) {
    if (!tableElement) {
        return;
    }

    tableElement.innerHTML = '';

    // 1. Get keys from BTSnoop events
    const keyEvents = connectionEvents.filter(e => e.keyType);

    // 2. Convert textKeys (Map) to array format compatible with keyEvents
    const textKeyEvents = [];
    if (textKeys && textKeys.size > 0) {
        textKeys.forEach((keyInfo, address) => {
            // keyInfo is expected to be { type: 'LTK'/'IRK', key: 'HexStr' } or similar
            // Adjust based on what worker actually sends.
            // Worker sends: [addr, keyInfo] where keyInfo might be just the key string or object?
            // Checking main.js consolidation: finalBleKeys.set(addr, keyInfo);
            // Checking worker.js: it doesn't seem to extract BLE keys from text logs yet?
            // Wait, implementation plan said "finalBleKeys (extracted by worker) are effectively ignored".
            // Let's assume standard object structure for now, or normalize it.

            // If keyInfo is string, treat as LTK
            let keyType = 'LTK';
            let keyValue = keyInfo;
            if (typeof keyInfo === 'object') {
                keyType = keyInfo.type || 'LTK';
                keyValue = keyInfo.key || keyInfo.value;
            }

            textKeyEvents.push({
                packetNum: '-', // No packet num for text logs
                timestamp: '-', // We might want to pass timestamp if available in keyInfo, but map key is address
                peerAddress: address,
                keyType: keyType,
                keyValue: keyValue,
                data: 'Extracted from Text Log'
            });
        });
    }

    // 3. Merge and Deduplicate
    const allKeys = [...keyEvents, ...textKeyEvents];

    if (allKeys.length === 0) {
        tableElement.innerHTML = '<tr><td colspan="6">No BLE security keys found.</td></tr>';
        return;
    }

    let keyTableHtml = '';
    const seenKeys = new Set(); // Deduplicate keys

    for (const event of allKeys) {
        // Deduplication check
        if (seenKeys.has(event.keyValue)) {
            continue;
        }
        seenKeys.add(event.keyValue);

        // Resolve peer address from connection map if handle is available
        // Handle both hex string (0x...) and raw number formats from worker
        let handleNumber = -1;
        if (event.handle !== undefined && event.handle !== null) {
            if (typeof event.handle === 'string' && event.handle.startsWith('0x')) {
                handleNumber = parseInt(event.handle, 16);
            } else {
                handleNumber = Number(event.handle);
            }
        }

        const peerAddress = event.peerAddress || connectionMap.get(handleNumber)?.address || 'N/A';

        // Generate unique row ID for scroll restoration
        const rowId = `ble-key-${event.keyValue}`;

        keyTableHtml += `<tr data-row-id="${rowId}">
            <td>${event.packetNum || '-'}</td>
            <td>${event.timestamp || '-'}</td>
            <td class="copy-cell" data-log-text="${peerAddress}">${peerAddress}</td>
            <td>${event.keyType}</td>
            <td class="copy-cell" data-log-text="${event.keyValue}"><span style="font-family: monospace; font-size: 0.9em;">${event.keyValue}</span></td>
            <td class="copy-cell" data-log-text="${event.data || '-'}"><span style="font-family: monospace; font-size: 0.85em; display: block; word-break: break-all; white-space: normal;">${event.data || '-'}</span></td> 
        </tr>`;
    }
    tableElement.innerHTML = keyTableHtml;
}

/**
 * Sets up the BLE Keys tab (filters, sorting, resizing).
 * @param {string} tableId - The ID of the table element.
 */
export function setupBleKeysTab(tableId = 'bleKeysTable') {
    makeSortable(tableId, 0, 'desc'); // Sort by Packet No

    if (document.getElementById(tableId)) {
        makeTableResizable(tableId);
    }
}
