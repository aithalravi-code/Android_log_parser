import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Automated Table Sorting Integration Test
 * 
 * Verifies sorting functionality on all tables:
 * - CCC Stats
 * - Device Events
 * - BLE Keys
 * - BTSnoop Connection Events
 */

const TABLES = [
    {
        id: 'cccStatsTable',
        name: 'CCC Stats',
        tab: 'CCC',
        columns: [
            { index: 0, name: 'Time' },
            { index: 1, name: 'Peer Address' }
        ]
    },
    {
        id: 'deviceEventsTable',
        name: 'Device Events',
        tab: 'Stats',
        columns: [
            { index: 0, name: 'Date' },
            { index: 1, name: 'Time' }
        ]
    },
    {
        id: 'bleKeysTable',
        name: 'BLE Keys',
        tab: 'Stats',
        columns: [
            { index: 0, name: 'Packet No' }
        ]
    },
    {
        id: 'btsnoopConnectionEventsTable',
        name: 'BTSnoop Connection Events',
        tab: 'Stats',
        columns: [
            { index: 0, name: 'Packet No' },
            { index: 1, name: 'Timestamp' }
        ]
    }
];

test.describe('Table Sorting', () => {
    let page;

    test.beforeAll(async ({ browser }) => {
        page = await browser.newPage();

        // Navigate to  app
        const appPath = path.join(__dirname, '../../Production/dist/index.html');
        await page.goto(`file://${appPath}`);

        // Auto-load test data
        console.log('\n📁 Loading test data automatically...');
        const testFilePath = path.join(__dirname, '../../TestData/fixtures/dumpState_S918BXXS8DYG5_202509231248.zip');

        // Read file as base64
        const fileBuffer = await fs.readFile(testFilePath);
        const base64Data = fileBuffer.toString('base64');

        // Inject file into browser
        await page.evaluate(async ({ base64, filename }) => {
            // Convert base64 to blob
            const byteCharacters = atob(base64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/zip' });
            const file = new File([blob], filename, { type: 'application/zip' });

            // Create DataTransfer and trigger file input
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);

            const input = document.getElementById('zipInput');
            input.files = dataTransfer.files;

            // Trigger change event
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }, { base64: base64Data, filename: 'dumpState_S918BXXS8DYG5_202509231248.zip' });

        console.log('✓ File injected, waiting for processing...');

        // Wait for CCC table to have rows (data loaded)
        try {
            await page.waitForFunction(
                () => document.querySelector('#cccStatsTable tbody tr') !== null,
                { timeout: 30000 }
            );
            console.log('✅ Data loaded successfully!\n');
        } catch (e) {
            throw new Error('Timeout: Data did not load. Check console for errors.');
        }
    });

    test.afterAll(async () => {
        await page.close();
    });

    for (const table of TABLES) {
        test.describe(table.name, () => {
            test.beforeEach(async () => {
                // Navigate to correct tab
                await page.click(`button:has-text("${table.tab}")`);

                // For CCC tab, force visibility (lazy loaded content)
                if (table.tab === 'CCC') {
                    await page.evaluate(() => {
                        const cccContent = document.getElementById('cccContent');
                        if (cccContent) cccContent.style.display = 'block';
                    });
                }

                // Wait for table to be visible
                await page.waitForSelector(`#${table.id}`, { state: 'attached', timeout: 5000 });
                await page.waitForTimeout(500);
            });

            for (const column of table.columns) {
                test(`should sort by ${column.name}`, async () => {
                    const tableLocator = page.locator(`#${table.id}`);

                    // Verify table has data
                    const rowCount = await tableLocator.locator('tbody tr').count();

                    // Skip if no data (e.g., BTSnoop not in this test file)
                    if (rowCount === 0) {
                        console.log(`  ⊘ Skipping ${table.name} - ${column.name} (no data)`);
                        test.skip();
                        return;
                    }

                    expect(rowCount).toBeGreaterThan(0);

                    console.log(`  Testing ${table.name} - ${column.name} (${rowCount} rows)`);

                    // Get initial first cell value
                    const getCellValue = async () => {
                        return await tableLocator
                            .locator(`tbody tr:first-child td:nth-child(${column.index + 1})`)
                            .textContent();
                    };

                    const initialValue = await getCellValue();
                    console.log(`    Initial: ${initialValue}`);

                    // Click header - use first row to skip filter rows
                    const header = tableLocator.locator('thead tr:first-child th').nth(column.index);
                    await header.click();
                    await page.waitForTimeout(300);

                    // Verify sort indicator appeared
                    const hasAscArrow = await header.evaluate(el => el.classList.contains('sort-asc'));
                    const hasDescArrow = await header.evaluate(el => el.classList.contains('sort-desc'));
                    expect(hasAscArrow || hasDescArrow).toBeTruthy();

                    const ascValue = await getCellValue();
                    console.log(`    After 1st click (${hasAscArrow ? 'asc' : 'desc'}): ${ascValue}`);

                    // Click again to sort descending
                    await header.click();
                    await page.waitForTimeout(300);

                    const descValue = await getCellValue();
                    console.log(`    After 2nd click: ${descValue}`);

                    // Verify data actually changed (unless only 1 unique value)
                    if (rowCount > 1) {
                        const valuesChanged = (ascValue !== initialValue) || (descValue !== ascValue);
                        expect(valuesChanged).toBeTruthy();
                    }

                    console.log(`    ✓ Sorting works!`);
                });
            }
        });
    }
});
