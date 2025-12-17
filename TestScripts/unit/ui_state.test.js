import { describe, test, expect, beforeEach } from 'vitest';
import { appState } from '../../Production/src/core/state/AppState.js';

describe('UIState', () => {
    beforeEach(() => {
        appState.reset();
    });

    describe('Tab Management', () => {
        test('should track loaded tabs correctly', () => {
            expect(appState.ui.tabsLoaded.logs).toBe(true);
            expect(appState.ui.tabsLoaded.btsnoop).toBe(false);

            appState.ui.tabsLoaded.btsnoop = true;
            expect(appState.ui.tabsLoaded.btsnoop).toBe(true);
        });

        test('should reset tabs loaded state', () => {
            appState.ui.tabsLoaded.btsnoop = true;
            appState.ui.tabsLoaded.ccc = true;

            appState.reset();

            expect(appState.ui.tabsLoaded.btsnoop).toBe(false);
            expect(appState.ui.tabsLoaded.ccc).toBe(false);
            expect(appState.ui.tabsLoaded.logs).toBe(true); // logs always loaded
        });

        test('should mark tab as loaded using markTabLoaded method', () => {
            expect(appState.ui.tabsLoaded.btsnoop).toBe(false);

            appState.ui.markTabLoaded('btsnoop');
            expect(appState.ui.tabsLoaded.btsnoop).toBe(true);

            appState.ui.markTabLoaded('ccc');
            expect(appState.ui.tabsLoaded.ccc).toBe(true);
        });

        test('should check if tab is loaded using isTabLoaded method', () => {
            expect(appState.ui.isTabLoaded('logs')).toBe(true);
            expect(appState.ui.isTabLoaded('btsnoop')).toBe(false);

            appState.ui.markTabLoaded('btsnoop');
            expect(appState.ui.isTabLoaded('btsnoop')).toBe(true);
        });

        test('should handle invalid tab id gracefully in markTabLoaded', () => {
            // Should not throw error for invalid tab id
            expect(() => {
                appState.ui.markTabLoaded('invalidTab');
            }).not.toThrow();
        });

        test('should return false for invalid tab id in isTabLoaded', () => {
            expect(appState.ui.isTabLoaded('invalidTab')).toBe(false);
        });
    });

    describe('Collapse State', () => {
        test('should manage log view collapse state', () => {
            const fileId = 'test-file.log';

            appState.ui.collapseState.logView.add(fileId);
            expect(appState.ui.collapseState.logView.has(fileId)).toBe(true);

            appState.ui.collapseState.logView.delete(fileId);
            expect(appState.ui.collapseState.logView.has(fileId)).toBe(false);
        });

        test('should clear collapse state on reset', () => {
            appState.ui.collapseState.logView.add('file1');
            appState.ui.collapseState.connectivityView.add('file2');
            appState.ui.collapseState.btsnoopFiles.add('file3');

            appState.reset();

            expect(appState.ui.collapseState.logView.size).toBe(0);
            expect(appState.ui.collapseState.connectivityView.size).toBe(0);
            expect(appState.ui.collapseState.btsnoopFiles.size).toBe(0);
        });

        test('should toggle collapse state using toggleCollapse', () => {
            const headerText = 'test-header.log';

            // Initially not collapsed
            expect(appState.ui.isCollapsed('logView', headerText)).toBe(false);

            // Toggle to collapse
            appState.ui.toggleCollapse('logView', headerText);
            expect(appState.ui.isCollapsed('logView', headerText)).toBe(true);

            // Toggle again to expand
            appState.ui.toggleCollapse('logView', headerText);
            expect(appState.ui.isCollapsed('logView', headerText)).toBe(false);
        });

        test('should check collapsed state using isCollapsed', () => {
            const header1 = 'header1.log';
            const header2 = 'header2.log';

            appState.ui.collapseState.connectivityView.add(header1);

            expect(appState.ui.isCollapsed('connectivityView', header1)).toBe(true);
            expect(appState.ui.isCollapsed('connectivityView', header2)).toBe(false);
        });

        test('should handle multiple views independently', () => {
            const headerText = 'same-header.log';

            appState.ui.toggleCollapse('logView', headerText);
            appState.ui.toggleCollapse('connectivityView', headerText);

            expect(appState.ui.isCollapsed('logView', headerText)).toBe(true);
            expect(appState.ui.isCollapsed('connectivityView', headerText)).toBe(true);
            expect(appState.ui.isCollapsed('btsnoopFiles', headerText)).toBe(false);
        });

        test('should handle invalid view gracefully in toggleCollapse', () => {
            // Should not throw error for invalid view
            expect(() => {
                appState.ui.toggleCollapse('invalidView', 'header.log');
            }).not.toThrow();
        });

        test('should return false for invalid view in isCollapsed', () => {
            expect(appState.ui.isCollapsed('invalidView', 'header.log')).toBe(false);
        });
    });

    describe('Time Filter', () => {
        test('should update time filter state', () => {
            const minDate = new Date('2025-01-01');
            const maxDate = new Date('2025-12-31');

            appState.ui.timeFilter.min = minDate;
            appState.ui.timeFilter.max = maxDate;
            appState.ui.timeFilter.isActive = true;

            expect(appState.ui.timeFilter.min).toEqual(minDate);
            expect(appState.ui.timeFilter.max).toEqual(maxDate);
            expect(appState.ui.timeFilter.isActive).toBe(true);
        });

        test('should reset time filter', () => {
            appState.ui.timeFilter.min = new Date();
            appState.ui.timeFilter.max = new Date();
            appState.ui.timeFilter.isActive = true;

            appState.reset();

            expect(appState.ui.timeFilter.min).toBeNull();
            expect(appState.ui.timeFilter.max).toBeNull();
            expect(appState.ui.timeFilter.isActive).toBe(false);
        });
    });

    describe('Table Sort State', () => {
        test('should manage table sort state', () => {
            appState.ui.tableSortState.cccStatsTable = { column: 1, order: 'desc' };

            expect(appState.ui.tableSortState.cccStatsTable.column).toBe(1);
            expect(appState.ui.tableSortState.cccStatsTable.order).toBe('desc');
        });

        test('should update sort state for multiple tables', () => {
            appState.ui.tableSortState.deviceEventsTable = { column: 0, order: 'asc' };
            appState.ui.tableSortState.bleKeysTable = { column: 2, order: 'desc' };

            expect(Object.keys(appState.ui.tableSortState).length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('Selected Rows', () => {
        test('should track selected table rows', () => {
            const mockRow = { id: '123', data: 'test' };
            appState.ui.selectedTableRows.cccStatsTable = [mockRow];

            expect(appState.ui.selectedTableRows.cccStatsTable).toContain(mockRow);
        });

        test('should allow multiple selected rows per table', () => {
            appState.ui.selectedTableRows.deviceEventsTable = [{ id: '1' }, { id: '2' }];

            expect(appState.ui.selectedTableRows.deviceEventsTable.length).toBe(2);
        });
    });

    describe('Processing State', () => {
        test('should track processing flag', () => {
            expect(appState.ui.isProcessing).toBe(false);

            appState.ui.isProcessing = true;
            expect(appState.ui.isProcessing).toBe(true);

            appState.reset();
            expect(appState.ui.isProcessing).toBe(false);
        });
    });

    describe('User Anchor', () => {
        test('should store user anchor line', () => {
            const mockLine = { lineNumber: 42, text: 'test log' };
            appState.ui.userAnchorLine = mockLine;

            expect(appState.ui.userAnchorLine).toEqual(mockLine);
        });

        test('should clear anchor on reset', () => {
            appState.ui.userAnchorLine = { lineNumber: 100 };

            appState.reset();

            expect(appState.ui.userAnchorLine).toBeNull();
        });
    });

    describe('Timers', () => {
        test('should manage timer references', () => {
            const timerId = setTimeout(() => { }, 1000);
            appState.ui.timers.save = timerId;

            expect(appState.ui.timers.save).toBe(timerId);

            clearTimeout(timerId);
        });

        test('should have all timer slots', () => {
            expect(appState.ui.timers).toHaveProperty('save');
            expect(appState.ui.timers).toHaveProperty('filter');
            expect(appState.ui.timers).toHaveProperty('mainScroll');
        });
    });

    describe('File Name', () => {
        test('should store current file name', () => {
            const fileName = 'bugreport-test.zip';
            appState.ui.currentFileName = fileName;

            expect(appState.ui.currentFileName).toBe(fileName);
        });

        test('should clear file name on reset', () => {
            appState.ui.currentFileName = 'test.zip';

            appState.reset();

            expect(appState.ui.currentFileName).toBe('');
        });
    });
});
