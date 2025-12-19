
import { test, expect } from '@playwright/test';
import { uploadFile, waitForLogProcessing, clearAppState } from '../helpers/test-utils.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Clear and Reset Logic', () => {
    let mockLogPath;
    // Use random suffix to avoid collision between parallel workers
    const tempDir = path.join(__dirname, `temp_reset_test_${Date.now()}_${Math.floor(Math.random() * 1000)}`);

    test.beforeAll(async () => {
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir);
        }
        mockLogPath = path.join(tempDir, 'reset_test.log');
        fs.writeFileSync(mockLogPath, 'Line 1\nLine 2\nLine 3');
    });

    test.afterAll(async () => {
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test.beforeEach(async ({ page }) => {
        await page.goto('/log_parser.html');
        await clearAppState(page);
    });

    test('Clear and Reset button clears file name display', async ({ page }) => {
        // Upload file
        await uploadFile(page, mockLogPath);

        // Verify file name is displayed
        const display = page.locator('#current-file-display');
        await expect(display).toContainText('File: reset_test.log');

        // Click Clear & Reset (handle dialog)
        page.on('dialog', dialog => dialog.accept());
        const clearBtn = page.locator('#clearStateBtn');
        await clearBtn.click();

        // Wait for clear
        await page.waitForTimeout(500);

        // Verify file name is "No file chosen" or empty or default
        // In the fix, I set it to 'No file chosen'
        await expect(display).toHaveText('No file chosen');
    });
});
