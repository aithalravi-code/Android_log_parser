/**
 * Automated screenshot capture for documentation
 * Run with: node TestScripts/screenshots/capture-docs.js
 */

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const screenshotDir = path.resolve(__dirname, '../../docs/images');
const testDataDir = path.resolve(__dirname, '../../TestData');

async function captureScreenshots() {
    console.log('🎬 Starting screenshot capture...\n');

    const browser = await chromium.launch({
        headless: false // Show browser so you can see what's happening
    });

    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 }
    });

    const page = await context.newPage();

    try {
        // Navigate to app
        await page.goto('http://localhost:5173/log_parser.html');
        console.log('✓ Opened application');

        // Wait for app to load
        await page.waitForSelector('#fileInput', { timeout: 10000 });

        // 1. Main Interface (before upload)
        console.log('📸 Capturing: Main Interface...');
        await page.screenshot({
            path: path.join(screenshotDir, 'main-interface-empty.png'),
            fullPage: false
        });

        // Upload a sample log file
        const sampleLog = `--------- beginning of system
12-17 16:00:00.000  1000  1000 I SystemUI : Application started
12-17 16:00:01.000  1000  1000 D Bluetooth : BT enabled
12-17 16:00:02.000  1000  1000 E Camera   : Failed to connect
12-17 16:00:03.000  1000  1000 W Audio    : Audio focus lost
12-17 16:00:04.000  1000  1000 V Sensors  : Accelerometer reading
12-17 16:00:05.000  1000  1000 E System   : OutOfMemoryError
12-17 16:00:06.000  1000  1000 I NetworkManager : WiFi connected
12-17 16:00:07.000  1000  1000 D ActivityManager : App launched
12-17 16:00:08.000  1000  1000 W Battery  : Battery low warning
12-17 16:00:09.000  1000  1000 E Crash    : Application crashed`;

        await page.locator('#logFilesInput').setInputFiles({
            name: 'sample.log',
            mimeType: 'text/plain',
            buffer: Buffer.from(sampleLog)
        });

        // Wait for logs to appear
        await page.waitForSelector('.log-line', { timeout: 5000 });
        console.log('✓ Logs loaded');

        // 2. Main Interface (with logs)
        console.log('📸 Capturing: Main Interface with logs...');
        await page.screenshot({
            path: path.join(screenshotDir, 'main-interface.png'),
            fullPage: false
        });

        // 3. Filtering in action
        console.log('📸 Capturing: Filtering...');

        // Apply keyword filter
        await page.locator('#keywordInput').fill('error, warning');
        await page.waitForTimeout(500);

        // Toggle some log levels off
        await page.locator('[data-level="V"]').click();
        await page.locator('[data-level="D"]').click();
        await page.locator('[data-level="I"]').click();
        await page.waitForTimeout(500);

        await page.screenshot({
            path: path.join(screenshotDir, 'filtering.png'),
            fullPage: false
        });

        // Reset filters for next screenshots
        await page.locator('#keywordInput').fill('');
        await page.locator('[data-level="V"]').click();
        await page.locator('[data-level="D"]').click();
        await page.locator('[data-level="I"]').click();
        await page.waitForTimeout(500);

        // 4. Statistics Tab
        console.log('📸 Capturing: Statistics Dashboard...');
        await page.locator('#statsTab').click();
        await page.waitForTimeout(2000); // Wait for charts to render

        await page.screenshot({
            path: path.join(screenshotDir, 'stats.png'),
            fullPage: false
        });

        // 5. Live Search
        console.log('📸 Capturing: Live Search...');
        await page.locator('#logsTab').click();
        await page.waitForTimeout(500);

        await page.locator('#liveSearchInput').fill('bluetooth');
        await page.waitForTimeout(500);

        await page.screenshot({
            path: path.join(screenshotDir, 'live-search.png'),
            fullPage: false
        });

        console.log('\n✅ All screenshots captured successfully!');
        console.log(`📁 Saved to: ${screenshotDir}\n`);

        console.log('📋 Captured screenshots:');
        console.log('  - main-interface-empty.png');
        console.log('  - main-interface.png');
        console.log('  - filtering.png');
        console.log('  - stats.png');
        console.log('  - live-search.png');

    } catch (error) {
        console.error('❌ Error capturing screenshots:', error.message);
        throw error;
    } finally {
        await browser.close();
    }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    captureScreenshots().catch(console.error);
}

export { captureScreenshots };
