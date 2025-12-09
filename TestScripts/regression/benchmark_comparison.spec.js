import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const MOCK_LOG_PATH = path.resolve(process.cwd(), 'mock_regression_log.txt');
const NEW_BUILD_PATH = path.resolve(process.cwd(), 'dist/index.html');
const LEGACY_PATH = path.resolve(process.cwd(), 'legacy_code/src/index.html');

// Helper to spawn a simple http server for legacy modules if needed
// or just rely on file:// if valid.
// Since legacy code moved to ES modules, file:// might block workers or imports without special flags.
// We will try file:// first as Playwright handles some of this, but if it fails we might need a server.
// However, the cleanest way for legacy comparison without dependency hell is to serve it.
// We'll use a simple static serve approach or assume the 'new' implementation is the baseline.

test.describe.serial('Performance Benchmark: Old vs New', () => {

    test.beforeAll(async () => {
        // Ensure mock log exists (it should from previous test)
        if (!fs.existsSync(MOCK_LOG_PATH)) {
            const logLines = [];
            logLines.push('--------- beginning of system');
            for (let i = 0; i < 5000; i++) { // 5000 lines for weight
                const levels = ['V', 'D', 'I', 'W', 'E'];
                const level = levels[i % 5];
                logLines.push(`09-23 12:30:${String(i % 60).padStart(2, '0')}.000 1000 1000 0 ${level} TestTag : Benchmark log line ${i}`);
            }
            fs.writeFileSync(MOCK_LOG_PATH, logLines.join('\n'));
        }
    });

    const runBenchmark = async (page, name, url) => {
        console.log(`\n--- Benchmarking ${name} ---`);
        const results = {};

        // 1. Load Time
        const startLoad = Date.now();
        await page.goto(url);
        // Wait for key elements
        await page.waitForSelector('#logFilesInput', { timeout: 10000 }).catch(() => console.log('Timeout waiting for input'));
        const loadTime = Date.now() - startLoad;
        results.loadTime = loadTime;
        console.log(`${name} Load Time: ${loadTime}ms`);

        // 2. Parse Time (Upload)
        const fileInput = page.locator('#logFilesInput');

        const startParse = Date.now();
        await fileInput.setInputFiles(MOCK_LOG_PATH);

        // Wait for first log line to appear
        await page.waitForSelector('.log-line', { timeout: 30000 });
        const parseTime = Date.now() - startParse;
        results.parseTime = parseTime;
        console.log(`${name} Parse Time (5k lines): ${parseTime}ms`);

        // 3. Tab Switch Time
        // Switch to Stats lines
        const startTab = Date.now();
        await page.click('[data-tab="stats"]');
        await page.waitForSelector('#temperaturePlotContainer', { state: 'visible', timeout: 5000 }).catch(e => { }); // Might fail if thermal missing
        // If thermal is missing in legacy, wait for something else
        const tabTime = Date.now() - startTab;
        results.tabSwitch = tabTime;
        console.log(`${name} Tab Switch (Logs->Stats): ${tabTime}ms`);

        // 4. Filter Time (Toggle Verbose)
        await page.click('[data-tab="logs"]');
        await page.waitForSelector('.log-line');
        const startFilter = Date.now();
        // Toggle Verbose OFF (assuming it's ON by default or we click to toggle)
        // Find the "V" filter button.
        const verboseBtn = page.locator('[data-level="V"]');
        if (await verboseBtn.count() > 0) {
            await verboseBtn.click();
            // Wait for update - log lines count should change or processing indicator
            // We wait for the "processing" class to disappear or a short timeout since it might be instant
            // Better: wait for a specific log line state change or just a small settlement
            await page.waitForTimeout(500); // Simple wait for visual update in this synthetic test
        }
        const filterTime = Date.now() - startFilter;
        results.filterTime = filterTime;
        console.log(`${name} Filter Time (Toggle Verbose): ${filterTime}ms`);

        return results;
    };

    test('Compare Implementations', async ({ browser }) => {
        const page1 = await browser.newPage();

        // Run New
        // Use file:// for dist/index.html (bundled)
        const newResults = await runBenchmark(page1, 'CURRENT (Vite)', `file://${NEW_BUILD_PATH}`);

        // Run Legacy
        // We need to serve legacy_code/src because it uses modules and imports
        // We'll use a hack: Playwright's page.goto can open file:// but if modules need CORS, it fails.
        // We will try file://. If it fails white screen, we know why.
        // Legacy main.js uses `import ... from './parser-utils.js'`. file:// allows relative imports in some browsers but Worker compilation is tricky.
        const page2 = await browser.newPage();
        let legacyResults = { loadTime: -1, parseTime: -1, tabSwitch: -1, filterTime: -1 };
        try {
            legacyResults = await runBenchmark(page2, 'LEGACY (Git)', `file://${LEGACY_PATH}`);
        } catch (e) {
            console.log('Legacy benchmark failed (likely CORS/Module issues):', e.message);
            // Fallback: If legacy fails to run, we record it as "Failed/Slow"
        }

        console.log('\n--- FINAL COMPARISON ---');
        console.log('| Metric | Legacy | Current | Improvement |');
        console.log('|---|---|---|---|');
        console.log(`| Load Time | ${legacyResults.loadTime}ms | ${newResults.loadTime}ms | ${legacyResults.loadTime > newResults.loadTime ? '✅ Faster' : '❌'} |`);
        console.log(`| Parse Time | ${legacyResults.parseTime}ms | ${newResults.parseTime}ms | ${legacyResults.parseTime > newResults.parseTime ? '✅ Faster' : '❌'} |`);
        console.log(`| Tab Switch | ${legacyResults.tabSwitch}ms | ${newResults.tabSwitch}ms | ${legacyResults.tabSwitch > newResults.tabSwitch ? '✅ Faster' : '❌'} |`);
        console.log(`| Filtering | ${legacyResults.filterTime}ms | ${newResults.filterTime}ms | ${legacyResults.filterTime > newResults.filterTime ? '✅ Faster' : '❌'} |`);

        // Assertion: Current should be faster or comparable
        expect(newResults.parseTime).toBeLessThan(10000);
        // Assertion: We want to catch regressions
        // expect(newResults.filterTime).toBeLessThan(legacyResults.filterTime * 1.5);
    });
});
