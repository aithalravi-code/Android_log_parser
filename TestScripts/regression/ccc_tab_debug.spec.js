import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { getFixturePath } from '../helpers/test-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('CCC Tab Visibility Debug', () => {
    test('should show CCC messages in CCC_Focus tab', async ({ page }) => {
        const htmlPath = path.resolve(__dirname, '../../Production/dist/log_parser.html');
        const fileUrl = `file://${htmlPath.replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29')}`;

        const consoleMessages = [];
        page.on('console', msg => {
            const text = msg.text();
            consoleMessages.push(text);
            if (text.includes('[CccTab]') || text.includes('CCC')) {
                console.log('BROWSER:', text);
            }
        });

        await page.goto(fileUrl);
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

        // Load ZIP file (uses mock-data in CI, real fixtures locally)
        const zipPath = getFixturePath('bugreport-caiman-BP3A.250905.014-2025-09-24-10-26-57.zip');
        const fileInput = await page.locator('#logFilesInput');
        await fileInput.setInputFiles(zipPath);

        // Wait for processing
        await page.waitForFunction(() => {
            const display = document.getElementById('current-file-display');
            return display && display.textContent.includes('bugreport');
        }, null, { timeout: 60000 });

        // Wait for CCC extraction
        await page.waitForTimeout(15000);

        // Check CCC messages in memory
        const cccData = await page.evaluate(() => {
            const cccMsgs = window._debug?.cccMessages || [];
            return {
                total: cccMsgs.length,
                levels: {},
                sample: cccMsgs.slice(0, 3).map(m => ({
                    timestamp: m.timestamp,
                    level: m.level,
                    dateObj: m.dateObj ? 'present' : 'missing'
                }))
            };
        });
        console.log('CCC Messages in memory:', JSON.stringify(cccData, null, 2));

        // Click on CCC_Focus tab
        await page.click('button[data-tab="ccc"]');
        await page.waitForTimeout(3000);

        // Check if CCC table has rows
        const cccTableInfo = await page.evaluate(() => {
            const container = document.getElementById('cccStatsContainer');
            const tbody = container?.querySelector('tbody');
            const rows = tbody?.querySelectorAll('tr') || [];

            // Get first row content
            let firstRowText = '';
            if (rows.length > 0) {
                firstRowText = rows[0].textContent.substring(0, 200);
            }

            return {
                containerExists: !!container,
                tbodyExists: !!tbody,
                rowCount: rows.length,
                firstRowText: firstRowText,
                containerHTML: container?.innerHTML?.substring(0, 500) || 'N/A'
            };
        });
        console.log('CCC Table Info:', JSON.stringify(cccTableInfo, null, 2));

        // Get relevant console logs
        const cccLogs = consoleMessages.filter(m => m.includes('[CccTab]'));
        console.log('\n=== CCC Console Logs ===');
        cccLogs.forEach(l => console.log(l));
        console.log('=== END ===\n');

        // Assertions
        expect(cccData.total, 'Should have CCC messages in memory').toBeGreaterThan(0);
        expect(cccTableInfo.rowCount, 'CCC table should have data rows').toBeGreaterThan(1);
    });
});
