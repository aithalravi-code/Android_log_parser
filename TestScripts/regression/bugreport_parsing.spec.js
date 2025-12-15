import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Bugreport Parsing Test', () => {
    test('should correctly parse bugreport UID PID TID format and display properly formatted log lines', async ({ page }) => {
        // Navigate to the app
        const appUrl = 'file://' + path.resolve(__dirname, '../../Production/dist/log_parser.html');
        await page.goto(appUrl);

        // Clear any existing data first
        await page.evaluate(() => {
            return new Promise((resolve) => {
                const request = indexedDB.deleteDatabase('logParserDB');
                request.onsuccess = () => resolve(true);
                request.onerror = () => resolve(false);
            });
        });

        // Reload after clearing DB
        await page.reload();
        await page.waitForLoadState('domcontentloaded');

        // Load the bugreport file
        const filePath = path.resolve(__dirname, '../../TestData/fixtures/bugreport-husky-UQ1A.240105.004-2024-02-22-16-17-29.txt');

        console.log('Loading file:', filePath);

        const fileInput = await page.locator('#logFilesInput');
        await fileInput.setInputFiles(filePath);

        // Wait for processing to complete (look for the file display or loaded indicator)
        await page.waitForFunction(() => {
            const display = document.getElementById('current-file-display');
            return display && display.textContent.includes('bugreport');
        }, { timeout: 30000 });

        // Wait a bit more for rendering
        await page.waitForTimeout(2000);

        // Enable all log levels
        const allButton = await page.locator('#logLevelToggleBtn');
        const btnText = await allButton.textContent();
        if (btnText === 'All') {
            await allButton.click();
            await page.waitForTimeout(500);
        }

        // Check if properly formatted log lines are visible
        const logViewport = await page.locator('#logViewport');

        // Wait for log lines to render
        await page.waitForFunction(() => {
            const viewport = document.getElementById('logViewport');
            return viewport && viewport.querySelectorAll('.log-line').length > 0;
        }, { timeout: 10000 });

        const viewportText = await logViewport.textContent();

        // Verify specific expected log lines are present
        const expectedLines = [
            'NetworkScheduler.Stats',  // Should have proper tag
            'RegisterSyncOperation',    // Should have proper tag
            'CCTUploader',              // Should have proper tag
            'ActivityManager',          // Should have proper tag
            'dumpstate'                 // Should have proper tag (shell user case)
        ];

        const expectedTimestamps = [
            '16:18:43.056',  // Should have proper timestamp
            '16:18:43.058',  // Should have proper timestamp
            '16:18:43.079',  // Should have proper timestamp
        ];

        console.log('Checking for expected tags...');
        let foundTags = 0;
        for (const tag of expectedLines) {
            if (viewportText.includes(tag)) {
                console.log('✓ Found tag:', tag);
                foundTags++;
            } else {
                console.log('✗ Missing tag:', tag);
            }
        }

        console.log('Checking for expected timestamps...');
        let foundTimestamps = 0;
        for (const timestamp of expectedTimestamps) {
            if (viewportText.includes(timestamp)) {
                console.log('✓ Found timestamp:', timestamp);
                foundTimestamps++;
            } else {
                console.log('✗ Missing timestamp:', timestamp);
            }
        }

        // Get total log lines count
        const totalLines = await page.evaluate(() => {
            return window._debug?.originalLogLines()?.length || 0;
        });

        // Get lines with proper dates
        const linesWithDates = await page.evaluate(() => {
            const lines = window._debug?.originalLogLines() || [];
            return lines.filter(l => !l.isMeta && l.date && l.date !== 'N/A' && l.date !== '').length;
        });

        // Get lines without dates (N/A)
        const linesWithoutDates = await page.evaluate(() => {
            const lines = window._debug?.originalLogLines() || [];
            return lines.filter(l => !l.isMeta && (!l.date || l.date === 'N/A' || l.date === '')).length;
        });

        console.log('Total lines:', totalLines);
        console.log('Lines with proper dates:', linesWithDates);
        console.log('Lines without dates (N/A):', linesWithoutDates);
        console.log('Found tags:', foundTags, '/', expectedLines.length);
        console.log('Found timestamps:', foundTimestamps, '/', expectedTimestamps.length);

        // Assertions
        expect(foundTags, `Should find at least 4 of the expected tags`).toBeGreaterThanOrEqual(4);
        expect(foundTimestamps, `Should find all expected timestamps`).toBe(expectedTimestamps.length);
        expect(linesWithDates, `Should have many lines with proper dates`).toBeGreaterThan(100);

        // The ratio should be reasonable - we expect most lines to have dates
        const ratio = linesWithDates / (linesWithDates + linesWithoutDates);
        expect(ratio, `At least 50% of lines should have proper dates`).toBeGreaterThan(0.5);

        console.log('✓ Test passed! Bugreport parsing is working correctly.');
    });
});
