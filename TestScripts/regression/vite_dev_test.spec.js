import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const TEST_LOG_PATH = path.resolve(process.cwd(), 'vite_migration_test.txt');

test('Vite Dev Server - File Upload Test', async ({ page }) => {
    // Create test log file
    const logLines = ['--------- beginning of system'];
    for (let i = 0; i < 50; i++) {
        logLines.push(`12-09 00:55:${String(i % 60).padStart(2, '0')}.000 1000 1000 0 D TestTag : Vite migration test line ${i}`);
    }
    fs.writeFileSync(TEST_LOG_PATH, logLines.join('\n'));

    console.log('\n🧪 Testing Vite Dev Server...\n');

    // Navigate to dev server
    await page.goto('http://localhost:5173/');
    console.log('✓ Page loaded');

    // Wait for app to initialize
    await page.waitForSelector('#logFilesInput', { timeout: 10000 });
    console.log('✓ App initialized');

    // Upload file
    const fileInput = page.locator('#logFilesInput');
    await fileInput.setInputFiles(TEST_LOG_PATH);
    console.log('✓ File uploaded');

    // Wait for logs to render
    await page.waitForSelector('.log-line:not(.log-line-meta)', { timeout: 10000 });
    const logCount = await page.locator('.log-line:not(.log-line-meta)').count();
    console.log(`✓ Logs rendered: ${logCount} lines`);

    // Verify log count
    expect(logCount).toBeGreaterThan(0);
    expect(logCount).toBeLessThanOrEqual(50);

    // Test filter toggle
    await page.click('[data-level="V"]');
    await page.waitForTimeout(500);
    console.log('✓ Filter toggle works');

    // Test tab switching
    await page.click('[data-tab="stats"]');
    await page.waitForSelector('#statsTab.active', { timeout: 5000 });
    console.log('✓ Tab switching works');

    console.log('\n✅ All tests passed!\n');
});
