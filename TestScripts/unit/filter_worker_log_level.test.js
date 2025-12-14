import { describe, it, expect, beforeEach } from 'vitest';
import { runFilter } from '../../Production/src/infra/workers/filter.worker.js';

describe('Filter Worker - Log Lines Without Level', () => {
    let testLines;

    beforeEach(() => {
        testLines = [
            {
                originalText: 'Line with verbose level',
                level: 'V',
                isMeta: false,
                dateObj: new Date('2025-01-01T10:00:00Z')
            },
            {
                originalText: 'Line WITHOUT any log level',
                level: undefined, // No log level
                isMeta: false,
                dateObj: new Date('2025-01-01T10:01:00Z')
            },
            {
                originalText: 'Another line without level',
                level: null, // Explicitly null
                isMeta: false,
                dateObj: new Date('2025-01-01T10:02:00Z')
            },
            {
                originalText: 'Line with debug level',
                level: 'D',
                isMeta: false,
                dateObj: new Date('2025-01-01T10:03:00Z')
            }
        ];
    });

    it('should include lines without log level when Verbose is enabled', () => {
        const config = {
            activeLogLevels: ['V', 'D', 'I', 'W', 'E'], // All levels including V
            activeKeywords: [],
            isAndLogic: false,
            liveSearchQuery: '',
            timeRange: { start: null, end: null },
            collapsedFileHeaders: [],
            isTimeFilterActive: false
        };

        const indices = runFilter(testLines, config);

        // Should include all 4 lines (lines without level default to V)
        expect(indices).toHaveLength(4);
        expect(indices).toContain(0); // Line with V
        expect(indices).toContain(1); // Line without level (should be treated as V)
        expect(indices).toContain(2); // Line with null level (should be treated as V)
        expect(indices).toContain(3); // Line with D
    });

    it('should exclude lines without log level when Verbose is disabled', () => {
        const config = {
            activeLogLevels: ['D', 'I', 'W', 'E'], // V is NOT enabled
            activeKeywords: [],
            isAndLogic: false,
            liveSearchQuery: '',
            timeRange: { start: null, end: null },
            collapsedFileHeaders: [],
            isTimeFilterActive: false
        };

        const indices = runFilter(testLines, config);

        // Should only include line with D (index 3)
        // Lines without level should be filtered out since V is not enabled
        expect(indices).toHaveLength(1);
        expect(indices).toContain(3); // Only line with D
        expect(indices).not.toContain(0); // V is filtered out
        expect(indices).not.toContain(1); // No level (treated as V) is filtered out
        expect(indices).not.toContain(2); // Null level (treated as V) is filtered out
    });

    it('should handle empty string as log level', () => {
        const linesWithEmpty = [
            {
                originalText: 'Line with empty string level',
                level: '', // Empty string
                isMeta: false,
                dateObj: new Date('2025-01-01T10:00:00Z')
            }
        ];

        const config = {
            activeLogLevels: ['V'],
            activeKeywords: [],
            isAndLogic: false,
            liveSearchQuery: '',
            timeRange: { start: null, end: null },
            collapsedFileHeaders: [],
            isTimeFilterActive: false
        };

        const indices = runFilter(linesWithEmpty, config);

        // Empty string should be treated as V
        expect(indices).toHaveLength(1);
        expect(indices).toContain(0);
    });
});
