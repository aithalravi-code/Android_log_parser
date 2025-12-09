import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const MOCK_LOG_PATH = path.resolve(process.cwd(), 'benchmark_log.txt');

test.describe.serial('Legacy vs Current Performance Benchmark', () => {

    test.beforeAll(async () => {
        // Create realistic test data: 10,000 lines with mixed log levels
        const logLines = ['--------- beginning of system'];
        for (let i = 0; i < 10000; i++) {
            const levels = ['V', 'D', 'I', 'W', 'E'];
            const level = levels[i % 5];
            const timestamp = `09-23 12:${String(Math.floor(i / 60) % 60).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}.${String(i % 1000).padStart(3, '0')}`;
            logLines.push(`${timestamp} 1000 ${1000 + (i % 100)} 0 ${level} TestTag${i % 10} : Benchmark log line ${i} with some content`);
        }
        fs.writeFileSync(MOCK_LOG_PATH, logLines.join('\n'));
        console.log(`\n📊 Created benchmark file: ${logLines.length} lines\n`);
    });

    const runBenchmark = async (page, name, url) => {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`  Benchmarking: ${name}`);
        console.log(`${'='.repeat(60)}\n`);

        const results = {};

        // 1. Load Time
        const startLoad = Date.now();
        await page.goto(url);
        await page.waitForSelector('#logFilesInput', { timeout: 15000 });
        results.loadTime = Date.now() - startLoad;
        console.log(`✓ Load Time: ${results.loadTime}ms`);

        // 2. Parse Time
        const startParse = Date.now();
        const fileInput = page.locator('#logFilesInput');
        await fileInput.setInputFiles(MOCK_LOG_PATH);

        // Wait for logs to appear
        await page.waitForSelector('.log-line:not(.log-line-meta)', { timeout: 30000 });
        results.parseTime = Date.now() - startParse;
        console.log(`✓ Parse Time: ${results.parseTime}ms (10k lines)`);

        // Count rendered lines
        const lineCount = await page.locator('.log-line:not(.log-line-meta)').count();
        console.log(`  → Rendered ${lineCount} log lines`);

        // 3. Filter Speed (Toggle Verbose OFF)
        await page.waitForTimeout(500); // Let UI settle
        const startFilter = Date.now();
        // Use JavaScript to click directly to avoid viewport issues
        await page.evaluate(() => {
            const btn = document.querySelector('[data-level="V"]');
            if (btn) btn.click();
        });
        await page.waitForTimeout(200); // Wait for filter to apply
        results.filterTime = Date.now() - startFilter;
        console.log(`✓ Filter Time: ${results.filterTime}ms (Toggle Verbose)`);

        const filteredCount = await page.locator('.log-line:not(.log-line-meta)').count();
        console.log(`  → Filtered to ${filteredCount} lines`);

        // 4. Tab Switch Time (Logs -> Stats)
        await page.click('[data-tab="logs"]'); // Ensure we're on logs
        await page.waitForTimeout(200);

        const startTab = Date.now();
        await page.click('[data-tab="stats"]');
        await page.waitForSelector('#statsTab.active', { timeout: 5000 });
        results.tabSwitchTime = Date.now() - startTab;
        console.log(`✓ Tab Switch Time: ${results.tabSwitchTime}ms (Logs → Stats)`);

        // 5. Second Tab Switch (Cached)
        await page.click('[data-tab="logs"]');
        await page.waitForTimeout(200);

        const startTabCached = Date.now();
        await page.click('[data-tab="stats"]');
        await page.waitForSelector('#statsTab.active', { timeout: 5000 });
        results.tabSwitchCached = Date.now() - startTabCached;
        console.log(`✓ Tab Switch (Cached): ${results.tabSwitchCached}ms`);

        console.log('');
        return results;
    };

    test('Compare Performance', async ({ browser }) => {
        const page = await browser.newPage();

        // Capture ALL console messages
        page.on('console', msg => {
            const type = msg.type();
            const text = msg.text();
            if (type === 'error' || text.includes('Error') || text.includes('Failed')) {
                console.log(`[Browser ${type.toUpperCase()}] ${text}`);
            }
        });

        // Benchmark Legacy
        const legacyResults = await runBenchmark(page, 'LEGACY (Pre-Vite)', 'http://localhost:8082/src/index.html');

        // Benchmark Current
        const currentResults = await runBenchmark(page, 'CURRENT (Vite)', 'http://localhost:8081/index.html');

        // Print Comparison
        console.log(`\n${'='.repeat(60)}`);
        console.log('  📊 PERFORMANCE COMPARISON');
        console.log(`${'='.repeat(60)}\n`);

        const metrics = [
            { name: 'Load Time', legacy: legacyResults.loadTime, current: currentResults.loadTime },
            { name: 'Parse Time (10k)', legacy: legacyResults.parseTime, current: currentResults.parseTime },
            { name: 'Filter Time', legacy: legacyResults.filterTime, current: currentResults.filterTime },
            { name: 'Tab Switch', legacy: legacyResults.tabSwitchTime, current: currentResults.tabSwitchTime },
            { name: 'Tab Switch (Cached)', legacy: legacyResults.tabSwitchCached, current: currentResults.tabSwitchCached }
        ];

        metrics.forEach(({ name, legacy, current }) => {
            const diff = current - legacy;
            const pct = ((diff / legacy) * 100).toFixed(1);
            const symbol = diff > 0 ? '🔴' : '🟢';
            const sign = diff > 0 ? '+' : '';
            console.log(`${symbol} ${name.padEnd(20)} | Legacy: ${String(legacy).padStart(5)}ms | Current: ${String(current).padStart(5)}ms | Δ ${sign}${diff}ms (${sign}${pct}%)`);
        });

        console.log(`\n${'='.repeat(60)}\n`);

        // Assertions
        expect(currentResults.loadTime).toBeLessThan(legacyResults.loadTime * 1.5); // Allow 50% slower
        expect(currentResults.parseTime).toBeLessThan(legacyResults.parseTime * 1.5);
        expect(currentResults.filterTime).toBeLessThan(legacyResults.filterTime * 2); // Allow 2x slower
    });
});
