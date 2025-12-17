import { describe, it, expect, beforeEach } from 'vitest';
import { FilterState } from '../../Production/src/core/state/FilterState.js';

describe('FilterState', () => {
    let filterState;

    beforeEach(() => {
        filterState = new FilterState();
    });

    describe('initialization', () => {
        it('should initialize with empty keywords', () => {
            expect(filterState.keywords).toEqual([]);
            expect(filterState.liveSearchQuery).toBe('');
        });

        it('should initialize with all log levels active', () => {
            expect(filterState.activeLevels.size).toBe(8);
            expect(filterState.activeLevels.has('V')).toBe(true);
            expect(filterState.activeLevels.has('D')).toBe(true);
            expect(filterState.activeLevels.has('I')).toBe(true);
        });

        it('should initialize with OR logic', () => {
            expect(filterState.isAndLogic).toBe(false);
        });

        it('should initialize with all techs active', () => {
            expect(filterState.activeTechs.ble).toBe(true);
            expect(filterState.activeTechs.nfc).toBe(true);
            expect(filterState.activeTechs.dck).toBe(true);
            expect(filterState.activeTechs.uwb).toBe(true);
            expect(filterState.activeTechs.wallet).toBe(true);
        });

        it('should initialize layer filters', () => {
            expect(filterState.activeLayers.ble.size).toBe(4);
            expect(filterState.activeLayers.nfc.size).toBe(4);
            expect(filterState.activeLayers.btsnoop.size).toBe(6);
        });
    });

    describe('reset', () => {
        it('should reset to default state', () => {
            // Modify state
            filterState.keywords = [{ text: 'test', active: true }];
            filterState.liveSearchQuery = 'search';
            filterState.activeLevels.clear();
            filterState.isAndLogic = true;

            // Reset
            filterState.reset();

            // Verify defaults
            expect(filterState.keywords).toEqual([]);
            expect(filterState.liveSearchQuery).toBe('');
            expect(filterState.activeLevels.size).toBe(8);
            expect(filterState.isAndLogic).toBe(false);
        });
    });

    describe('clearCache', () => {
        it('should clear all cached results', () => {
            filterState.stateHash = 'some-hash';
            filterState.cachedResults.logs = [1, 2, 3];
            filterState.cachedResults.btsnoop = [4, 5];

            filterState.clearCache();

            expect(filterState.stateHash).toBeNull();
            expect(filterState.cachedResults.logs).toBeNull();
            expect(filterState.cachedResults.btsnoop).toBeNull();
        });
    });

    describe('incrementVersion', () => {
        it('should increment filter version', () => {
            expect(filterState.version).toBe(0);

            const v1 = filterState.incrementVersion();
            expect(v1).toBe(1);
            expect(filterState.version).toBe(1);

            const v2 = filterState.incrementVersion();
            expect(v2).toBe(2);
            expect(filterState.version).toBe(2);
        });
    });

    describe('computed properties', () => {
        it('should return correct activeKeywordCount', () => {
            expect(filterState.activeKeywordCount).toBe(0);

            filterState.keywords = [
                { text: 'test1', active: true },
                { text: 'test2', active: false },
                { text: 'test3', active: true }
            ];

            expect(filterState.activeKeywordCount).toBe(2);
        });

        it('should detect active filters', () => {
            expect(filterState.hasActiveFilters).toBe(false);

            // Add keyword
            filterState.keywords = [{ text: 'test', active: true }];
            expect(filterState.hasActiveFilters).toBe(true);

            // Reset and add live search
            filterState.keywords = [];
            filterState.liveSearchQuery = 'search';
            expect(filterState.hasActiveFilters).toBe(true);

            // Reset and reduce log levels
            filterState.liveSearchQuery = '';
            filterState.activeLevels.clear();
            filterState.activeLevels.add('E');
            expect(filterState.hasActiveFilters).toBe(true);
        });
    });
});
