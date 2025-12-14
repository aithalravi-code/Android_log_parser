import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderBleKeys, setupBleKeysTab } from '../../Production/src/ui/tabs/BleKeysTab.js';

describe('BleKeysTab', () => {
    let tableBody;
    let tableElement;

    beforeEach(() => {
        document.body.innerHTML = `
            <table id="bleKeysTable">
                <tbody></tbody>
            </table>
        `;
        tableElement = document.getElementById('bleKeysTable');
        tableBody = tableElement.querySelector('tbody');
    });

    describe('renderBleKeys', () => {
        it('should render "No keys found" when no key events exist', () => {
            const events = [{ type: 'CONNECT' }]; // No keyType
            renderBleKeys(events, new Map(), tableBody);
            expect(tableBody.innerHTML).toContain('No BLE security keys found');
        });

        it('should render key events correctly', () => {
            const events = [{
                keyType: 'LTK',
                keyValue: '112233',
                peerAddress: 'AA:BB:CC',
                timestamp: '12:34:56',
                packetNum: 100,
                data: 'Some Hex Data'
            }];

            renderBleKeys(events, new Map(), tableBody);
            const rows = tableBody.querySelectorAll('tr');
            expect(rows.length).toBe(1);
            expect(rows[0].innerHTML).toContain('LTK');
            expect(rows[0].innerHTML).toContain('112233');
            expect(rows[0].innerHTML).toContain('AA:BB:CC');
        });

        it('should resolve peer address from connection map using handle', () => {
            const events = [{
                keyType: 'IRK',
                keyValue: '998877',
                handle: '0x0010', // Hex handle
                timestamp: '12:34:56',
                packetNum: 101
            }];

            const connMap = new Map();
            connMap.set(16, { address: '11:22:33:44:55:66' }); // 0x10 = 16

            renderBleKeys(events, connMap, tableBody);

            const rows = tableBody.querySelectorAll('tr');
            expect(rows[0].innerHTML).toContain('11:22:33:44:55:66');
            expect(rows[0].innerHTML).toContain('IRK');
        });

        it('should deduplicate keys', () => {
            const events = [
                { keyType: 'LTK', keyValue: 'SAME_KEY', packetNum: 1 },
                { keyType: 'LTK', keyValue: 'SAME_KEY', packetNum: 2 } // Duplicate
            ];

            renderBleKeys(events, new Map(), tableBody);
            const rows = tableBody.querySelectorAll('tr');
            expect(rows.length).toBe(1);
        });
    });
});
