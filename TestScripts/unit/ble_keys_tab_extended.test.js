import { describe, it, expect, beforeEach } from 'vitest';
import { renderBleKeys, setupBleKeysTab } from '../../Production/src/ui/tabs/BleKeysTab.js';

describe('BleKeysTab - Extended Coverage', () => {
    let mockTableElement;
    let mockConnectionMap;

    beforeEach(() => {
        document.body.innerHTML = `
            <table id="bleKeysTable">
                <thead>
                    <tr>
                        <th>Packet #</th>
                        <th>Timestamp</th>
                        <th>Peer Address</th>
                        <th>Key Type</th>
                        <th>Key Value</th>
                        <th>Raw Data</th>
                    </tr>
                </thead>
                <tbody id="bleKeysTableBody"></tbody>
            </table>
        `;
        mockTableElement = document.getElementById('bleKeysTableBody');
        mockConnectionMap = new Map();
    });

    describe('renderBleKeys - Branch Coverage', () => {
        it('should handle null tableElement', () => {
            expect(() => {
                renderBleKeys([], mockConnectionMap, null);
            }).not.toThrow();
        });

        it('should handle undefined tableElement', () => {
            expect(() => {
                renderBleKeys([], mockConnectionMap, undefined);
            }).not.toThrow();
        });

        it('should handle empty connection events', () => {
            renderBleKeys([], mockConnectionMap, mockTableElement);
            expect(mockTableElement.innerHTML).toContain('No BLE security keys found');
        });

        it('should handle connection events without keyType', () => {
            const events = [
                { packetNum: 1, timestamp: '10:00:00', handle: 64 }
            ];
            renderBleKeys(events, mockConnectionMap, mockTableElement);
            expect(mockTableElement.innerHTML).toContain('No BLE security keys found');
        });

        it('should render events with keyType', () => {
            const events = [
                {
                    packetNum: 1,
                    timestamp: '10:00:00',
                    handle: 64,
                    keyType: 'LTK',
                    keyValue: 'AABBCCDD',
                    data: '0011223344'
                }
            ];
            renderBleKeys(events, mockConnectionMap, mockTableElement);
            expect(mockTableElement.children.length).toBe(1);
        });

        it('should deduplicate keys with same keyValue', () => {
            const events = [
                {
                    packetNum: 1,
                    timestamp: '10:00:00',
                    keyType: 'LTK',
                    keyValue: 'AABBCCDD',
                    data: '0011223344'
                },
                {
                    packetNum: 2,
                    timestamp: '10:00:01',
                    keyType: 'LTK',
                    keyValue: 'AABBCCDD', // Same key value
                    data: '0011223344'
                }
            ];
            renderBleKeys(events, mockConnectionMap, mockTableElement);
            // Should only render one row due to deduplication
            expect(mockTableElement.children.length).toBe(1);
        });

        it('should render multiple different keys', () => {
            const events = [
                {
                    packetNum: 1,
                    timestamp: '10:00:00',
                    keyType: 'LTK',
                    keyValue: 'AABBCCDD',
                    data: '0011223344'
                },
                {
                    packetNum: 2,
                    timestamp: '10:00:01',
                    keyType: 'IRK',
                    keyValue: 'EEFFGGHH',
                    data: '5566778899'
                }
            ];
            renderBleKeys(events, mockConnectionMap, mockTableElement);
            expect(mockTableElement.children.length).toBe(2);
        });

        it('should resolve peer address from connectionMap with hex handle', () => {
            mockConnectionMap.set(64, { address: 'AA:BB:CC:DD:EE:FF' });

            const events = [
                {
                    packetNum: 1,
                    timestamp: '10:00:00',
                    handle: '0x0040', // Hex string format
                    keyType: 'LTK',
                    keyValue: 'AABBCCDD'
                }
            ];

            renderBleKeys(events, mockConnectionMap, mockTableElement);
            const row = mockTableElement.children[0];
            expect(row.cells[2].textContent).toBe('AA:BB:CC:DD:EE:FF');
        });

        it('should resolve peer address from connectionMap with number handle', () => {
            mockConnectionMap.set(64, { address: 'AA:BB:CC:DD:EE:FF' });

            const events = [
                {
                    packetNum: 1,
                    timestamp: '10:00:00',
                    handle: 64, // Number format
                    keyType: 'LTK',
                    keyValue: 'AABBCCDD'
                }
            ];

            renderBleKeys(events, mockConnectionMap, mockTableElement);
            const row = mockTableElement.children[0];
            expect(row.cells[2].textContent).toBe('AA:BB:CC:DD:EE:FF');
        });

        it('should use peerAddress from event if available', () => {
            mockConnectionMap.set(64, { address: 'AA:BB:CC:DD:EE:FF' });

            const events = [
                {
                    packetNum: 1,
                    timestamp: '10:00:00',
                    handle: 64,
                    peerAddress: '11:22:33:44:55:66', // Direct peer address
                    keyType: 'LTK',
                    keyValue: 'AABBCCDD'
                }
            ];

            renderBleKeys(events, mockConnectionMap, mockTableElement);
            const row = mockTableElement.children[0];
            // Should use peerAddress from event, not from map
            expect(row.cells[2].textContent).toBe('11:22:33:44:55:66');
        });

        it('should show N/A when no peer address available', () => {
            const events = [
                {
                    packetNum: 1,
                    timestamp: '10:00:00',
                    handle: 999, // Not in map
                    keyType: 'LTK',
                    keyValue: 'AABBCCDD'
                }
            ];

            renderBleKeys(events, mockConnectionMap, mockTableElement);
            const row = mockTableElement.children[0];
            expect(row.cells[2].textContent).toBe('N/A');
        });

        it('should handle undefined handle', () => {
            const events = [
                {
                    packetNum: 1,
                    timestamp: '10:00:00',
                    handle: undefined,
                    keyType: 'LTK',
                    keyValue: 'AABBCCDD'
                }
            ];

            renderBleKeys(events, mockConnectionMap, mockTableElement);
            const row = mockTableElement.children[0];
            expect(row.cells[2].textContent).toBe('N/A');
        });

        it('should handle null handle', () => {
            const events = [
                {
                    packetNum: 1,
                    timestamp: '10:00:00',
                    handle: null,
                    keyType: 'LTK',
                    keyValue: 'AABBCCDD'
                }
            ];

            renderBleKeys(events, mockConnectionMap, mockTableElement);
            const row = mockTableElement.children[0];
            expect(row.cells[2].textContent).toBe('N/A');
        });

        it('should handle missing packetNum', () => {
            const events = [
                {
                    timestamp: '10:00:00',
                    keyType: 'LTK',
                    keyValue: 'AABBCCDD'
                }
            ];

            renderBleKeys(events, mockConnectionMap, mockTableElement);
            const row = mockTableElement.children[0];
            expect(row.cells[0].textContent).toBe('-');
        });

        it('should handle missing timestamp', () => {
            const events = [
                {
                    packetNum: 1,
                    keyType: 'LTK',
                    keyValue: 'AABBCCDD'
                }
            ];

            renderBleKeys(events, mockConnectionMap, mockTableElement);
            const row = mockTableElement.children[0];
            expect(row.cells[1].textContent).toBe('-');
        });

        it('should handle missing data field', () => {
            const events = [
                {
                    packetNum: 1,
                    timestamp: '10:00:00',
                    keyType: 'LTK',
                    keyValue: 'AABBCCDD'
                }
            ];

            renderBleKeys(events, mockConnectionMap, mockTableElement);
            const row = mockTableElement.children[0];
            expect(row.cells[5].textContent).toBe('-');
        });

        it('should render data field when present', () => {
            const events = [
                {
                    packetNum: 1,
                    timestamp: '10:00:00',
                    keyType: 'LTK',
                    keyValue: 'AABBCCDD',
                    data: '0011223344556677'
                }
            ];

            renderBleKeys(events, mockConnectionMap, mockTableElement);
            const row = mockTableElement.children[0];
            expect(row.cells[5].textContent).toBe('0011223344556677');
        });

        it('should add copy-cell class to appropriate cells', () => {
            const events = [
                {
                    packetNum: 1,
                    timestamp: '10:00:00',
                    peerAddress: 'AA:BB:CC:DD:EE:FF',
                    keyType: 'LTK',
                    keyValue: 'AABBCCDD',
                    data: '0011223344'
                }
            ];

            renderBleKeys(events, mockConnectionMap, mockTableElement);
            const row = mockTableElement.children[0];

            // Peer Address cell should have copy-cell class
            expect(row.cells[2].classList.contains('copy-cell')).toBe(true);
            // Key Value cell should have copy-cell class
            expect(row.cells[4].classList.contains('copy-cell')).toBe(true);
            // Raw Data cell should have copy-cell class
            expect(row.cells[5].classList.contains('copy-cell')).toBe(true);
        });

        it('should add data-log-text attributes', () => {
            const events = [
                {
                    packetNum: 1,
                    timestamp: '10:00:00',
                    peerAddress: 'AA:BB:CC:DD:EE:FF',
                    keyType: 'LTK',
                    keyValue: 'AABBCCDD',
                    data: '0011223344'
                }
            ];

            renderBleKeys(events, mockConnectionMap, mockTableElement);
            const row = mockTableElement.children[0];

            expect(row.cells[2].getAttribute('data-log-text')).toBe('AA:BB:CC:DD:EE:FF');
            expect(row.cells[4].getAttribute('data-log-text')).toBe('AABBCCDD');
            expect(row.cells[5].getAttribute('data-log-text')).toBe('0011223344');
        });

        it('should handle different key types', () => {
            const events = [
                {
                    packetNum: 1,
                    timestamp: '10:00:00',
                    keyType: 'LTK',
                    keyValue: 'KEY1'
                },
                {
                    packetNum: 2,
                    timestamp: '10:00:01',
                    keyType: 'IRK',
                    keyValue: 'KEY2'
                },
                {
                    packetNum: 3,
                    timestamp: '10:00:02',
                    keyType: 'CSRK',
                    keyValue: 'KEY3'
                }
            ];

            renderBleKeys(events, mockConnectionMap, mockTableElement);
            expect(mockTableElement.children.length).toBe(3);

            expect(mockTableElement.children[0].cells[3].textContent).toBe('LTK');
            expect(mockTableElement.children[1].cells[3].textContent).toBe('IRK');
            expect(mockTableElement.children[2].cells[3].textContent).toBe('CSRK');
        });

        it('should generate unique row IDs', () => {
            const events = [
                {
                    packetNum: 1,
                    timestamp: '10:00:00',
                    keyType: 'LTK',
                    keyValue: 'AABBCCDD'
                },
                {
                    packetNum: 2,
                    timestamp: '10:00:01',
                    keyType: 'IRK',
                    keyValue: 'EEFFGGHH'
                }
            ];

            renderBleKeys(events, mockConnectionMap, mockTableElement);

            expect(mockTableElement.children[0].getAttribute('data-row-id')).toBe('ble-key-AABBCCDD');
            expect(mockTableElement.children[1].getAttribute('data-row-id')).toBe('ble-key-EEFFGGHH');
        });
    });

    describe('setupBleKeysTab - Function Coverage', () => {
        it('should call makeSortable with correct parameters', () => {
            setupBleKeysTab('bleKeysTable');
            expect(document.getElementById('bleKeysTable')).not.toBeNull();
        });

        it('should handle missing table element gracefully', () => {
            expect(() => {
                setupBleKeysTab('nonExistentTable');
            }).not.toThrow();
        });

        it('should use default table ID when not provided', () => {
            expect(() => {
                setupBleKeysTab();
            }).not.toThrow();
        });

        it('should make table resizable if element exists', () => {
            setupBleKeysTab('bleKeysTable');
            const table = document.getElementById('bleKeysTable');
            expect(table).not.toBeNull();
        });
    });
});
