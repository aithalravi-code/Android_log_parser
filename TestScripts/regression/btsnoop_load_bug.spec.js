import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('BTSnoop Reload Behavior', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('index.html');
        await page.waitForLoadState('networkidle');

        // Console logging for debugging
        page.on('console', msg => {
            console.log(`[Browser] ${msg.text()}`);
        });
    });

    test('Should reload BTSnoop logs when uploading ZIP while already on BTSnoop tab', async ({ page }) => {
        // 1. Initial State: Upload a single log file to get started
        // We use the unzipped folder/file for speed first
        const initFile = path.resolve(process.cwd(), 'TestFiles/bugreport-caiman-BP3A.250905.014-2025-09-24-10-26-57/FS/data/misc/bluetooth/logs/btsnoop_hci.log');
        const zipFile = path.resolve(process.cwd(), 'TestFiles/bugreport-caiman-BP3A.250905.014-2025-09-24-10-26-57.zip');

        if (!fs.existsSync(initFile) || !fs.existsSync(zipFile)) {
            test.skip('Test files missing');
            return;
        }

        const fileInput = page.locator('#logFilesInput');

        // --- Step 1: Initial Load ---
        console.log('Step 1: Uploading initial log file...');
        await fileInput.setInputFiles(initFile);

        // Wait for processing
        await page.waitForFunction(() => {
            // Wait for "Data loaded" or similar indication. For binary logs, text worker returns 0 lines.
            // But we can check if fileTasks populated.
            // A safer bet involves waiting for UI or checking console logs (done via listener in previous tests).
            // Here, let's just wait for the BTSnoop tab to be interactable.
            return document.querySelector('[data-tab="btsnoop"]');
        });
        await page.waitForTimeout(1000); // Wait for asyncs

        // Switch to BTSnoop Tab
        console.log('Switching to BTSnoop tab...');
        const btsnoopTab = page.locator('[data-tab="btsnoop"]');
        await btsnoopTab.click();

        // Wait for rows to appear
        await page.waitForSelector('.btsnoop-row', { state: 'visible', timeout: 10000 });
        const initialCount = await page.locator('.btsnoop-row').count();
        console.log(`Initial rows: ${initialCount}`);
        expect(initialCount).toBeGreaterThan(0);

        // --- Step 2: Reload with ZIP while on Tab ---
        console.log('Step 2: Uploading ZIP file while valid BTSnoop tab is active...');

        // IMPORTANT: We need to ensure the Input change event fires even if we upload.
        // Playwright handles this.
        await fileInput.setInputFiles(zipFile);

        // Handle Modal if it appears (for ZIPs) -> "Sort by Name" usually defaults or we might need to click process
        // Is there a modal?
        // "Files found in zip: ... Process" button?
        // Let's check if modal appears.
        const modal = page.locator('#zip-modal');
        try {
            await expect(modal).toBeVisible({ timeout: 5000 });
            console.log('ZIP Modal appeared. Clicking Process...');
            await page.click('#process-zip-btn');
        } catch (e) {
            console.log('No ZIP modal appeared (or auto-processed).');
        }

        // Wait for processing to complete.
        // The key indicator of failure is if it stucks or shows "No files".
        // We wait for progress bar to finish.
        await expect(page.locator('#progressBar').first()).toBeHidden({ timeout: 60000 });

        // WAIT a bit for the logic to trigger (trigger is what we are testing)
        await page.waitForTimeout(3000);

        // --- Verification ---
        // 1. Are we still on BTSnoop tab? (Should be, we didn't click away)
        await expect(btsnoopTab).toHaveClass(/active/);

        // 2. Are rows visible?
        // If bug exists, it might show "No btsnoop_hci.log files found" or just empty.
        const rows = page.locator('.btsnoop-row');
        const count = await rows.count();
        console.log(`Rows after reload: ${count}`);

        // Check for error message
        const errorMsg = page.locator('#btsnoopInitialView');
        const errorText = await errorMsg.textContent();
        console.log(`Initial View Text: "${errorText}"`);

        if (errorText.includes('No btsnoop_hci.log files found')) {
            throw new Error('Bug Reproduced: Shows "No btsnoop files" after reload');
        }

        expect(count).toBeGreaterThan(0);
        // Ideally count should match initial or be similar (same file source)
    });
});
