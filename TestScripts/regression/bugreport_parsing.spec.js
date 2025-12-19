import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Bugreport Parsing Test', () => {
    test('should correctly parse bugreport UID PID TID format and display properly formatted log lines', async ({ page }) => {
        // Navigate to the app
        const appUrl = '/log_parser.html';
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
        }, null, { timeout: 30000 });

        // Wait a bit more for rendering
        await page.waitForTimeout(5000);

        // Enable all log levels
        const allButton = await page.locator('#logLevelToggleBtn');
        const btnText = await allButton.textContent();
        if (btnText === 'All') {
            await allButton.click();
            await page.waitForTimeout(1500);
        }

        // Check if properly formatted log lines are visible
        const logViewport = await page.locator('#logViewport');

        // Wait for log lines to render (bugreport files are large, need more time)
        await page.waitForFunction(() => {
            const viewport = document.getElementById('logViewport');
            return viewport && viewport.querySelectorAll('.log-line').length > 0;
        }, null, { timeout: 60000 }); // Increased from 10s to 60s for large bugreport files

        // Verify specific expected log lines are present
        const expectedLines = [
            'NetworkScheduler.Stats', // Should have proper tag
            'RegisterSyncOperation', // Should have proper tag
            'CCTUploader', // Should have proper tag
            'ActivityManager', // Should have proper tag
            'dumpstate' // Should have proper tag (shell user case)
        ];

        const expectedTimestamps = [
            '16:18:43.056', // Should have proper timestamp
            '16:18:43.058', // Should have proper timestamp
            '16:18:43.079' // Should have proper timestamp
        ];

        // Check existence in the parsed data (since viewport is virtualized)
        const { foundTags, foundTimestamps } = await page.evaluate(({ expectedTags, expectedTime }) => {
            const lines = window._debug?.originalLogLines() || [];
            let fTags = 0;
            let fTime = 0;

            // Check tags (searching first 1000 and random sample or just scanning all if fast enough)
            // Scanning 600k lines might be slow in evaluate.
            // Let's sample or check specific strings.
            // Actually, for validity, we should scan. It takes ~100ms for 1M items in JS.
            const textContent = lines.map(l => l.originalText).join('\n');

            for (const tag of expectedTags) {
                if (textContent.includes(tag)) fTags++;
            }
            for (const ts of expectedTime) {
                if (textContent.includes(ts)) fTime++;
            }
            return { foundTags: fTags, foundTimestamps: fTime };
        }, { expectedTags: expectedLines, expectedTime: expectedTimestamps });

        console.log('Checking for expected tags...');
        console.log(`Found ${foundTags}/${expectedLines.length} tags in parsed data.`);
        console.log('Checking for expected timestamps...');
        console.log(`Found ${foundTimestamps}/${expectedTimestamps.length} timestamps in parsed data.`);

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
        expect(foundTags, 'Should find at least 4 of the expected tags').toBeGreaterThanOrEqual(4);
        expect(foundTimestamps, 'Should find all expected timestamps').toBe(expectedTimestamps.length);
        expect(linesWithDates, 'Should have many lines with proper dates').toBeGreaterThan(100);

        // The ratio should be reasonable - we expect most lines to have dates
        const ratio = linesWithDates / (linesWithDates + linesWithoutDates);
        expect(ratio, 'At least 50% of lines should have proper dates').toBeGreaterThan(0.5);

        console.log('✓ Test passed! Bugreport parsing is working correctly.');
    });
});
