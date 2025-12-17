import { describe, it, expect } from 'vitest';
import { filterConnectivityLogs } from '../../Production/src/ui/tabs/ConnectivityTab.js';

describe('ConnectivityTab Logic', () => {
    // Mock Data
    const mockData = {
        bleLogLines: [
            { index: 10, level: 'D', originalText: 'BluetoothAdapter: isLeEnabled', isMeta: false },
            { index: 20, level: 'D', originalText: 'BtGatt.Context: Client registered', isMeta: false },
            { index: 30, level: 'V', originalText: 'Some Verbose Log', isMeta: false },
            { index: 40, level: 'I', originalText: 'Irrelevant BLE Log', isMeta: false }
        ],
        nfcLogLines: [
            { index: 15, level: 'D', originalText: 'NfcService: Service started', isMeta: false },
            { index: 25, level: 'D', originalText: 'DiffTool: Ignored', isMeta: false } // Won't match regex
        ],
        dckLogLines: [
            { index: 35, level: 'I', originalText: 'DCK Event', isMeta: false }
        ],
        uwbLogLines: [],
        walletLogLines: []
    };

    it('should filter BLE logs correctly (Active, No Layers)', () => {
        // BLE active, No layers -> Should conform to logic:
        // "Allow Verbose lines to pass, OR lines that explicitly contain key tags regardless of level"
        // Line 10 (BluetoothAdapter) matches /Bluetooth/
        // Line 20 (BtGatt) is 'D', but matches /BtGatt/ -> Wait, logic says `if (activeLayers.size === 0) return;` unless it matches the core regex first.
        // Let's verify logic:
        // if (line.level === 'V' || /Bluetooth|bt_/i.test(line.originalText)) -> addLine
        // if (activeLayers.size === 0) return;

        // Line 10: Matches /Bluetooth/ -> Added.
        // Line 20: Matches /BtGatt/ -> Does NOT match /Bluetooth|bt_/. (Wait, 'BtGatt' contains 'Bt' but regex is 'bt_').
        // Line 30: Level V -> Added.
        // Line 40: Should be skipped if not V and not matching Core Regex?

        const activeTechs = { ble: true, nfc: false, dck: false, uwb: false, wallet: false };
        const activeLayers = { ble: new Set(), nfc: new Set() };

        const result = filterConnectivityLogs(mockData, activeTechs, activeLayers);

        expect(result.find(l => l.index === 10)).toBeDefined(); // Bluetooth matches
        expect(result.find(l => l.index === 30)).toBeDefined(); // V matches
        // Line 20 'BtGatt' doesnt match 'bt_' or 'Bluetooth'. 'BtGatt' != 'bt_'.
        expect(result.find(l => l.index === 20)).toBeUndefined();
        expect(result.find(l => l.index === 40)).toBeUndefined();
    });

    it('should filter BLE logs with Layers (GATT)', () => {
        const activeTechs = { ble: true };
        const activeLayers = { ble: new Set(['gatt']) };

        const result = filterConnectivityLogs(mockData, activeTechs, activeLayers);

        // Line 20 'BtGatt' matches gatt keywords
        expect(result.find(l => l.index === 20)).toBeDefined();
        // Line 10 still included (Core regex)
        expect(result.find(l => l.index === 10)).toBeDefined();
    });

    it('should merge multiple techs and sort', () => {
        const activeTechs = { ble: true, nfc: true, dck: true };
        const activeLayers = { ble: new Set(), nfc: new Set(['framework']) }; // NFC needs layer or V

        const result = filterConnectivityLogs(mockData, activeTechs, activeLayers);

        // Expected indices:
        // 10 (BLE Core)
        // 15 (NFC Framework)
        // 30 (BLE Verbose)
        // 35 (DCK All)

        const indices = result.map(l => l.index);
        expect(indices).toEqual([10, 15, 30, 35]);
    });

    it('should handle DCK logs (All included)', () => {
        const activeTechs = { dck: true };
        const activeLayers = { ble: new Set() };
        const result = filterConnectivityLogs(mockData, activeTechs, activeLayers);
        expect(result.find(l => l.index === 35)).toBeDefined();
    });
});
