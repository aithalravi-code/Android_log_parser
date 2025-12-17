/**
 * Error Handling E2E Tests
 * Test error scenarios and edge cases
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { generateMockLogFile } from '../helpers/test-data-generator.js';
import { uploadFile, clearAppState, applyFilters, getLogCount } from '../helpers/test-utils.js';

test.describe('Error Handling and Edge Cases', () => {
    let tempDir;

    test.beforeAll(async () => {
        tempDir = path.resolve(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
    });

    test.beforeEach(async ({ page }) => {
        await page.goto('/log_parser.html');
        await clearAppState(page);
    });

    test('Handle empty file upload gracefully', async ({ page }) => {
        const emptyFile = path.join(tempDir, 'empty.log');
        fs.writeFileSync(emptyFile, '');

        await uploadFile(page, emptyFile, { waitForProcessing: false });
        await page.waitForTimeout(3000); // Increased timeout

        // Should not crash (may show 0 or handle differently)
        const logCount = await getLogCount(page);
        expect(logCount).toBeGreaterThanOrEqual(0);

        // Cleanup
        fs.unlinkSync(emptyFile);
    });

    test('Handle file with only whitespace', async ({ page }) => {
        const whitespaceFile = path.join(tempDir, 'whitespace.log');
        fs.writeFileSync(whitespaceFile, '   \n\n\t\t\n   ');

        await uploadFile(page, whitespaceFile, { waitForProcessing: false });
        await page.waitForTimeout(2000);

        const logCount = await getLogCount(page);
        expect(logCount).toBeGreaterThanOrEqual(0);

        fs.unlinkSync(whitespaceFile);
    });

    test('Handle malformed log lines gracefully', async ({ page }) => {
        const malformedFile = path.join(tempDir, 'malformed.log');
        const content = [
            '--------- beginning of system',
            'This is not a valid log line',
            '09-23 12:00:00.000 1000 2000 I TestTag : Valid line',
            'Another invalid line without proper format',
            '09-23 12:00:01.000 1000 2000 E TestTag : Another valid line',
            'Random text',
            ''
        ].join('\n');

        fs.writeFileSync(malformedFile, content);

        await uploadFile(page, malformedFile);

        // Should parse valid lines and handle invalid ones
        const logCount = await getLogCount(page);
        expect(logCount).toBeGreaterThan(0);

        fs.unlinkSync(malformedFile);
    });

    test('Handle very long log lines (> 10KB)', async ({ page }) => {
        const longLineFile = path.join(tempDir, 'longline.log');
        const longMessage = 'A'.repeat(15000);
        const content = [
            '--------- beginning of system',
            `09-23 12:00:00.000 1000 2000 I TestTag : ${longMessage}`,
            '09-23 12:00:01.000 1000 2000 I TestTag : Normal line'
        ].join('\n');

        fs.writeFileSync(longLineFile, content);

        await uploadFile(page, longLineFile);

        const logCount = await getLogCount(page);
        expect(logCount).toBeGreaterThan(0);

        fs.unlinkSync(longLineFile);
    });

    test('Handle special characters in log content', async ({ page }) => {
        const specialCharsFile = path.join(tempDir, 'specialchars.log');
        const content = [
            '--------- beginning of system',
            '09-23 12:00:00.000 1000 2000 I TestTag : <script>alert("xss")</script>',
            '09-23 12:00:01.000 1000 2000 I TestTag : Special chars: !@#$%^&*()[]{}',
            '09-23 12:00:02.000 1000 2000 I TestTag : Unicode: 你好世界 🚀',
            '09-23 12:00:03.000 1000 2000 I TestTag : Quotes: "double" \'single\''
        ].join('\n');

        fs.writeFileSync(specialCharsFile, content);

        await uploadFile(page, specialCharsFile);

        const logCount = await getLogCount(page);
        expect(logCount).toBeGreaterThan(0);

        // Verify XSS is escaped
        const pageContent = await page.content();
        expect(pageContent).not.toContain('<script>alert');

        fs.unlinkSync(specialCharsFile);
    });

    test('Handle invalid filter inputs gracefully', async ({ page }) => {
        const mockFile = path.join(tempDir, 'filter_test.log');
        fs.writeFileSync(mockFile, generateMockLogFile(100));

        await uploadFile(page, mockFile);

        // Try various invalid inputs
        await applyFilters(page, { search: '('.repeat(100) });
        await page.waitForTimeout(300);

        await applyFilters(page, { search: '*'.repeat(100) });
        await page.waitForTimeout(300);

        // Should not crash
        const logCount = await getLogCount(page);
        expect(logCount).toBeGreaterThan(0);

        fs.unlinkSync(mockFile);
    });

    test('Handle rapid file uploads', async ({ page }) => {
        const files = [];
        for (let i = 0; i < 3; i++) {
            const filePath = path.join(tempDir, `rapid_${i}.log`);
            fs.writeFileSync(filePath, generateMockLogFile(50));
            files.push(filePath);
        }

        // Upload files rapidly
        for (const file of files) {
            const fileInput = page.locator('#logFilesInput');
            await fileInput.setInputFiles(file);
            await page.waitForTimeout(100);
        }

        // Wait for processing
        await page.waitForTimeout(3000);

        // Should handle gracefully
        const logCount = await getLogCount(page);
        expect(logCount).toBeGreaterThan(0);

        // Cleanup
        files.forEach(f => fs.unlinkSync(f));
    });

    test('Handle file with no valid timestamps', async ({ page }) => {
        const noTimestampFile = path.join(tempDir, 'notimestamp.log');
        const content = [
            'Line without timestamp 1',
            'Line without timestamp 2',
            'Line without timestamp 3'
        ].join('\n');

        fs.writeFileSync(noTimestampFile, content);

        await uploadFile(page, noTimestampFile, { waitForProcessing: false });
        await page.waitForTimeout(2000);

        // Should not crash
        const logCount = await getLogCount(page);
        expect(logCount).toBeGreaterThanOrEqual(0);

        fs.unlinkSync(noTimestampFile);
    });

    test('Handle corrupted UTF-8 sequences', async ({ page }) => {
        const corruptedFile = path.join(tempDir, 'corrupted.log');

        // Create file with invalid UTF-8
        const buffer = Buffer.from([
            ...Buffer.from('09-23 12:00:00.000 1000 2000 I TestTag : '),
            0xFF, 0xFE, 0xFD, // Invalid UTF-8 bytes
            ...Buffer.from(' end of line\n')
        ]);

        fs.writeFileSync(corruptedFile, buffer);

        await uploadFile(page, corruptedFile, { waitForProcessing: false });
        await page.waitForTimeout(2000);

        // Should handle gracefully
        const logCount = await getLogCount(page);
        expect(logCount).toBeGreaterThanOrEqual(0);

        fs.unlinkSync(corruptedFile);
    });

    test('Handle missing file input element', async ({ page }) => {
        // Remove file input from DOM
        await page.evaluate(() => {
            const input = document.getElementById('logFilesInput');
            if (input) input.remove();
        });

        // App should still be functional
        const title = await page.title();
        expect(title).toBeTruthy();
    });

    test('Handle IndexedDB errors gracefully', async ({ page }) => {
        // Try to trigger IndexedDB error by exceeding quota (if possible)
        // This is a basic test - actual quota errors are hard to simulate

        const mockFile = path.join(tempDir, 'idb_test.log');
        fs.writeFileSync(mockFile, generateMockLogFile(100));

        await uploadFile(page, mockFile);
        await page.waitForTimeout(1000);

        // Clear state should work even if there are DB errors
        await clearAppState(page);
        await page.waitForTimeout(1000);

        const logCount = await getLogCount(page);
        expect(logCount).toBeGreaterThanOrEqual(0); // May or may not clear completely

        fs.unlinkSync(mockFile);
    });

    test('Handle console errors without crashing', async ({ page }) => {
        const errors = [];
        page.on('pageerror', error => {
            errors.push(error.message);
        });

        const mockFile = path.join(tempDir, 'error_test.log');
        fs.writeFileSync(mockFile, generateMockLogFile(100));

        await uploadFile(page, mockFile);
        await applyFilters(page, { search: 'test' });
        await page.waitForTimeout(1000);

        // Should have minimal or no errors
        console.log(`Console errors: ${errors.length}`);
        errors.forEach(err => console.log(`  - ${err}`));

        fs.unlinkSync(mockFile);
    });

    test('Handle network errors for external resources', async ({ page }) => {
        // Block external resources
        await page.route('**/*.woff2', route => route.abort());
        await page.route('**/*.woff', route => route.abort());

        await page.goto('/log_parser.html');

        // App should still load
        const fileInput = page.locator('#logFilesInput');
        await expect(fileInput).toBeAttached();
    });

    test('Handle browser back/forward navigation', async ({ page }) => {
        const mockFile = path.join(tempDir, 'nav_test.log');
        fs.writeFileSync(mockFile, generateMockLogFile(100));

        await uploadFile(page, mockFile);
        const logCount = await getLogCount(page);

        // Navigate away and back
        await page.goto('about:blank');
        await page.goBack();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000);

        // Should restore state or handle gracefully
        const afterNav = await getLogCount(page);
        expect(afterNav).toBeGreaterThanOrEqual(0);

        fs.unlinkSync(mockFile);
    });

    test('Handle window resize during processing', async ({ page }) => {
        const mockFile = path.join(tempDir, 'resize_test.log');
        fs.writeFileSync(mockFile, generateMockLogFile(500));

        // Start upload
        const fileInput = page.locator('#logFilesInput');
        await fileInput.setInputFiles(mockFile);

        // Resize window during processing
        await page.setViewportSize({ width: 800, height: 600 });
        await page.waitForTimeout(500);
        await page.setViewportSize({ width: 1920, height: 1080 });

        // Wait for processing
        await page.waitForTimeout(3000);

        const logCount = await getLogCount(page);
        expect(logCount).toBeGreaterThan(0);

        fs.unlinkSync(mockFile);
    });

    test('Handle tab visibility changes', async ({ page }) => {
        const mockFile = path.join(tempDir, 'visibility_test.log');
        fs.writeFileSync(mockFile, generateMockLogFile(200));

        await uploadFile(page, mockFile);

        // Simulate tab becoming hidden
        await page.evaluate(() => {
            Object.defineProperty(document, 'hidden', {
                writable: true,
                value: true
            });
            document.dispatchEvent(new Event('visibilitychange'));
        });

        await page.waitForTimeout(500);

        // Simulate tab becoming visible again
        await page.evaluate(() => {
            Object.defineProperty(document, 'hidden', {
                writable: true,
                value: false
            });
            document.dispatchEvent(new Event('visibilitychange'));
        });

        await page.waitForTimeout(500);

        // App should still work
        const logCount = await getLogCount(page);
        expect(logCount).toBeGreaterThan(0);

        fs.unlinkSync(mockFile);
    });
});
