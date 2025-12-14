import { describe, it, expect, beforeEach } from 'vitest';
import {
    computeFilterStateHash,
    needsRefiltering,
    cacheFilteredResults,
    getCachedResults,
    clearFilterCache,
    applyMainFilters,
    applyFiltersAsync,
    resetFilterManager
} from '../../Production/src/filters/FilterManager.js';

describe('FilterManager', () => {
    beforeEach(() => {
        resetFilterManager();
    });

    describe('computeFilterStateHash', () => {
        it('should generate consistent hash for same config', () => {
            const config = {
                activeLogLevels: new Set(['D', 'I', 'E']),
                keywords: [{ text: 'test', active: true }],
                isAndLogic: false,
                liveSearchQuery: 'search',
                startTime: '10:00:00',
                endTime: '11:00:00'
            };

            const hash1 = computeFilterStateHash(config);
            const hash2 = computeFilterStateHash(config);
            expect(hash1).toBe(hash2);
        });

        it('should generate different hash for different configs', () => {
            const config1 = {
                activeLogLevels: new Set(['D', 'I']),
                keywords: [],
                isAndLogic: false
            };

            const config2 = {
                activeLogLevels: new Set(['E', 'W']),
                keywords: [],
                isAndLogic: false
            };

            const hash1 = computeFilterStateHash(config1);
            const hash2 = computeFilterStateHash(config2);
            expect(hash1).not.toBe(hash2);
        });

        it('should handle empty config', () => {
            const hash = computeFilterStateHash({});
            expect(hash).toBeTruthy();
        });
    });

    describe('Filter Cache', () => {
        it('should cache and retrieve results', () => {
            const results = [{ line: 1 }, { line: 2 }];
            cacheFilteredResults('logs', 'hash123', results);

            const cached = getCachedResults('logs');
            expect(cached).toEqual(results);
        });

        it('should return null for non-existent cache', () => {
            const cached = getCachedResults('nonexistent');
            expect(cached).toBeNull();
        });

        it('should clear specific cache', () => {
            cacheFilteredResults('logs', 'hash1', [1, 2, 3]);
            cacheFilteredResults('btsnoop', 'hash2', [4, 5, 6]);

            clearFilterCache('logs');

            expect(getCachedResults('logs')).toBeNull();
            expect(getCachedResults('btsnoop')).not.toBeNull();
        });

        it('should clear all caches', () => {
            cacheFilteredResults('logs', 'hash1', [1, 2, 3]);
            cacheFilteredResults('btsnoop', 'hash2', [4, 5, 6]);

            clearFilterCache();

            expect(getCachedResults('logs')).toBeNull();
            expect(getCachedResults('btsnoop')).toBeNull();
        });
    });

    describe('needsRefiltering', () => {
        it('should return true when no cache exists', () => {
            expect(needsRefiltering('logs', 'hash123')).toBe(true);
        });

        it('should return false when hash matches', () => {
            cacheFilteredResults('logs', 'hash123', []);
            expect(needsRefiltering('logs', 'hash123')).toBe(false);
        });

        it('should return true when hash differs', () => {
            cacheFilteredResults('logs', 'hash123', []);
            expect(needsRefiltering('logs', 'hash456')).toBe(true);
        });
    });

    describe('applyMainFilters', () => {
        const sampleLines = [
            { isMeta: true, originalText: '--- File 1 ---' },
            { level: 'D', originalText: 'Debug message', timestamp: '10:00:00' },
            { level: 'I', originalText: 'Info message', timestamp: '10:00:01' },
            { level: 'E', originalText: 'Error message', timestamp: '10:00:02' },
            { level: 'W', originalText: 'Warning message', timestamp: '10:00:03' }
        ];

        it('should filter by log level', () => {
            const config = {
                activeLogLevels: new Set(['E', 'W'])
            };

            const result = applyMainFilters(
                sampleLines,
                { isInside: false },
                new Set(),
                config
            );

            // Should include meta line + 2 error/warning lines
            expect(result.length).toBe(3);
            expect(result[0].isMeta).toBe(true);
            expect(result[1].level).toBe('E');
            expect(result[2].level).toBe('W');
        });

        it('should filter by keyword', () => {
            const config = {
                activeLogLevels: new Set(['D', 'I', 'E', 'W']),
                keywords: [{ text: 'Error', active: true }]
            };

            const result = applyMainFilters(
                sampleLines,
                { isInside: false },
                new Set(),
                config
            );

            expect(result.length).toBe(2); // Meta + Error line
            expect(result[1].originalText).toContain('Error');
        });

        it('should filter with AND logic', () => {
            const lines = [
                { level: 'D', originalText: 'Test Debug message' },
                { level: 'I', originalText: 'Test message' },
                { level: 'E', originalText: 'Debug message' }
            ];

            const config = {
                activeLogLevels: new Set(['D', 'I', 'E']),
                keywords: [
                    { text: 'Test', active: true },
                    { text: 'Debug', active: true }
                ],
                isAndLogic: true
            };

            const result = applyMainFilters(
                lines,
                { isInside: false },
                new Set(),
                config
            );

            expect(result.length).toBe(1);
            expect(result[0].originalText).toBe('Test Debug message');
        });

        it('should filter with OR logic', () => {
            const lines = [
                { level: 'D', originalText: 'Test message' },
                { level: 'I', originalText: 'Debug message' },
                { level: 'E', originalText: 'Other message' }
            ];

            const config = {
                activeLogLevels: new Set(['D', 'I', 'E']),
                keywords: [
                    { text: 'Test', active: true },
                    { text: 'Debug', active: true }
                ],
                isAndLogic: false
            };

            const result = applyMainFilters(
                lines,
                { isInside: false },
                new Set(),
                config
            );

            expect(result.length).toBe(2);
        });

        it('should filter by live search', () => {
            const config = {
                activeLogLevels: new Set(['D', 'I', 'E', 'W']),
                liveSearchQuery: 'Error'
            };

            const result = applyMainFilters(
                sampleLines,
                { isInside: false },
                new Set(),
                config
            );

            expect(result.length).toBe(2); // Meta + Error line
        });

        it('should filter by time range', () => {
            const config = {
                activeLogLevels: new Set(['D', 'I', 'E', 'W']),
                startTime: '10:00:01',
                endTime: '10:00:02'
            };

            const result = applyMainFilters(
                sampleLines,
                { isInside: false },
                new Set(),
                config
            );

            expect(result.length).toBe(3); // Meta + 2 lines in range
        });

        it('should handle collapsed headers', () => {
            const config = {
                activeLogLevels: new Set(['D', 'I', 'E', 'W'])
            };

            const result = applyMainFilters(
                sampleLines,
                { isInside: false },
                new Set(['--- File 1 ---']),
                config
            );

            // Should only include the meta line
            expect(result.length).toBe(1);
            expect(result[0].isMeta).toBe(true);
        });

        it('should always include meta lines', () => {
            const config = {
                activeLogLevels: new Set([]) // No levels selected
            };

            const result = applyMainFilters(
                sampleLines,
                { isInside: false },
                new Set(),
                config
            );

            expect(result.length).toBe(1);
            expect(result[0].isMeta).toBe(true);
        });
    });

    describe('applyFiltersAsync', () => {
        it('should filter lines asynchronously', async () => {
            const lines = Array.from({ length: 100 }, (_, i) => ({
                level: 'D',
                originalText: `Line ${i}`,
                timestamp: `10:00:${String(i).padStart(2, '0')}`
            }));

            const config = {
                activeLogLevels: new Set(['D'])
            };

            const result = await applyFiltersAsync(lines, config, {
                chunkSize: 10
            });

            expect(result).not.toBeNull();
            expect(result.length).toBe(100);
        });

        it('should call progress callback', async () => {
            const lines = Array.from({ length: 100 }, (_, i) => ({
                level: 'D',
                originalText: `Line ${i}`
            }));

            const config = {
                activeLogLevels: new Set(['D'])
            };

            const progressValues = [];
            await applyFiltersAsync(lines, config, {
                chunkSize: 10,
                onProgress: (progress) => progressValues.push(progress)
            });

            expect(progressValues.length).toBeGreaterThan(0);
        });

        it('should handle empty lines', async () => {
            const result = await applyFiltersAsync([], {});
            expect(result).toEqual([]);
        });
    });
});
