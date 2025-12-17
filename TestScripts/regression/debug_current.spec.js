import { test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const MOCK_LOG_PATH = path.resolve(process.cwd(), 'debug_test.txt');

test('Debug Current Build', async ({ browser }) => {
    // Create small test file
    const logLines = ['--------- beginning of system'];
    for (let i = 0; i < 100; i++) {
        logLines.push(`09-23 12:30:${String(i % 60).padStart(2, '0')}.000 1000 1000 0 D TestTag : Line ${i}`);
    }
    fs.writeFileSync(MOCK_LOG_PATH, logLines.join('\n'));

    const page = await browser.newPage();

    // Capture ALL console output
    page.on('console', msg => {
        console.log(`[Browser ${msg.type()}] ${msg.text()}`);
    });

    // Capture page errors
    page.on('pageerror', error => {
        console.log(`[Page Error] ${error.message}`);
    });

    console.log('\n🔍 Loading current build...');
    await page.goto('log_parser.html');
    await page.waitForSelector('#logFilesInput', { timeout: 10000 });
    console.log('✓ Page loaded');

    console.log('\n🔍 Uploading file...');
    const fileInput = page.locator('#logFilesInput');
    await fileInput.setInputFiles(MOCK_LOG_PATH);
    console.log('✓ File selected');

    console.log('\n🔍 Waiting for logs to render...');
    try {
        await page.waitForSelector('.log-line', { timeout: 10000 });
        const count = await page.locator('.log-line').count();
        console.log(`✓ SUCCESS! Rendered ${count} log lines`);
    } catch (e) {
        console.log(`✗ FAILED: ${e.message}`);

        // Check if processFiles was called
        const debugInfo = await page.evaluate(() => {
            return {
                hasOriginalLogLines: typeof originalLogLines !== 'undefined' && originalLogLines.length,
                hasFilteredLogLines: typeof filteredLogLines !== 'undefined' && filteredLogLines.length,
                logViewportHTML: document.getElementById('logViewport')?.innerHTML?.substring(0, 200)
            };
        });
        console.log('\nDebug Info:', JSON.stringify(debugInfo, null, 2));
    }

    await page.waitForTimeout(2000);
});
