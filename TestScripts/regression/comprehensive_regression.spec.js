import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Comprehensive Regression & Performance Suite', () => {
    const mockLogPath = path.resolve(process.cwd(), 'mock_regression_log.txt');

    test.beforeAll(async () => {
        // 1. Generate a robust mock log file with known data patterns for testing
        // Include CCC data, thermal data, and standard logs
        const logLines = [];

        // Header
        logLines.push('--------- beginning of system');

        // Standard Logs with timestamps covering a range
        // Format: MM-DD HH:mm:ss.SSS PID TID UID Level Tag : Message
        // This exercises the fix for the user's reported issue.
        logLines.push('09-23 12:30:00.000 1000 2139 3461 D TestTag : Standard log line');
        logLines.push('09-23 12:30:01.000 1000 2139 3461 I TestTag : <div should_not_be_raw>HTML Injection Check</div>');

        // Thermal Data (for Stats Tab - uses SIOP format via worker)
        for (let i = 0; i < 50; i++) {
            const temp = 300 + i * 1; // 30.0 to 35.0 (decimals * 10)
            // Format must contain SIOP:: and keys like AP, SKIN, matching the 3-column pattern
            logLines.push(`09-23 12:30:${String(i).padStart(2, '0')}.000 1000 1000 0 I Thermal : SIOP:: AP:${temp} SKIN:${temp - 20}`);
        }

        // Thermal Data (for Dashboard - uses tempRegex in main thread)
        // Regex: /(?:temp(?:erature)?|tsens_tz_sensor\d+):?\s*[:=]\s*(\d+)/i
        logLines.push('09-23 12:30:10.000 1000 1000 0 I Thermal : temperature: 35000'); // 35.0C

        // CCC Data (for CCC Tab)
        // Adding specific format that matches the parser's regex for CCC
        logLines.push('09-23 12:31:00.000 1000 1000 I CCC_LOG : OUTGOING: 020700');

        fs.writeFileSync(mockLogPath, logLines.join('\n'));
    });

    test.afterAll(async () => {
        // Cleanup
        if (fs.existsSync(mockLogPath)) {
            // fs.unlinkSync(mockLogPath); // Keep for debugging if needed
        }
    });

    test.beforeEach(async ({ page }) => {
        // Go to app
        await page.goto('file://' + path.resolve(process.cwd(), 'dist/index.html'));

        // Upload the mock file
        const fileInput = page.locator('#logFilesInput');
        await fileInput.setInputFiles(mockLogPath);

        // Wait for processing
        await page.waitForSelector('.log-line');
    });

    test('Regression: HTML should not be rendered as raw text', async ({ page }) => {
        // Check main log view
        const logContent = await page.textContent('#logContainer');
        expect(logContent).not.toContain('< div');
        expect(logContent).not.toContain('< span');

        // Check if the injection attempted in the log is escaped/rendered safely but NOT broken
        // The parser usually escapes HTML in messages.
        // We mainly want to ensure the *viewer's* own tags (like line numbers) aren't broken.
        // A broken tag looks like "- >" or "< div class="
        const rawHtml = await page.innerHTML('#logContainer');
        expect(rawHtml).not.toMatch(/<\s+div/);
        expect(rawHtml).not.toMatch(/<\s+span/);
    });

    test('Regression: Time Ranges should be populated', async ({ page }) => {
        const startTime = await page.inputValue('#startTimeInput');
        const endTime = await page.inputValue('#endTimeInput');

        console.log(`Detected Time Range: ${startTime} to ${endTime}`);

        // Should be ISO format: YYYY-MM-DDTHH:mm
        expect(startTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
        expect(endTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);

        // Should not contain spaces (the specific bug we fixed)
        expect(startTime).not.toContain(' -');
    });

    test('Regression: Thermal Analytics should be visible in Stats tab', async ({ page }) => {
        // Switch to Stats tab
        await page.click('[data-tab="stats"]');

        // Check for Thermal Chart container content
        const thermalChart = page.locator('#temperaturePlotContainer');
        await expect(thermalChart).toBeVisible();

        // Verify it has an SVG (meaning it rendered)
        const svgCount = await thermalChart.locator('svg').count();
        expect(svgCount).toBeGreaterThan(0);

        // Verify no raw HTML text in charts
        const chartHtml = await thermalChart.innerHTML();
        expect(chartHtml).not.toContain('< svg');
    });

    test('Performance: Tab Switching Benchmark', async ({ page }) => {
        // Benchmark switching between Logs and Stats

        // Warm up
        await page.click('[data-tab="stats"]');
        await page.waitForTimeout(100);
        await page.click('[data-tab="logs"]');
        await page.waitForTimeout(100);

        const iterations = 5;
        let totalTime = 0;

        for (let i = 0; i < iterations; i++) {
            const start = Date.now();
            await page.click('[data-tab="stats"]');
            // Wait for a unique element on the stats page to be visible
            await page.waitForSelector('#temperaturePlotContainer', { state: 'visible' });
            const duration = Date.now() - start;
            totalTime += duration;

            // Switch back
            await page.click('[data-tab="logs"]');
            await page.waitForSelector('#logContainer', { state: 'visible' });
        }

        const avgTime = totalTime / iterations;
        console.log(`Average Tab Switch Time (Logs -> Stats): ${avgTime.toFixed(2)}ms`);

        // Assert performance expectation (should be snappy, e.g., < 200ms)
        // Note: CI environments can be slower, so we set a reasonable upper bound
        expect(avgTime).toBeLessThan(300);
    });
});
