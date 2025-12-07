/**
 * Unit tests for log parsing functions
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Mock functions - these would be extracted from main.js
function parseLogLine(line) {
    // Handle null, undefined, or non-string inputs
    if (!line || typeof line !== 'string') return null;

    // Android logcat format: MM-DD HH:MM:SS.mmm  PID  TID LEVEL TAG: MESSAGE
    const match = line.match(/^(\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3})\s+(\d+)\s+(\d+)\s+([VDIWEF])\s+(.+?):\s+(.*)$/);

    if (!match) return null;

    return {
        timestamp: match[1],
        pid: match[2],
        tid: match[3],
        level: match[4],
        tag: match[5],
        message: match[6],
        originalText: line
    };
}

function filterLogsByLevel(logs, activeLevels) {
    return logs.filter(log => activeLevels.has(log.level));
}

function filterLogsByKeyword(logs, keyword, isAndLogic = false) {
    if (!keyword) return logs;

    const keywords = keyword.split(',').map(k => k.trim().toLowerCase());

    return logs.filter(log => {
        const text = log.originalText.toLowerCase();

        if (isAndLogic) {
            return keywords.every(kw => text.includes(kw));
        } else {
            return keywords.some(kw => text.includes(kw));
        }
    });
}

describe('Log Parsing', () => {
    describe('parseLogLine', () => {
        it('should parse a valid Android log line', () => {
            const line = '12-07 09:30:15.123  1234  5678 I MyTag: Test message';
            const result = parseLogLine(line);

            expect(result).toEqual({
                timestamp: '12-07 09:30:15.123',
                pid: '1234',
                tid: '5678',
                level: 'I',
                tag: 'MyTag',
                message: 'Test message',
                originalText: line
            });
        });

        it('should parse error level logs', () => {
            const line = '12-07 10:45:30.456  9999  8888 E ErrorTag: Something went wrong';
            const result = parseLogLine(line);

            expect(result).not.toBeNull();
            expect(result.level).toBe('E');
            expect(result.tag).toBe('ErrorTag');
            expect(result.message).toBe('Something went wrong');
        });

        it('should parse tags with underscores and numbers', () => {
            const line = '12-07 11:00:00.000  1111  2222 D Bluetooth_123: Connection established';
            const result = parseLogLine(line);

            expect(result).not.toBeNull();
            expect(result.tag).toBe('Bluetooth_123');
        });

        it('should return null for invalid log lines', () => {
            const invalidLines = [
                'Invalid log line',
                'Just some text',
                '12-07 09:30:15.123',
                '',
                null
            ];

            invalidLines.forEach(line => {
                const result = parseLogLine(line);
                expect(result).toBeNull();
            });
        });

        it('should handle messages with colons', () => {
            const line = '12-07 12:00:00.000  1234  5678 W MyTag: Error: Connection failed: timeout';
            const result = parseLogLine(line);

            expect(result).not.toBeNull();
            expect(result.message).toBe('Error: Connection failed: timeout');
        });

        it('should handle empty messages', () => {
            const line = '12-07 12:00:00.000  1234  5678 V MyTag: ';
            const result = parseLogLine(line);

            expect(result).not.toBeNull();
            expect(result.message).toBe('');
        });
    });

    describe('filterLogsByLevel', () => {
        let testLogs;

        beforeEach(() => {
            testLogs = [
                { level: 'E', message: 'Error 1', originalText: 'Error 1' },
                { level: 'W', message: 'Warning 1', originalText: 'Warning 1' },
                { level: 'I', message: 'Info 1', originalText: 'Info 1' },
                { level: 'D', message: 'Debug 1', originalText: 'Debug 1' },
                { level: 'V', message: 'Verbose 1', originalText: 'Verbose 1' },
                { level: 'E', message: 'Error 2', originalText: 'Error 2' }
            ];
        });

        it('should filter by single level', () => {
            const filtered = filterLogsByLevel(testLogs, new Set(['E']));

            expect(filtered).toHaveLength(2);
            expect(filtered.every(log => log.level === 'E')).toBe(true);
        });

        it('should filter by multiple levels', () => {
            const filtered = filterLogsByLevel(testLogs, new Set(['E', 'W']));

            expect(filtered).toHaveLength(3);
            expect(filtered.every(log => log.level === 'E' || log.level === 'W')).toBe(true);
        });

        it('should return all logs when all levels are active', () => {
            const filtered = filterLogsByLevel(testLogs, new Set(['V', 'D', 'I', 'W', 'E']));

            expect(filtered).toHaveLength(testLogs.length);
        });

        it('should return empty array when no levels match', () => {
            const filtered = filterLogsByLevel(testLogs, new Set([]));

            expect(filtered).toHaveLength(0);
        });
    });

    describe('filterLogsByKeyword', () => {
        let testLogs;

        beforeEach(() => {
            testLogs = [
                { originalText: 'Bluetooth connection established' },
                { originalText: 'WiFi scan completed' },
                { originalText: 'Bluetooth device paired' },
                { originalText: 'NFC tag detected' },
                { originalText: 'Bluetooth and WiFi active' }
            ];
        });

        it('should filter by single keyword (OR logic)', () => {
            const filtered = filterLogsByKeyword(testLogs, 'Bluetooth', false);

            expect(filtered).toHaveLength(3);
            expect(filtered.every(log => log.originalText.toLowerCase().includes('bluetooth'))).toBe(true);
        });

        it('should filter by multiple keywords (OR logic)', () => {
            const filtered = filterLogsByKeyword(testLogs, 'Bluetooth,WiFi', false);

            expect(filtered).toHaveLength(4);
        });

        it('should filter by multiple keywords (AND logic)', () => {
            const filtered = filterLogsByKeyword(testLogs, 'Bluetooth,WiFi', true);

            expect(filtered).toHaveLength(1);
            expect(filtered[0].originalText).toBe('Bluetooth and WiFi active');
        });

        it('should be case insensitive', () => {
            const filtered = filterLogsByKeyword(testLogs, 'BLUETOOTH', false);

            expect(filtered).toHaveLength(3);
        });

        it('should return all logs when keyword is empty', () => {
            const filtered = filterLogsByKeyword(testLogs, '', false);

            expect(filtered).toHaveLength(testLogs.length);
        });

        it('should handle keywords with spaces', () => {
            const filtered = filterLogsByKeyword(testLogs, 'connection established', false);

            expect(filtered).toHaveLength(1);
            expect(filtered[0].originalText).toBe('Bluetooth connection established');
        });
    });
});

describe('Performance', () => {
    it('should parse 10,000 log lines in under 1 second', () => {
        const startTime = performance.now();
        const testLine = '12-07 09:30:15.123  1234  5678 I MyTag: Test message';

        for (let i = 0; i < 10000; i++) {
            parseLogLine(testLine);
        }

        const duration = performance.now() - startTime;
        expect(duration).toBeLessThan(1000);

        console.log(`✅ Parsed 10,000 lines in ${duration.toFixed(2)}ms`);
    });

    it('should filter 100,000 logs in under 500ms', () => {
        const logs = Array(100000).fill(null).map((_, i) => ({
            level: ['E', 'W', 'I', 'D', 'V'][i % 5],
            originalText: `Log line ${i}`
        }));

        const startTime = performance.now();
        filterLogsByLevel(logs, new Set(['E', 'W']));
        const duration = performance.now() - startTime;

        expect(duration).toBeLessThan(500);

        console.log(`✅ Filtered 100,000 logs in ${duration.toFixed(2)}ms`);
    });
});
