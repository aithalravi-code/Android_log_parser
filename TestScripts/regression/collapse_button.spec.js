
import { test, expect } from '@playwright/test';
import { uploadFile, waitForLogProcessing, clearAppState } from '../helpers/test-utils.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Log Collapse Functionality', () => {
    let mockLogPath1;
    let mockLogPath2;
    // Use random suffix to avoid collision
    const tempDir = path.join(__dirname, `temp_collapse_test_${Date.now()}`);

    test.beforeAll(async () => {
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        mockLogPath1 = path.join(tempDir, 'file1.log');
        fs.writeFileSync(mockLogPath1, 'Line 1 from File 1\nLine 2 from File 1\nLine 3 from File 1');

        mockLogPath2 = path.join(tempDir, 'file2.log');
        fs.writeFileSync(mockLogPath2, 'Line 1 from File 2\nLine 2 from File 2');
    });

    test.afterAll(async () => {
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test.beforeEach(async ({ page }) => {
        page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
        await page.goto('/log_parser.html');
        await clearAppState(page);
    });

    test('Collapse All Button works', async ({ page }) => {
        // Upload 2 files
        // We can upload multiple files using input.setInputFiles
        const fileInput = page.locator('#logFilesInput');
        await fileInput.setInputFiles([mockLogPath1, mockLogPath2]);
        await waitForLogProcessing(page);

        // Verify headers are present
        const headers = page.locator('.log-line-meta');
        await expect(headers).toHaveCount(2);

        // Verify content lines are present (Total 5 content + 2 headers = 7 lines)
        // Note: log-line class is on all lines. meta has log-line-meta too.
        const allLines = page.locator('.log-line');
        // Wait for rendering
        await expect(allLines).toHaveCount(7);

        // Click Collapse All
        const collapseBtn = page.locator('#collapseAllBtn');
        await collapseBtn.click();

        // Wait for re-render
        await page.waitForTimeout(1000);

        // Should ideally only show headers (2 lines)
        // Or hidden via CSS? No, virtual scroll / filter removes them from DOM.
        await expect(allLines).toHaveCount(2);

        // Click Expand All (same button toggles)
        await collapseBtn.click();
        await page.waitForTimeout(1000);
        await expect(allLines).toHaveCount(7);
    });

    test('Individual File Header Click works', async ({ page }) => {
        // Upload 1 file
        await uploadFile(page, mockLogPath1);
        await waitForLogProcessing(page);

        // Verify content (3 lines + 1 header = 4)
        const allLines = page.locator('.log-line');
        await expect(allLines).toHaveCount(4);

        // Click header
        const header = page.locator('.log-line-meta').first();
        await header.click();

        // Wait for re-render
        await page.waitForTimeout(1000);

        // Should only show header (1 line)
        await expect(allLines).toHaveCount(1);

        // Click again to expand
        await header.click();
        await page.waitForTimeout(1000);
        await expect(allLines).toHaveCount(4);
    });
});
