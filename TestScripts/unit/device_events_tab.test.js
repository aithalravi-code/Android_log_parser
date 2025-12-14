import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderDeviceEvents, setupDeviceEventsTab } from '../../Production/src/ui/tabs/DeviceEventsTab.js';

describe('DeviceEventsTab', () => {
    let tableBody;
    let tableElement;

    beforeEach(() => {
        document.body.innerHTML = `
            <table id="deviceEventsTable">
                <tbody></tbody>
            </table>
        `;
        tableElement = document.getElementById('deviceEventsTable'); // For makeSortable
        tableBody = tableElement.querySelector('tbody');
    });

    describe('renderDeviceEvents', () => {
        it('should render "No events found" when empty', () => {
            renderDeviceEvents([], tableBody);
            expect(tableBody.innerHTML).toContain('No specific device or setting events found');
            expect(tableBody.querySelectorAll('tr').length).toBe(1);
        });

        it('should render events correctly', () => {
            const events = [
                {
                    timestamp: '2023-01-01 10:00:00.000',
                    date: '2023-01-01',
                    time: '10:00:00.000',
                    event: 'Screen',
                    detail: 'On',
                    originalText: 'Screen turned On'
                }
            ];

            renderDeviceEvents(events, tableBody);
            const rows = tableBody.querySelectorAll('tr');
            expect(rows.length).toBe(1);
            expect(rows[0].innerHTML).toContain('Screen');
            expect(rows[0].innerHTML).toContain('On');
        });

        it('should only render when state changes', () => {
            const events = [
                { timestamp: '10:00', event: 'WiFi', detail: 'Connected' },
                { timestamp: '10:01', event: 'WiFi', detail: 'Connected' }, // Duplicate state, should skip
                { timestamp: '10:02', event: 'WiFi', detail: 'Disconnected' } // Changed state, should render
            ];

            renderDeviceEvents(events, tableBody);
            const rows = tableBody.querySelectorAll('tr');
            expect(rows.length).toBe(2);
            expect(rows[0].innerHTML).toContain('Connected'); // First occurrence
            expect(rows[1].innerHTML).toContain('Disconnected'); // Change
            expect(rows[1].innerHTML).toContain('Connected'); // Previous value check
        });

        it('should sort events by timestamp', () => {
            const events = [
                { timestamp: '10:02', time: '10:02', event: 'A', detail: '1' },
                { timestamp: '10:00', time: '10:00', event: 'A', detail: '0' },
                { timestamp: '10:01', time: '10:01', event: 'A', detail: '1' }
            ];
            // Sorted: 10:00 (val 0), 10:01 (val 1, change), 10:02 (val 1, no change -> skip)

            renderDeviceEvents(events, tableBody);
            const rows = tableBody.querySelectorAll('tr');

            // 1. 10:00 -> value 0
            // 2. 10:01 -> value 1 (Changed from 0)
            // 3. 10:02 -> value 1 (Same as 10:01, skip)

            expect(rows.length).toBe(2);
            expect(rows[0].innerHTML).toContain('10:00');
            expect(rows[1].innerHTML).toContain('10:01');
        });
    });
});
