import { renderVirtualList } from '../components/VirtualList.js';
import { wildcardToRegex } from '../../utils/regex.js';

/**
 * Sets up the Connectivity Tab (listeners).
 */
export function setupConnectivityTab(container, onScroll) {
    if (container) {
        container.addEventListener('scroll', onScroll);
        return true;
    }
    return false;
}

/**
 * Renders the connectivity logs using the virtual list.
 */
export function renderConnectivityLogs(container, sizer, viewport, lines, collapseState, filterKeywords, liveSearchQuery, userAnchorLine) {
    const activeKeywords = filterKeywords.filter(kw => kw.active).map(kw => kw.text);
    const keywordRegexes = activeKeywords.length > 0 ? activeKeywords.map(wildcardToRegex) : null;
    const liveSearchRegex = liveSearchQuery ? wildcardToRegex(liveSearchQuery) : null;

    renderVirtualList(container, sizer, viewport, lines, collapseState, {
        keywordRegexes,
        liveSearchRegex,
        selectedLine: userAnchorLine
    });
}

/**
 * Filters log lines based on active technologies and specific layer filters.
 * @param {Object} data - Source data arrays.
 * @param {Array} data.bleLogLines
 * @param {Array} data.nfcLogLines
 * @param {Array} data.dckLogLines
 * @param {Array} data.uwbLogLines
 * @param {Array} data.walletLogLines
 * @param {Object} activeTechs - State of master toggles { ble: boolean, nfc: boolean ... }
 * @param {Object} activeLayers - State of specific layer filters { ble: Set<string>, nfc: Set<string> ... }
 * @returns {Array} - The combined, sorted, and filtered list of log lines (before generic search/time filtering).
 */
export function filterConnectivityLogs(data, activeTechs, activeLayers) {
    const candidates = [];
    const usedIds = new Set();
    const addLine = (line) => {
        // Use line index as unique identifier to prevent duplicates
        if (!usedIds.has(line.index)) {
            candidates.push(line);
            usedIds.add(line.index);
        }
    };

    // BLE Logic
    if (activeTechs.ble) {
        const bleKeywords = {
            manager: /Bluetooth|BLE|bt_/i,
            gatt: /GATT|BtGatt|BluetoothGatt|bt_att|bt_gatt/i,
            smp: /SMP|bt_smp/i,
            hci: /HCI|bt_hci/i
        };
        const bleLayers = activeLayers.ble || new Set();

        data.bleLogLines.forEach(line => {
            if (line.isMeta) {
                addLine(line); return;
            }

            // If no specific layers selected, show all BLE logs
            if (activeLayers.ble.size === 0) {
                addLine(line);
                return;
            }

            // Check for specific tech keywords (Always show Core Bluetooth even if layers selected)
            if (/Bluetooth|bt_/i.test(line.originalText)) {
                addLine(line);
                return;
            }

            const hit = Array.from(bleLayers).some(layer => bleKeywords[layer]?.test(line.originalText));
            if (hit) {
                addLine(line);
            }
        });
    }

    // NFC Logic
    if (activeTechs.nfc) {
        const nfcKeywords = {
            framework: /NFC|NfcManager|NfcService|TagDispatcher|NfcTag|P2pLinkManager/i,
            hce: /HostEmulationManager|ApduServiceInfo/i,
            p2p: /P2pLinkManager/i,
            hal: /NxpNci|NxpExtns|libnfc|libnfc-nci|StNfcHal/i
        };
        const nfcLayers = activeLayers.nfc || new Set();

        data.nfcLogLines.forEach(line => {
            if (line.isMeta) {
                addLine(line); return;
            }
            if (nfcLayers.size === 0) {
                return;
            }



            const hit = Array.from(nfcLayers).some(layer => nfcKeywords[layer]?.test(line.originalText));
            if (hit) {
                addLine(line);
            }
        });
    }

    // DCK Logic
    if (activeTechs.dck) {
        data.dckLogLines.forEach(line => addLine(line)); // No sub-filters yet
    }

    // UWB Logic
    if (activeTechs.uwb) {
        data.uwbLogLines.forEach(line => addLine(line));
    }

    // Wallet Logic
    if (activeTechs.wallet) {
        data.walletLogLines.forEach(line => addLine(line));
    }

    // Sort by index to maintain chronological order
    candidates.sort((a, b) => a.index - b.index);

    return candidates;
}
