import { describe, it, expect } from 'vitest';
import { logcatToDate } from '../../Production/src/utils/date.js';
import { escapeHtml, formatParam } from '../../Production/src/utils/html.js';

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
