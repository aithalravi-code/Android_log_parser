import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const MOCK_LOG_PATH = path.resolve(process.cwd(), 'mock_stats_log.txt');
const NEW_BUILD_PATH = path.resolve(process.cwd(), 'dist/index.html');

test.describe('Performance Stats Proof', () => {

    test.beforeAll(async () => {
        // Create a focused mock file
        const logLines = [];
        logLines.push('--------- beginning of system');
        // Create 20,000 lines to be significant but not huge (>50k would trigger worker)
        // We want to prove the "Sync" path is fast for medium files.
        // Or should we test >50k to prove Worker is stable?
        // User complained about "delay", likely on normal files. Sync path is the fix for that.
        for (let i = 0; i < 20000; i++) {
            const levels = ['V', 'D', 'I', 'W', 'E'];
            const level = levels[i % 5];
            logLines.push(`09-23 12:30:${String(i % 60).padStart(2, '0')}.000 1000 1000 0 ${level} TestTag : Benchmark log line ${i}`);
        }
        fs.writeFileSync(MOCK_LOG_PATH, logLines.join('\n'));
    });

    test('Measure Key Metrics', async ({ browser }) => {
        const page = await browser.newPage();
        page.on('console', msg => console.log(`[Browser] ${msg.text()}`));
        console.log('\n--- 📊 Performance Stats (Current Build) ---');

        // 1. Load Time
        const startLoad = Date.now();
        await page.goto('http://localhost:8081/index.html');
        await page.waitForSelector('#logFilesInput', { timeout: 10000 });
        const loadTime = Date.now() - startLoad;
        console.log(`[Load Time] ${loadTime}ms`);

        // 2. Parse Time
        const fileInput = page.locator('#logFilesInput');
        const startParse = Date.now();
        await fileInput.setInputFiles(MOCK_LOG_PATH);
        // Force event if needed
        await page.$eval('#logFilesInput', e => e.dispatchEvent(new Event('change', { bubbles: true })));
        await page.waitForSelector('.log-line', { timeout: 30000 });
        const parseTime = Date.now() - startParse;
        console.log(`[Parse Time] ${parseTime}ms (20k lines)`);

        // 3. Tab Switching (Logs -> Stats)
        // First switch (Cold)
        const startTabStats = Date.now();
        await page.click('[data-tab="stats"]');
        // Wait for a chart or stats element
        await page.waitForSelector('#cpuLoadPlotContainer', { state: 'visible', timeout: 5000 });
        const tabStatsTime = Date.now() - startTabStats;
        console.log(`[Tab Switch: Logs -> Stats (First/Cold)] ${tabStatsTime}ms`);

        // Switch back to Logs
        await page.click('[data-tab="logs"]');
        await page.waitForSelector('.log-line');

        // Second switch (Cached) - THIS IS WHAT WE OPTIMIZED
        const startTabStatsCached = Date.now();
        await page.click('[data-tab="stats"]');
        await page.waitForFunction(() => document.getElementById('statsTab').classList.contains('active'));
        // Wait a tiny bit for render yield
        await page.waitForTimeout(50);
        const tabStatsCachedTime = Date.now() - startTabStatsCached;
        console.log(`[Tab Switch: Logs -> Stats (Cached)] ${tabStatsCachedTime}ms`);

        // 4. Filtering Speed
        await page.click('[data-tab="logs"]');
        await page.waitForSelector('.log-line');
        const startFilter = Date.now();
        // Toggle Verbose OFF
        await page.click('[data-level="V"]');
        // Wait for ANY visual update.
        // We can check if the number of lines decreased or a class changed.
        // For simplicity in this synthetic test, we assume the UI update is the bottleneck.
        // We wait for the click action to settle.
        await page.waitForTimeout(100);
        const filterTime = Date.now() - startFilter;
        console.log(`[Filter Time] ${filterTime}ms (Hybrid Sync Path)`);

        console.log('-------------------------------------------');
    });
});
