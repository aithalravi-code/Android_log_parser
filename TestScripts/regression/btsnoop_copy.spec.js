import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('BTSnoop Layout & Interaction', () => {
    test.beforeEach(async ({ page }) => {
        // Go to the app
        await page.goto('index.html');
        await page.waitForLoadState('networkidle');
    });

    test('BTSnoop Copy Action should copy entire row', async ({ page }) => {
        // Capture console logs to verify copy action
        let copiedTextLength = -1;
        page.on('console', msg => {
            const text = msg.text();
            console.log(`[Browser Log] ${text}`); // Print ALL logs for debugging
            if (text.includes('[Copy] Copied:')) {
                const match = text.match(/Copied: (\d+) chars/);
                if (match) {
                    copiedTextLength = parseInt(match[1], 10);
                }
            }
            // Check for our new debug log which confirms row aggregation
            if (text.includes('[Copy] Aggregated BTSnoop Row:')) {
                const match = text.match(/Row: (\d+) chars/);
                if (match) {
                    copiedTextLength = parseInt(match[1], 10);
                }
            }
        });

        // 1. Prepare File Path
        const relativePath = 'TestFiles/bugreport-caiman-BP3A.250905.014-2025-09-24-10-26-57/FS/data/misc/bluetooth/logs/btsnoop_hci.log';
        const absolutePath = path.resolve(process.cwd(), relativePath);

        if (!fs.existsSync(absolutePath)) {
            test.skip(`Test file not found at ${absolutePath}`);
            return;
        }

        // 2. Upload File
        console.log('Uploading file...');
        const fileInput = page.locator('#logFilesInput');
        await fileInput.setInputFiles(absolutePath);

        // 3. Wait for "Data loaded" log message
        await new Promise(resolve => {
            const listener = msg => {
                if (msg.text().includes('Data loaded:')) {
                    page.off('console', listener);
                    resolve();
                }
            };
            page.on('console', listener);
        });
        await page.waitForTimeout(500);

        // 4. Click BTSnoop tab
        const btsnoopTab = page.locator('[data-tab="btsnoop"]');
        await expect(btsnoopTab).toBeVisible();
        await btsnoopTab.click();

        // 5. Wait for rows
        await page.waitForSelector('.btsnoop-row', { state: 'visible', timeout: 30000 });

        // 6. Select a row (let's say the first one)
        const firstRow = page.locator('.btsnoop-row').first();
        const timestampCell = firstRow.locator('.btsnoop-cell').nth(1); // Timestamp column

        const cellText = await timestampCell.evaluate(el => el.textContent);
        console.log(`Cell Text: "${cellText}" (Length: ${cellText.length})`);

        // 7. Perform Copy (Ctrl + Click)
        // Force click to bypass "intercepts pointer events" if rows overlap slightly in virtual list
        await page.waitForTimeout(1000); // Wait for layout to settle
        await timestampCell.click({ modifiers: ['Control'], force: true });

        // 8. Verify Copied Text Length
        // If it copies ONLY the cell, length will remain close to cellText.length
        // If it copies the ROW, length should be > 50 (timestamp + columns + summary etc.)
        await page.waitForTimeout(500); // Wait for console
        console.log(`Copied Length: ${copiedTextLength}`);

        expect(copiedTextLength).toBeGreaterThan(cellText.length + 10);
    });
});
