import { describe, it, expect, beforeEach } from 'vitest';
import { LogState } from '../../Production/src/core/state/LogState.js';

describe('LogState', () => {
    let logState;

    beforeEach(() => {
        logState = new LogState();
    });

    describe('initialization', () => {
        it('should initialize with empty arrays', () => {
            expect(logState.originalLogLines).toEqual([]);
            expect(logState.filteredLogLines).toEqual([]);
            expect(logState.cccMessages).toEqual([]);
            expect(logState.tags).toEqual([]);
        });

        it('should initialize technology logs', () => {
            expect(logState.byTechnology.ble).toEqual([]);
            expect(logState.byTechnology.nfc).toEqual([]);
            expect(logState.byTechnology.dck).toEqual([]);
            expect(logState.byTechnology.uwb).toEqual([]);
            expect(logState.byTechnology.wallet).toEqual([]);
        });

        it('should initialize filtered technology logs', () => {
            expect(logState.filteredByTechnology.ble).toEqual([]);
            expect(logState.filteredByTechnology.nfc).toEqual([]);
            expect(logState.filteredByTechnology.dck).toEqual([]);
            expect(logState.filteredByTechnology.wallet).toEqual([]);
        });
    });

    describe('reset', () => {
        it('should reset all log data', () => {
            // Populate with data
            logState.originalLogLines = [1, 2, 3];
            logState.filteredLogLines = [1, 2];
            logState.byTechnology.ble = [1];
            logState.cccMessages = [{ msg: 'test' }];
            logState.tags = ['tag1', 'tag2'];

            // Reset
            logState.reset();

            // Verify reset
            expect(logState.originalLogLines).toEqual([]);
            expect(logState.filteredLogLines).toEqual([]);
            expect(logState.byTechnology.ble).toEqual([]);
            expect(logState.cccMessages).toEqual([]);
            expect(logState.tags).toEqual([]);
        });
    });

    describe('computed properties', () => {
        it('should return correct totalLines count', () => {
            expect(logState.totalLines).toBe(0);

            logState.originalLogLines = [1, 2, 3, 4, 5];
            expect(logState.totalLines).toBe(5);
        });

        it('should return correct filteredCount', () => {
            expect(logState.filteredCount).toBe(0);

            logState.filteredLogLines = [1, 2, 3];
            expect(logState.filteredCount).toBe(3);
        });
    });
});
