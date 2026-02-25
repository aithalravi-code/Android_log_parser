import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Token Log Format Parsing', () => {
    test('should parse and display pipe-separated token logs with dates', async ({ page }) => {
        // Navigate to the app
        const appUrl = 'http://localhost:5173/log_parser.html';
        await page.goto(appUrl);

        // Clear any existing data
        await page.evaluate(() => {
            return new Promise((resolve) => {
                const request = indexedDB.deleteDatabase('logParserDB');
                request.onsuccess = () => resolve(true);
                request.onerror = () => resolve(false);
            });
        });

        await page.reload();
        await page.waitForLoadState('domcontentloaded');

        // Load the bugreport ZIP file
        const filePath = path.resolve(__dirname, '../../TestData/fixtures/bugreport-caiman-BP3A.250905.014-2025-09-24-10-26-57.zip');

        const fileInput = await page.locator('#zipInput');
        await fileInput.setInputFiles(filePath);

        // Wait for processing
        await page.waitForFunction(() => {
            const display = document.getElementById('current-file-display');
            return display && display.textContent.includes('bugreport');
        }, null, { timeout: 60000 });

        // Wait for logs to be parsed
        await page.waitForTimeout(5000);

        // Enable all log levels
        const allButton = await page.locator('#logLevelToggleBtn');
        const btnText = await allButton.textContent();
        if (btnText === 'All') {
            await allButton.click();
            await page.waitForTimeout(1000);
        }

        // Check if token logs are present in the parsed data
        const tokenLogsInfo = await page.evaluate(() => {
            const lines = window._debug?.originalLogLines() || [];

            // Find token logs
            const tokenLogs = lines.filter(line =>
                line.originalText && line.originalText.includes('token:')
            );

            // Get details about token logs
            const tokenLogDetails = tokenLogs.slice(0, 5).map(line => ({
                originalText: line.originalText.substring(0, 100),
                date: line.date,
                time: line.time,
                timestamp: line.timestamp,
                level: line.level,
                tag: line.tag,
                message: line.message ? line.message.substring(0, 50) : null
            }));

            return {
                totalLines: lines.length,
                tokenLogsCount: tokenLogs.length,
                tokenLogDetails,
                linesWithDates: lines.filter(l => l.date && l.date !== 'N/A').length,
                linesWithNA: lines.filter(l => !l.date || l.date === 'N/A').length
            };
        });

        console.log('Token Logs Info:', JSON.stringify(tokenLogsInfo, null, 2));

        // Assertions
        expect(tokenLogsInfo.totalLines, 'Should have parsed lines').toBeGreaterThan(0);
        expect(tokenLogsInfo.tokenLogsCount, 'Should have found token logs').toBeGreaterThan(0);

        // Check that token logs have proper dates (not N/A)
        const tokenLogsWithDates = tokenLogsInfo.tokenLogDetails.filter(log =>
            log.date && log.date !== 'N/A'
        );

        console.log('Token logs with dates:', tokenLogsWithDates.length, '/', tokenLogsInfo.tokenLogDetails.length);

        expect(tokenLogsWithDates.length, 'Token logs should have dates, not N/A').toBe(tokenLogsInfo.tokenLogDetails.length);
    });
});
