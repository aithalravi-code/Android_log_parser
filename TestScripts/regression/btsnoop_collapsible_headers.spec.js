import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import JSZip from 'jszip';

test.describe('BTSnoop Collapsible Headers', () => {
    const tempDir = path.resolve(process.cwd(), 'temp_test_data');

    test.beforeAll(async () => {
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
    });

    test.afterAll(async () => {
        // Cleanup
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('Should display collapsible file headers for multiple BTSnoop logs', async ({ page }) => {
        await page.goto('index.html');
        await page.waitForLoadState('networkidle');

        page.on('console', msg => console.log(`[Browser] ${msg.text()}`));

        // 1. Create a valid BTSnoop Log file (Header only is enough for parsing to accept it?)
        // Worker checks magic 'btsnoop\0'.
        // Header: 8 bytes magic + 4 bytes version + 4 bytes datalink = 16 bytes.
        const header = Buffer.from([
            0x62, 0x74, 0x73, 0x6e, 0x6f, 0x6f, 0x70, 0x00, // btsnoop\0
            0x00, 0x00, 0x00, 0x01, // Version 1
            0x00, 0x00, 0x03, 0xea  // ID 1002
        ]);

        // Create JSZip instance and add files in folders
        const zip = new JSZip();
        zip.file('device1/btsnoop_hci.log', header);
        zip.file('device2/btsnoop_hci.log', header);

        const zipContent = await zip.generateAsync({ type: 'nodebuffer' });
        const zipPath = path.join(tempDir, 'test_logs.zip');
        fs.writeFileSync(zipPath, zipContent);

        // 2. Upload ZIP file
        console.log('Uploading created ZIP file...');
        const fileInput = page.locator('#logFilesInput');
        await fileInput.setInputFiles(zipPath);

        // 3. Wait for processing
        // We expect the progress bar to appear and then disappear.
        // Or wait for the BTSnoop indicator/tab to be ready?
        // Since we know "Logs" tab gets processed first, wait for "Parsing files..." to be gone.
        await expect(page.locator('#progressBar').first()).toBeHidden({ timeout: 60000 });

        // Give it a small buffer for state updates
        await page.waitForTimeout(1000);

        // 4. Switch to BTSnoop Tab
        console.log('Switching to BTSnoop tab...');
        const btsnoopTab = page.locator('[data-tab="btsnoop"]');
        await btsnoopTab.click();

        // 5. Verify Headers Exist
        // We expect 2 headers: file1_hci.log and file2_hci.log
        const headers = page.locator('.btsnoop-file-header');
        await expect(headers.first()).toBeVisible({ timeout: 10000 });

        const headerCount = await headers.count();
        console.log(`Found ${headerCount} file headers.`);
        expect(headerCount).toBe(2);

        const texts = await headers.allTextContents();
        console.log('Header texts:', texts);
        // Both headers will say 'btsnoop_hci.log' because the app currently displays basenames.
        expect(texts.filter(t => t.includes('btsnoop_hci.log')).length).toBe(2);

        // 6. Test Collapse
        const firstHeader = headers.first();
        await firstHeader.click();
        expect(await firstHeader.textContent()).toContain('▶');
        await firstHeader.click();
        expect(await firstHeader.textContent()).toContain('▼');
    });
});
