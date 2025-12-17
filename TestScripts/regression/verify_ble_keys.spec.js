import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('BLE Keys Population Verification', () => {
    test.beforeEach(async ({ page }) => {
        page.on('console', msg => console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`));
        await page.goto('log_parser.html');
        await page.waitForLoadState('networkidle');
    });

    test('Verify BLE Security Keys table is populated', async ({ page }) => {
        const relativePath = 'TestData/fixtures/bugreport-caiman-BP3A.250905.014-2025-09-24-10-26-57/FS/data/misc/bluetooth/logs/btsnoop_hci.log';
        const absolutePath = path.resolve(process.cwd(), relativePath);

        if (!fs.existsSync(absolutePath)) {
            test.skip(`Test file not found at ${absolutePath}`);
            return;
        }

        console.log('Uploading file...');
        const fileInput = page.locator('#logFilesInput');
        await fileInput.setInputFiles(absolutePath);

        // Wait for "Data loaded" message or completion signal
        await page.waitForTimeout(2000); // Give it a moment to start

        // Wait for BTSnoop processing to hopefully finish implicitly
        // by waiting for the Stats tab data to be ready.
        // But processing is async. We can check for a known element or wait for console "BTSnoop Processing stopped".

        // Better: Click Stats tab and wait for table rows.
        console.log('Clicking Stats tab...');
        const statsTab = page.locator('[data-tab="stats"]');
        await expect(statsTab).toBeVisible();
        await statsTab.click();

        // Check if table has rows
        console.log('Checking BLE Keys table...');
        const tableBody = page.locator('#bleKeysTable tbody');
        await expect(tableBody).toBeVisible();

        // Wait for async rendering and BTSnoop processing (Webkit needs more time)
        await page.waitForTimeout(10000); // Increased from 2s to 10s for Webkit

        const rows = tableBody.locator('tr');
        const count = await rows.count();
        console.log(`Found ${count} rows in BLE Keys table.`);

        // Expect at least one row, and it shouldn't be the "No keys found" message
        expect(count).toBeGreaterThan(0);

        const firstRowText = await rows.first().innerText();
        console.log(`First row text: ${firstRowText}`);
        expect(firstRowText).not.toContain('No BLE security keys found');
    });
});
