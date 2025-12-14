import { describe, it, expect } from 'vitest';
import { logcatToDate } from '../../Production/src/utils/date.js';
import { escapeHtml, formatParam } from '../../Production/src/utils/html.js';
import { wildcardToRegex } from '../../Production/src/utils/regex.js';

describe('Date Utils', () => {
    describe('logcatToDate', () => {
        it('should parse valid logcat timestamp', () => {
            const result = logcatToDate('07-02 09:33:33.365');
            expect(result).toBeInstanceOf(Date);
            // Year defaults to current year, so we check dynamic components
            expect(result.getMonth()).toBe(6); // July is 6 (0-indexed)
            expect(result.getDate()).toBe(2);
            expect(result.getHours()).toBe(9);
            expect(result.getMinutes()).toBe(33);
            expect(result.getSeconds()).toBe(33);
            expect(result.getMilliseconds()).toBe(365);
        });

        it('should return null for invalid length', () => {
            expect(logcatToDate('07-02')).toBeNull();
        });

        it('should return null for empty input', () => {
            expect(logcatToDate('')).toBeNull();
            expect(logcatToDate(null)).toBeNull();
        });

        it('should parse diff time', () => {
            const result = logcatToDate('12-31 23:59:59.999');
            expect(result.getMonth()).toBe(11);
            expect(result.getDate()).toBe(31);
            expect(result.getHours()).toBe(23);
        });
    });

    it('should return null for undefined input', () => {
        expect(logcatToDate(undefined)).toBeNull();
    });

    it('should handle invalid date string gracefully', () => {
        // Strings that are long enough but not valid dates
        // e.g. "XX-YY 99:99:99.999" -> Date constructor might yield "Invalid Date"
        const result = logcatToDate('99-99 99:99:99.999');
        // Depending on implementation, `new Date` might resolve to `Invalid Date` or roll over.
        // If month is 99-1 = 98. JS dates roll over. 
        // "invalid" dates usually come from NaN checking (line 26 of date.js).
        // Let's test non-numeric string.
        expect(logcatToDate('Invalid Log Line Content')).toBeNull();
    });

    it('should parse millis correctly with leading zeros', () => {
        // 07-02 09:33:33.005 -> millis should be 5
        const result = logcatToDate('07-02 09:33:33.005');
        expect(result.getMilliseconds()).toBe(5);
    });
});

describe('HTML Utils', () => {
    describe('escapeHtml', () => {
        it('should escape special characters', () => {
            const input = '<script>alert("xss")&\'</script>';
            const expected = '&lt;script&gt;alert(&quot;xss&quot;)&amp;&#039;&lt;/script&gt;';
            expect(escapeHtml(input)).toBe(expected);
        });

        it('should handle empty string', () => {
            expect(escapeHtml('')).toBe('');
        });

        it('should handle undefined', () => {
            expect(escapeHtml(undefined)).toBe('');
        });

        it('should return clean string as is', () => {
            expect(escapeHtml('hello world')).toBe('hello world');
        });
    });

    describe('formatParam', () => {
        it('should format key value pair', () => {
            const html = formatParam('Status', 'OK');
            expect(html).toContain('ccc-pair');
            expect(html).toContain('ccc-param');
            expect(html).toContain('ccc-value');
            expect(html).toContain('Status:');
            expect(html).toContain('OK');
        });
    });
});

describe('Regex Utils', () => {
    describe('wildcardToRegex', () => {
        it('should create exact match regex for pattern without wildcard', () => {
            const regex = wildcardToRegex('NFC');
            expect(regex.test('NFC')).toBe(true);
            expect(regex.test(' NFC ')).toBe(true); // Matches whole word in string
            expect(regex.test('NFCA')).toBe(false);
        });

        it('should create contains regex for pattern with wildcard', () => {
            const regex = wildcardToRegex('*NFC*');
            expect(regex.test('My NFC Tag')).toBe(true);
            expect(regex.test('NFC')).toBe(true);
        });

        it('should handle prefix wildcard', () => {
            const regex = wildcardToRegex('*Log');
            expect(regex.test('MyLog')).toBe(true);
            expect(regex.test('Log')).toBe(true);
            expect(regex.test('LogFile')).toBe(true); // Matches because it contains "Log"
        });

        it('should handle suffix wildcard', () => {
            const regex = wildcardToRegex('Start*');
            expect(regex.test('StartNow')).toBe(true);
            expect(regex.test('Start')).toBe(true);
            expect(regex.test('ReStart')).toBe(true); // Matches because it contains "Start"
        });

        it('should escape special regex characters', () => {
            const regex = wildcardToRegex('Node.js');
            // dot should be literal dot, not any char
            expect(regex.test('Node.js')).toBe(true);
            expect(regex.test('Nodeejs')).toBe(false);
        });

        it('should be case insensitive', () => {
            const regex = wildcardToRegex('nFc');
            expect(regex.test('NFC')).toBe(true);
        });
    });
});
