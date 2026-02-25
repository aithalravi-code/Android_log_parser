import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Token Logs Verification', () => {
    test('should display token logs with correct year in production build', async ({ page }) => {
        // Use production build
        const htmlPath = path.resolve(__dirname, '../../Production/dist/log_parser.html');
        const fileUrl = `file://${htmlPath.replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29')}`;

        // Capture console logs
        const consoleMessages = [];
        page.on('console', msg => {
            const text = msg.text();
            consoleMessages.push(text);
            if (text.includes('ApplyFilters DEBUG') || text.includes('After filtering')) {
                console.log('BROWSER:', text);
            }
        });

        await page.goto(fileUrl);

        // Wait for app to initialize
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000);

        // Clear IndexedDB
        await page.evaluate(() => {
            return new Promise((resolve) => {
                const request = indexedDB.deleteDatabase('logParserDB');
                request.onsuccess = () => resolve(true);
                request.onerror = () => resolve(false);
            });
        });

        await page.reload();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1000);

        // Load ZIP file
        const zipPath = path.resolve(__dirname, '../../TestData/fixtures/bugreport-caiman-BP3A.250905.014-2025-09-24-10-26-57.zip');
        const fileInput = await page.locator('#logFilesInput');
        await fileInput.setInputFiles(zipPath);

        // Wait for processing
        await page.waitForFunction(() => {
            const display = document.getElementById('current-file-display');
            return display && display.textContent.includes('bugreport');
        }, null, { timeout: 60000 });

        // Wait for data to be loaded
        await page.waitForTimeout(8000);

        // Enable all log levels if not already
        const allButton = await page.locator('#logLevelToggleBtn');
        const btnText = await allButton.textContent();
        if (btnText === 'All') {
            await allButton.click();
            await page.waitForTimeout(1500);
        }

        // Wait for filtering to complete - look for the "After filtering" message with non-zero count
        let filteringComplete = false;
        const startWait = Date.now();
        const timeout = 60000; // 60 second timeout

        while (!filteringComplete && (Date.now() - startWait < timeout)) {
            const lastFilterMessage = consoleMessages.findLast(m => m.includes('[Main] After filtering: filteredLogLines.length ='));
            if (lastFilterMessage && lastFilterMessage.includes('filteredLogLines.length = ') && !lastFilterMessage.includes('= 0')) {
                filteringComplete = true;
                console.log('FILTERING COMPLETE:', lastFilterMessage);
            } else {
                await page.waitForTimeout(500);
            }
        }

        if (!filteringComplete) {
            console.log('WARNING: Filtering did not complete within timeout');
        }

        // Check what _debug functions are available
        const debugInfo = await page.evaluate(() => {
            return {
                hasDebug: !!window._debug,
                debugKeys: window._debug ? Object.keys(window._debug) : [],
                hasOriginalLogLines: typeof window._debug?.originalLogLines === 'function',
                hasFilteredLogLines: typeof window._debug?.filteredLogLines === 'function'
            };
        });
        console.log('Debug Info:', debugInfo);

        // Get detailed information
        const results = await page.evaluate(() => {
            const original = window._debug?.originalLogLines() || [];
            const filtered = window._debug?.filteredLogLines() || [];

            // Token logs
            const tokenLogs = original.filter(l =>
                l.originalText && l.originalText.includes('| token:')
            );

            const tokenLogsInFiltered = filtered.filter(l =>
                l.originalText && l.originalText.includes('| token:')
            );

            // Sample token logs
            const sampleToken = tokenLogs.slice(0, 3).map(l => ({
                text: l.originalText.substring(0, 60),
                date: l.date,
                time: l.time,
                level: l.level,
                year: l.dateObj ? l.dateObj.getFullYear() : null
            }));

            // Check time range displayed
            const timeRangeStart = document.querySelector('.noUi-tooltip')?.textContent;

            return {
                totalOriginal: original.length,
                totalFiltered: filtered.length,
                tokenLogsCount: tokenLogs.length,
                tokenLogsInFiltered: tokenLogsInFiltered.length,
                sampleToken,
                timeRangeStart,
                // Check if logs have correct year
                logsIn2025: original.filter(l => l.dateObj && l.dateObj.getFullYear() === 2025).length,
                logsIn2026: original.filter(l => l.dateObj && l.dateObj.getFullYear() === 2026).length
            };
        });

        console.log('Test Results:', JSON.stringify(results, null, 2));
        console.log('\n=== CONSOLE MESSAGES CONTAINING "ApplyFilters" or "filtering" ===');
        consoleMessages.filter(m => m.toLowerCase().includes('applyfilters') || m.toLowerCase().includes('filtering')).forEach(m => console.log(m));
        console.log('=== END CONSOLE ===\n');

        // Assertions
        expect(results.totalOriginal, 'Should have original logs').toBeGreaterThan(1000000);
        expect(results.tokenLogsCount, 'Should have found ~54 token logs').toBeGreaterThanOrEqual(50);
        expect(results.tokenLogsInFiltered, 'Token logs should be in filtered view').toBeGreaterThan(0);
        expect(results.logsIn2026, 'Should have NO logs in year 2026').toBe(0);
        expect(results.logsIn2025, 'Should have logs in year 2025').toBeGreaterThan(0);

        // Check sample token logs have correct year
        const allHave2025 = results.sampleToken.every(log => log.year === 2025);
        expect(allHave2025, 'Sample token logs should be dated 2025').toBe(true);

        console.log('✓ All assertions passed!');
    });
});
