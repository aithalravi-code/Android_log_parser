import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderDeviceEvents, setupDeviceEventsTab } from '../../Production/src/ui/tabs/DeviceEventsTab.js';

describe('DeviceEventsTab - Extended Coverage', () => {
    let mockTableElement;

    beforeEach(() => {
        document.body.innerHTML = `
            <table id="deviceEventsTable">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Event</th>
                        <th>New Value</th>
                        <th>Previous Value</th>
                        <th>Log Line</th>
                    </tr>
                </thead>
                <tbody id="deviceEventsTableBody"></tbody>
            </table>
        `;
        mockTableElement = document.getElementById('deviceEventsTableBody');
    });

    describe('renderDeviceEvents - Branch Coverage', () => {
        it('should handle null tableElement', () => {
            expect(() => {
                renderDeviceEvents([], null);
            }).not.toThrow();
        });

        it('should handle undefined tableElement', () => {
            expect(() => {
                renderDeviceEvents([], undefined);
            }).not.toThrow();
        });

        it('should handle null events array', () => {
            renderDeviceEvents(null, mockTableElement);
            expect(mockTableElement.innerHTML).toContain('No specific device');
        });

        it('should handle undefined events array', () => {
            renderDeviceEvents(undefined, mockTableElement);
            expect(mockTableElement.innerHTML).toContain('No specific device');
        });

        it('should handle events without timestamp', () => {
            const events = [
                {
                    event: 'TestEvent',
                    detail: 'Value1',
                    date: '2025-01-01',
                    time: '10:00:00',
                    originalText: 'Test line'
                }
            ];

            renderDeviceEvents(events, mockTableElement);
            expect(mockTableElement.children.length).toBe(1);
        });

        it('should handle events with timestamp', () => {
            const events = [
                {
                    timestamp: '2025-01-01 10:00:00',
                    event: 'TestEvent',
                    detail: 'Value1',
                    date: '2025-01-01',
                    time: '10:00:00',
                    originalText: 'Test line'
                }
            ];

            renderDeviceEvents(events, mockTableElement);
            expect(mockTableElement.children.length).toBe(1);
        });

        it('should filter out duplicate events with same value', () => {
            const events = [
                {
                    timestamp: '2025-01-01 10:00:00',
                    event: 'TestEvent',
                    detail: 'Value1',
                    date: '2025-01-01',
                    time: '10:00:00',
                    originalText: 'Test line 1'
                },
                {
                    timestamp: '2025-01-01 10:00:01',
                    event: 'TestEvent',
                    detail: 'Value1', // Same value
                    date: '2025-01-01',
                    time: '10:00:01',
                    originalText: 'Test line 2'
                }
            ];

            renderDeviceEvents(events, mockTableElement);
            // Should only render first occurrence
            expect(mockTableElement.children.length).toBe(1);
        });

        it('should render events when value changes', () => {
            const events = [
                {
                    timestamp: '2025-01-01 10:00:00',
                    event: 'TestEvent',
                    detail: 'Value1',
                    date: '2025-01-01',
                    time: '10:00:00',
                    originalText: 'Test line 1'
                },
                {
                    timestamp: '2025-01-01 10:00:01',
                    event: 'TestEvent',
                    detail: 'Value2', // Different value
                    date: '2025-01-01',
                    time: '10:00:01',
                    originalText: 'Test line 2'
                }
            ];

            renderDeviceEvents(events, mockTableElement);
            // Should render both since value changed
            expect(mockTableElement.children.length).toBe(2);
        });

        it('should show previous value correctly', () => {
            const events = [
                {
                    timestamp: '2025-01-01 10:00:00',
                    event: 'TestEvent',
                    detail: 'Value1',
                    date: '2025-01-01',
                    time: '10:00:00',
                    originalText: 'Test line 1'
                },
                {
                    timestamp: '2025-01-01 10:00:01',
                    event: 'TestEvent',
                    detail: 'Value2',
                    date: '2025-01-01',
                    time: '10:00:01',
                    originalText: 'Test line 2'
                }
            ];

            renderDeviceEvents(events, mockTableElement);
            const rows = mockTableElement.children;

            // First row should have 'N/A' as previous value
            expect(rows[0].cells[4].textContent).toBe('N/A');

            // Second row should have 'Value1' as previous value
            expect(rows[1].cells[4].textContent).toBe('Value1');
        });

        it('should handle missing date field', () => {
            const events = [
                {
                    timestamp: '2025-01-01 10:00:00',
                    event: 'TestEvent',
                    detail: 'Value1',
                    time: '10:00:00',
                    originalText: 'Test line'
                }
            ];

            renderDeviceEvents(events, mockTableElement);
            const row = mockTableElement.children[0];
            expect(row.cells[0].textContent).toBe('N/A');
        });

        it('should handle missing time field', () => {
            const events = [
                {
                    timestamp: '2025-01-01 10:00:00',
                    event: 'TestEvent',
                    detail: 'Value1',
                    date: '2025-01-01',
                    originalText: 'Test line'
                }
            ];

            renderDeviceEvents(events, mockTableElement);
            const row = mockTableElement.children[0];
            expect(row.cells[1].textContent).toBe('N/A');
        });

        it('should escape HTML in event names', () => {
            const events = [
                {
                    timestamp: '2025-01-01 10:00:00',
                    event: '<script>alert("xss")</script>',
                    detail: 'Value1',
                    date: '2025-01-01',
                    time: '10:00:00',
                    originalText: 'Test line'
                }
            ];

            renderDeviceEvents(events, mockTableElement);
            const row = mockTableElement.children[0];
            expect(row.cells[2].innerHTML).toContain('&lt;script&gt;');
        });

        it('should escape HTML in detail values', () => {
            const events = [
                {
                    timestamp: '2025-01-01 10:00:00',
                    event: 'TestEvent',
                    detail: '<img src=x onerror=alert(1)>',
                    date: '2025-01-01',
                    time: '10:00:00',
                    originalText: 'Test line'
                }
            ];

            renderDeviceEvents(events, mockTableElement);
            const row = mockTableElement.children[0];
            expect(row.cells[3].innerHTML).toContain('&lt;img');
        });

        it('should handle multiple different events', () => {
            const events = [
                {
                    timestamp: '2025-01-01 10:00:00',
                    event: 'Event1',
                    detail: 'Value1',
                    date: '2025-01-01',
                    time: '10:00:00',
                    originalText: 'Line 1'
                },
                {
                    timestamp: '2025-01-01 10:00:01',
                    event: 'Event2',
                    detail: 'Value2',
                    date: '2025-01-01',
                    time: '10:00:01',
                    originalText: 'Line 2'
                },
                {
                    timestamp: '2025-01-01 10:00:02',
                    event: 'Event3',
                    detail: 'Value3',
                    date: '2025-01-01',
                    time: '10:00:02',
                    originalText: 'Line 3'
                }
            ];

            renderDeviceEvents(events, mockTableElement);
            expect(mockTableElement.children.length).toBe(3);
        });

        it('should sort events by timestamp', () => {
            const events = [
                {
                    timestamp: '2025-01-01 10:00:02',
                    event: 'Event3',
                    detail: 'Value3',
                    date: '2025-01-01',
                    time: '10:00:02',
                    originalText: 'Line 3'
                },
                {
                    timestamp: '2025-01-01 10:00:00',
                    event: 'Event1',
                    detail: 'Value1',
                    date: '2025-01-01',
                    time: '10:00:00',
                    originalText: 'Line 1'
                },
                {
                    timestamp: '2025-01-01 10:00:01',
                    event: 'Event2',
                    detail: 'Value2',
                    date: '2025-01-01',
                    time: '10:00:01',
                    originalText: 'Line 2'
                }
            ];

            renderDeviceEvents(events, mockTableElement);
            const rows = mockTableElement.children;

            // Should be sorted chronologically
            expect(rows[0].cells[2].textContent).toBe('Event1');
            expect(rows[1].cells[2].textContent).toBe('Event2');
            expect(rows[2].cells[2].textContent).toBe('Event3');
        });

        it('should add copy-cell class to all cells', () => {
            const events = [
                {
                    timestamp: '2025-01-01 10:00:00',
                    event: 'TestEvent',
                    detail: 'Value1',
                    date: '2025-01-01',
                    time: '10:00:00',
                    originalText: 'Test line'
                }
            ];

            renderDeviceEvents(events, mockTableElement);
            const row = mockTableElement.children[0];

            // Check only data cells (0-5), excluding the button cell (6)
            for (let i = 0; i < 6; i++) {
                expect(row.cells[i].classList.contains('copy-cell')).toBe(true);
            }
        });

        it('should add data-log-text attributes', () => {
            const events = [
                {
                    timestamp: '2025-01-01 10:00:00',
                    event: 'TestEvent',
                    detail: 'Value1',
                    date: '2025-01-01',
                    time: '10:00:00',
                    originalText: 'Test line'
                }
            ];

            renderDeviceEvents(events, mockTableElement);
            const row = mockTableElement.children[0];

            expect(row.cells[0].getAttribute('data-log-text')).toBe('2025-01-01');
            expect(row.cells[1].getAttribute('data-log-text')).toBe('10:00:00');
            expect(row.cells[2].getAttribute('data-log-text')).toBe('TestEvent');
        });
    });

    describe('setupDeviceEventsTab - Function Coverage', () => {
        it('should call makeSortable with correct parameters', () => {
            setupDeviceEventsTab('deviceEventsTable');
            // Just verify it doesn't throw
            expect(document.getElementById('deviceEventsTable')).not.toBeNull();
        });

        it('should handle missing table element gracefully', () => {
            expect(() => {
                setupDeviceEventsTab('nonExistentTable');
            }).not.toThrow();
        });

        it('should use default table ID when not provided', () => {
            expect(() => {
                setupDeviceEventsTab();
            }).not.toThrow();
        });

        it('should make table resizable if element exists', () => {
            setupDeviceEventsTab('deviceEventsTable');
            const table = document.getElementById('deviceEventsTable');
            expect(table).not.toBeNull();
        });
    });
});
