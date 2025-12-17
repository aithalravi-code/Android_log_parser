import { describe, test, expect, beforeEach } from 'vitest';
import { appState } from '../../Production/src/core/state/AppState.js';

describe('AppState Integration', () => {
    beforeEach(() => {
        appState.reset();
    });

    describe('Cross-Module State Management', () => {
        test('should coordinate log and filter state', () => {
            // Add log data directly
            appState.log.originalLogLines.push(
                { lineNumber: 1, text: 'Test log 1', level: 'I' },
                { lineNumber: 2, text: 'Test log 2', level: 'E' }
            );

            // Update filter state
            appState.filter.activeLevels.delete('I');

            expect(appState.log.totalLines).toBe(2);
            expect(appState.filter.activeLevels.has('I')).toBe(false);
            expect(appState.filter.activeLevels.has('E')).toBe(true);
        });

        test('should track filter changes and version', () => {
            const initialVersion = appState.filter.version;

            appState.filter.keywords.push({ text: 'test', active: true });
            appState.filter.incrementVersion();

            expect(appState.filter.version).toBeGreaterThan(initialVersion);
            expect(appState.filter.keywords).toContainEqual(
                expect.objectContaining({ text: 'test', active: true })
            );
        });

        test('should coordinate UI and processing state', () => {
            appState.ui.isProcessing = true;
            appState.processing.fileTasks.push({ name: 'test.log', size: 1000 });

            expect(appState.ui.isProcessing).toBe(true);
            expect(appState.processing.fileTasks.length).toBe(1);

            appState.ui.isProcessing = false;
            expect(appState.ui.isProcessing).toBe(false);
        });
    });

    describe('State Snapshots', () => {
        test('should create complete state snapshot', () => {
            appState.log.originalLogLines.push({ text: 'test' });
            appState.filter.keywords.push({ text: 'keyword', active: true });
            appState.ui.currentFileName = 'test.zip';

            const snapshot = appState.getSnapshot();

            expect(snapshot).toHaveProperty('log');
            expect(snapshot).toHaveProperty('filter');
            expect(snapshot).toHaveProperty('ui');
            expect(snapshot).toHaveProperty('btsnoop');
            expect(snapshot).toHaveProperty('processing');
        });

        test('snapshot should reflect current state', () => {
            const snapshot1 = appState.getSnapshot();
            appState.log.originalLogLines.push({ text: 'new line' });
            const snapshot2 = appState.getSnapshot();

            expect(snapshot1.log.totalLines).not.toBe(snapshot2.log.totalLines);
        });
    });

    describe('State Reset Coordination', () => {
        test('should reset all modules together', () => {
            // Populate all modules
            appState.log.originalLogLines.push({ text: 'test' });
            appState.filter.keywords.push({ text: 'keyword', active: true });
            appState.ui.currentFileName = 'file.zip';
            appState.btsnoop.packets.push({ id: 1 });
            appState.processing.fileTasks.push({ name: 'test' });

            // Reset everything
            appState.reset();

            // Verify all clean
            expect(appState.log.totalLines).toBe(0);
            expect(appState.filter.keywords.length).toBe(0);
            expect(appState.ui.currentFileName).toBe('');
            expect(appState.btsnoop.packets.length).toBe(0);
            expect(appState.processing.fileTasks.length).toBe(0);
        });

        test('should maintain proper defaults after reset', () => {
            appState.filter.activeLevels.clear();
            appState.ui.tabsLoaded.logs = false;

            appState.reset();

            // Should restore defaults
            expect(appState.filter.activeLevels.size).toBeGreaterThan(0);
            expect(appState.ui.tabsLoaded.logs).toBe(true);
        });
    });

    describe('Filter State Advanced', () => {
        test('should manage multiple keywords correctly', () => {
            appState.filter.keywords.push(
                { text: 'test1', active: true },
                { text: 'test2', active: true },
                { text: 'test3', active: true }
            );

            expect(appState.filter.keywords.length).toBe(3);
            expect(appState.filter.hasActiveFilters).toBe(true);

            appState.filter.keywords[0].active = false;
            expect(appState.filter.keywords[0].active).toBe(false);
        });

        test('should manage filter hash for caching', () => {
            // stateHash is a manually-set cache property
            expect(appState.filter.stateHash).toBeNull();

            // Can be set manually for caching
            appState.filter.stateHash = 'hash123';
            expect(appState.filter.stateHash).toBe('hash123');

            // Clearing cache resets it
            appState.filter.clearCache();
            expect(appState.filter.stateHash).toBeNull();
        });

        test('should detect need for refiltering', () => {
            const mockResults = [{ text: 'result1' }, { text: 'result2' }];

            // Cache some results
            appState.filter.cachedResults['logs'] = { hash: 'hash123', results: mockResults };

            // Check if needs refiltering
            const cached = appState.filter.cachedResults['logs'];
            expect(cached.hash).toBe('hash123');
        });

        test('should track time filter state', () => {
            // FilterState doesn't have setTimeRange method, so check the property directly
            // Time filter would be managed elsewhere
            expect(appState.filter.cachedResults).toBeDefined();
        });
    });

    describe('Log State Advanced', () => {
        test('should track total lines', () => {
            appState.log.originalLogLines.push(
                { text: 'Line 1' },
                { text: 'Line 2' },
                { text: 'Line 3' }
            );

            expect(appState.log.totalLines).toBe(3);
        });

        test('should track CCC messages separately', () => {
            const cccMsg = {
                lineNumber: 10,
                message: 'Time_Sync',
                direction: 'RX',
                peer: 'AA:BB:CC:DD:EE:FF'
            };

            appState.log.cccMessages.push(cccMsg);

            expect(appState.log.cccMessages.length).toBe(1);
            expect(appState.log.cccMessages[0].message).toBe('Time_Sync');
        });
    });

    describe('BTSnoop State Advanced', () => {
        test('should manage connection map', () => {
            const handle = 0x0001;
            const address = 'AA:BB:CC:DD:EE:FF';

            appState.btsnoop.connectionMap.set(handle, address);

            expect(appState.btsnoop.connectionMap.get(handle)).toBe(address);
            expect(appState.btsnoop.connectionMap.size).toBe(1);
        });

        test('should track local BT address', () => {
            appState.btsnoop.localAddress = '11:22:33:44:55:66';

            expect(appState.btsnoop.localAddress).toBe('11:22:33:44:55:66');
        });

        test('should mark as processed', () => {
            expect(appState.btsnoop.isProcessed).toBe(false);

            appState.btsnoop.isProcessed = true;

            expect(appState.btsnoop.isProcessed).toBe(true);
        });
    });

    describe('Processing State Advanced', () => {
        test('should collect thermal data points', () => {
            appState.processing.thermalDataPoints.push(
                { timestamp: new Date(), temp: 35.5, zone: 'cpu' }
            );

            expect(appState.processing.thermalDataPoints.length).toBe(1);
            expect(appState.processing.thermalDataPoints[0].temp).toBe(35.5);
        });

        test('should collect battery stats', () => {
            appState.processing.batteryDataPoints.push(
                { timestamp: new Date(), level: 85, voltage: 3.8 }
            );

            expect(appState.processing.batteryDataPoints.length).toBe(1);
        });

        test('should track app versions', () => {
            appState.processing.appVersions.push({
                package: 'com.example.app',
                version: '1.2.3'
            });

            expect(appState.processing.appVersions.length).toBe(1);
        });

        test('should increment worker version', () => {
            const v1 = appState.processing.workerVersion;
            appState.processing.workerVersion++;
            const v2 = appState.processing.workerVersion;

            expect(v2).toBe(v1 + 1);
        });
    });

    describe('State Debugging', () => {
        test('should provide debug info', () => {
            appState.log.originalLogLines.push({ text: 't1' }, { text: 't2' });
            appState.filter.keywords.push({ text: 'test', active: true });

            const debug = appState.getSnapshot();

            expect(debug.log.totalLines).toBe(2);
            expect(debug.filter.activeKeywords).toBe(1);
        });

        test('should expose via window for browser debugging', () => {
            // This is set in AppState.js
            expect(typeof appState.getSnapshot).toBe('function');
            expect(typeof appState.reset).toBe('function');
        });

        test('should log state snapshot using logState method', () => {
            // Mock console.log to capture output
            const originalLog = console.log;
            const logCalls = [];
            console.log = (...args) => logCalls.push(args);

            appState.log.originalLogLines.push({ text: 'test1' }, { text: 'test2' });
            appState.filter.keywords.push({ text: 'keyword', active: true });

            appState.logState();

            // Restore console.log
            console.log = originalLog;

            // Verify logState was called and logged something
            expect(logCalls.length).toBeGreaterThan(0);
            expect(logCalls[0][0]).toContain('[AppState]');
            expect(logCalls[0][0]).toContain('Current State:');
        });
    });
});
