import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderBtsnoopConnectionEvents, processForBtsnoop, getBtsnoopPackets, setIsBtsnoopProcessed } from '../../Production/src/ui/tabs/BtsnoopTab.js';

describe('BtsnoopTab', () => {

    describe('renderBtsnoopConnectionEvents', () => {
        let table, tbody;
        beforeEach(() => {
            document.body.innerHTML = `
                <table id="btsnoopConnectionEventsTable">
                    <tbody></tbody>
                </table>
            `;
            table = document.getElementById('btsnoopConnectionEventsTable');
            tbody = table.querySelector('tbody');
        });

        it('should render correct number of rows', () => {
            const events = [
                { packetNum: 1, timestamp: '12:00:00', eventType: 'connect', handle: '0x0001', address: 'AA:BB:CC:DD:EE:FF', rawData: '010203' },
                { packetNum: 2, timestamp: '12:00:01', eventType: 'disconnect', handle: '0x0001', address: 'AA:BB:CC:DD:EE:FF', rawData: '040506' }
            ];
            renderBtsnoopConnectionEvents(events);
            expect(tbody.querySelectorAll('tr').length).toBe(2);
        });

        it('should handle empty events', () => {
            renderBtsnoopConnectionEvents([]);
            expect(tbody.textContent).toContain('No connection events found');
        });

        it('should format parameters correctly', () => {
            const events = [
                { packetNum: 1, parameters: 'Status: Success | Handle: 0x0001', eventType: 'connect', handle: '0x0001', address: 'AA:BB:CC:DD:EE:FF' }
            ];
            renderBtsnoopConnectionEvents(events);
            const row = tbody.querySelector('tr');
            expect(row.innerHTML).toContain('ccc-pair');
            expect(row.textContent).toContain('Status:');
            expect(row.textContent).toContain('Success');
        });
    });

    describe('processForBtsnoop', () => {
        // Mock Worker
        beforeEach(() => {
            setIsBtsnoopProcessed(false);

            document.body.innerHTML = `
                <div id="btsnoopLogContainer"></div>
                <div id="btsnoopLogSizer"></div>
                <div id="btsnoopLogViewport"></div>
                <div id="btsnoopHeader"><div></div></div>
                <div id="btsnoopToolbar"></div>
                <!-- Elements passed via deps usually, but setupBtsnoopTab might look for IDs too -->
                <div id="btsnoopInitialView"></div>
                <div id="btsnoopContentView"></div>
                <div id="btsnoopFilterContainer"></div>
                <button id="exportBtsnoopXlsxBtn"></button>
                <table id="btsnoopConnectionEventsTable"><tbody></tbody></table>
            `;

            global.Worker = class {
                constructor() {
                    setTimeout(() => {
                        if (this.onmessage) {
                            console.log('Mock Worker firing onmessage');
                            this.onmessage({ data: { type: 'complete', connectionMap: {} } });
                        } else {
                            console.log('Mock Worker onmessage NOT SET');
                        }
                    }, 100);
                }
                postMessage() { }
                terminate() { }
            };
            global.URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
            global.URL.revokeObjectURL = vi.fn();
        });

        it('should reject if DB is not open', async () => {
            const deps = { db: null, getDb: () => null };
            await expect(processForBtsnoop([{ path: 'btsnoop_hci.log' }], deps))
                .rejects.toEqual('DB not open'); // Matches line 147
        });

        it('should reject if UI elements missing', async () => {
            const deps = { db: {}, getDb: () => ({}), btsnoopInitialView: null };
            await expect(processForBtsnoop([{ path: 'btsnoop_hci.log' }], deps))
                .rejects.toContain('UI elements not found');
        });

        it('should handle no btsnoop files', async () => {
            console.log('Test: should handle no btsnoop files starting');
            // Mock localStorage to avoid cache clearing logic
            vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('2025-12-07-21:50');

            const deps = {
                db: {},
                getDb: () => ({}),
                TimeTracker: { start: vi.fn(), stop: vi.fn() },
                btsnoopInitialView: document.getElementById('btsnoopInitialView'),
                btsnoopContentView: document.getElementById('btsnoopContentView'),
                btsnoopFilterContainer: document.getElementById('btsnoopFilterContainer')
            };
            await processForBtsnoop([{ path: 'other.log' }], deps);
            expect(deps.TimeTracker.start).toHaveBeenCalled();
        });

        it('should start worker and resolve', async () => {
            // Mock alert
            window.alert = vi.fn();
            const deps = {
                db: {
                    transaction: () => {
                        const tx = {
                            objectStore: () => ({ clear: () => { } }),
                            oncomplete: null,
                            onerror: null
                        };
                        // Trigger oncomplete async to simulate DB operation finishing
                        setTimeout(() => { if (tx.oncomplete) tx.oncomplete(); }, 0);
                        return tx;
                    }
                },
                getDb: () => deps.db,
                saveData: vi.fn(),
                loadData: vi.fn(),
                TimeTracker: {
                    start: vi.fn(),
                    stop: vi.fn()
                },
                btsnoopInitialView: document.getElementById('btsnoopInitialView'),
                btsnoopContentView: document.getElementById('btsnoopContentView'),
                btsnoopFilterContainer: document.getElementById('btsnoopFilterContainer')
            };

            // Mock localStorage for version check
            const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('2025-12-07-21:50');

            const result = await processForBtsnoop([{ path: 'btsnoop_hci.log', file: { arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) } }], deps);

            expect(deps.TimeTracker.start).toHaveBeenCalled();
            expect(global.URL.createObjectURL).toHaveBeenCalled();
            expect(result.needsHighlightsUpdate).toBe(true);
        });
    });
});
