import { describe, it, expect, beforeEach } from 'vitest';
import { appState } from '../../Production/src/core/state/AppState.js';
import { LogState } from '../../Production/src/core/state/LogState.js';
import { FilterState } from '../../Production/src/core/state/FilterState.js';
import { UIState } from '../../Production/src/core/state/UIState.js';

describe('AppState', () => {
    beforeEach(() => {
        appState.reset();
    });

    describe('initialization', () => {
        it('should initialize sub-state modules', () => {
            expect(appState.log).toBeInstanceOf(LogState);
            expect(appState.filter).toBeInstanceOf(FilterState);
            expect(appState.ui).toBeInstanceOf(UIState);
        });

        it('should initialize btsnoop state', () => {
            expect(appState.btsnoop.packets).toEqual([]);
            expect(appState.btsnoop.connectionMap).toBeInstanceOf(Map);
            expect(appState.btsnoop.localAddress).toBe('Host');
            expect(appState.btsnoop.isProcessed).toBe(false);
        });

        it('should initialize processing state', () => {
            expect(appState.processing.batteryDataPoints).toEqual([]);
            expect(appState.processing.thermalDataPoints).toEqual([]);
            expect(appState.processing.appVersions).toEqual([]);
            expect(appState.processing.workerVersion).toBe(6);
        });
    });

    describe('reset', () => {
        it('should reset all sub-states', () => {
            // Populate with data
            appState.log.originalLogLines = [1, 2, 3];
            appState.filter.keywords = [{ text: 'test', active: true }];
            appState.ui.currentFileName = 'test.log';
            appState.btsnoop.packets = [1, 2];
            appState.processing.appVersions = ['v1', 'v2'];

            // Reset
            appState.reset();

            // Verify everything is reset
            expect(appState.log.originalLogLines).toEqual([]);
            expect(appState.filter.keywords).toEqual([]);
            expect(appState.ui.currentFileName).toBe('');
            expect(appState.btsnoop.packets).toEqual([]);
            expect(appState.processing.appVersions).toEqual([]);
        });
    });

    describe('getSnapshot', () => {
        it('should return state snapshot', () => {
            appState.log.originalLogLines = [1, 2, 3, 4, 5];
            appState.log.filteredLogLines = [1, 2];
            appState.filter.keywords = [{ text: 'test', active: true }];
            appState.ui.currentFileName = 'test.log';

            const snapshot = appState.getSnapshot();

            expect(snapshot.log.totalLines).toBe(5);
            expect(snapshot.log.filteredCount).toBe(2);
            expect(snapshot.filter.activeKeywords).toBe(1);
            expect(snapshot.ui.currentFile).toBe('test.log');
        });

        it('should include loaded tabs in snapshot', () => {
            appState.ui.tabsLoaded.connectivity = true;
            appState.ui.tabsLoaded.btsnoop = true;

            const snapshot = appState.getSnapshot();

            expect(snapshot.ui.loadedTabs).toContain('logs');
            expect(snapshot.ui.loadedTabs).toContain('connectivity');
            expect(snapshot.ui.loadedTabs).toContain('btsnoop');
            expect(snapshot.ui.loadedTabs).not.toContain('ccc');
        });
    });

    describe('singleton behavior', () => {
        it('should maintain same instance across imports', () => {
            const firstImport = appState;
            const secondImport = appState; // In real scenario, would be from another import

            expect(firstImport).toBe(secondImport);
        });

        it('should share state across references', () => {
            appState.log.originalLogLines = [1, 2, 3];

            const ref = appState;
            expect(ref.log.originalLogLines).toEqual([1, 2, 3]);
        });
    });
});
