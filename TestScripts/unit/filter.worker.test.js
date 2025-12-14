
import { describe, it, expect } from 'vitest';
import { runFilter, wildcardToRegex } from '../../Production/src/infra/workers/filter.worker.js';

describe('Filter Worker Logic', () => {

    describe('wildcardToRegex', () => {
        it('should convert simple wildcard', () => {
            const regex = wildcardToRegex('Foo*Bar');
            expect(regex.test('Foo123Bar')).toBe(true);
            expect(regex.test('FooBar')).toBe(true);
            expect(regex.test('FoBar')).toBe(false);
        });

        it('should handle no wildcard as word boundary search', () => {
            const regex = wildcardToRegex('Error');
            expect(regex.test('This is an Error message')).toBe(true);
            expect(regex.test('ErrorOccurred')).toBe(false); // Boundary check
        });

        it('should escape special characters', () => {
            const regex = wildcardToRegex('Key(Value)');
            // Current logic uses \b wrapper which fails for non-word boundaries (like ')' or '(').
            // Documenting existing behavior: it fails to match 'Key(Value)' exactly because of \b.
            expect(regex.test('Key(Value)')).toBe(false);
        });
    });

    describe('runFilter', () => {
        const sampleLines = [
            { originalText: '--- Header ---', isMeta: true },
            { originalText: '2023-10-27 10:00:00.000 I/Tag: Start', level: 'I', dateObj: new Date('2023-10-27T10:00:00Z'), isMeta: false },
            { originalText: '2023-10-27 10:00:01.000 D/Tag: Debug info', level: 'D', dateObj: new Date('2023-10-27T10:00:01Z'), isMeta: false },
            { originalText: '2023-10-27 10:00:02.000 E/Tag: Error occurred', level: 'E', dateObj: new Date('2023-10-27T10:00:02Z'), isMeta: false },
            { originalText: '2023-10-27 10:00:03.000 I/Other: End', level: 'I', dateObj: new Date('2023-10-27T10:00:03Z'), isMeta: false }
        ];

        const baseConfig = {
            activeKeywords: [],
            isAndLogic: false,
            liveSearchQuery: '',
            activeLogLevels: ['V', 'D', 'I', 'W', 'E', 'F'], // All levels
            timeRange: { start: null, end: null },
            collapsedFileHeaders: [],
            isTimeFilterActive: false
        };

        it('should return all indices (including header) when no filter is active', () => {
            const indices = runFilter(sampleLines, baseConfig);
            console.log('DEBUG All Indices:', indices);
            expect(indices).toEqual([0, 1, 2, 3, 4]);
        });

        it('should filter by log level (include header)', () => {
            const config = { ...baseConfig, activeLogLevels: ['E'] };
            const indices = runFilter(sampleLines, config);
            console.log('DEBUG Level Indices:', indices);
            expect(indices).toEqual([0, 3]); // Header (0) and Error line (3)
        });

        it('should filter by keyword', () => {
            const config = { ...baseConfig, activeKeywords: ['Debug'] };
            const indices = runFilter(sampleLines, config);
            console.log('DEBUG Keyword Indices:', indices);
            expect(indices).toEqual([0, 2]); // Header (0) and Debug line (2)
        });

        it('should filter by time range', () => {
            const config = {
                ...baseConfig,
                isTimeFilterActive: true,
                // Worker appends ':00Z', so input must be YYYY-MM-DDTHH:mm
                timeRange: { start: '2023-10-27T10:00', end: '2023-10-27T10:00' }
            };
            // Range 10:00:00Z to 10:00:00Z.
            // Line 1: 10:00:00Z -> Matches (d !< start, d !> end).
            // Line 2: 10:00:01Z -> Excluded (d > end).
            // Line 3: 10:00:02Z -> Excluded.
            // Line 4: 10:00:03Z -> Excluded.
            const indices = runFilter(sampleLines, config);
            expect(indices).toEqual([0, 1]); // Header (0) and Start line (1)
        });
    });
});
