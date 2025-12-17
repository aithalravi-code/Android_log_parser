import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('BTSnoop Layout Alignment', () => {
    test.beforeEach(async ({ page }) => {
        // Use localhost dev server instead of file:// protocol (ES modules don't work with file://)
        await page.goto('http://localhost:5173/log_parser.html');
        await page.waitForLoadState('networkidle');

        // Console logging for debugging
        page.on('console', msg => {
            console.log(`[Browser] ${msg.text()}`);
        });
    });

    test('Should verify that File Header does not overlap Table Header or Data Rows', async ({ page }) => {
        test.setTimeout(180000); // 2 minutes for file upload and BTSnoop processing

        const initFile = path.resolve(process.cwd(), 'TestData/fixtures/bugreport-caiman-BP3A.250905.014-2025-09-24-10-26-57/FS/data/misc/bluetooth/logs/btsnoop_hci.log');

        if (!fs.existsSync(initFile)) {
            test.skip('Test file missing: ' + initFile);
            return;
        }

        const fileInput = page.locator('#logFilesInput');
        await fileInput.setInputFiles(initFile);

        // Wait for file processing
        console.log('Waiting for file to process...');
        await page.waitForTimeout(15000); // BTSnoop processing takes time

        // Wait for BTSnoop tab to be available
        await page.waitForSelector('[data-tab="btsnoop"]', { timeout: 10000 });

        // Switch to BTSnoop tab
        await page.click('[data-tab="btsnoop"]');
        await page.waitForTimeout(5000); // Wait for tab switch and rendering

        // Wait for rows to appear
        await page.waitForSelector('.btsnoop-file-header', { state: 'visible', timeout: 15000 });

        // Get Bounding Boxes
        const headerGrid = page.locator('.btsnoop-header-grid');
        const metaRow = page.locator('.btsnoop-meta-row').first();
        const firstDataRow = page.locator('.btsnoop-row:not(.btsnoop-meta-row)').first();

        const headerBox = await headerGrid.boundingBox();
        const metaBox = await metaRow.boundingBox();
        const dataBox = await firstDataRow.boundingBox();

        console.log('Header Box:', headerBox);
        console.log('Meta Box:', metaBox);
        console.log('Data Row Box:', dataBox);

        // 1. Verify Meta Row is visible and has correct height (30px enforced)
        expect(metaBox.height).toBeCloseTo(30, 1);

        // 2. Verify Meta Row does NOT overlap Header Grid
        // If Header is Sticky at Top=0, it occupies, say, 0-30px (or whatever height).
        // Meta Row should be BELOW it.
        // Wait, does sticky header push content?
        // If content starts at Y=0 relative to container, and Header is sticky at Y=0...
        // They OVERLAP unless container has padding-top equal to header height.

        // We expect Meta Top >= Header Bottom
        // Note: Playwright boundingBox is relative to viewport usually? Or page?
        // Since they are in the same scroll container area (or relative to it), let's just check relative Y.

        // However, if headerBox.y === metaBox.y, they overlap (bad).
        // Allow 10px tolerance for browser rendering differences (Chromium: 1px, Webkit: 6px)
        expect(metaBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height - 10);

        // 3. Verify Data Row is below Meta Row
        expect(dataBox.y).toBeGreaterThanOrEqual(metaBox.y + metaBox.height - 10);

        // 4. Verify Meta Row Text is single line (implied by height check, but check css)
        await expect(metaRow.locator('.btsnoop-file-header')).toHaveCSS('white-space', 'nowrap');
        await expect(metaRow.locator('.btsnoop-file-header')).toHaveCSS('overflow', 'hidden');
    });
});
