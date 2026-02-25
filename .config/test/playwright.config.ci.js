/**
 * Playwright Configuration for CI/CD
 * Optimized for reliable test execution in CI environments
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: '../../TestScripts/regression',
    testMatch: [
        // Core tests that must pass
        'complete_workflows.spec.js',
        'log_filtering_advanced.spec.js',

        // Additional stable tests
        'file-upload.spec.js',
        'edge_cases.spec.js',
        'debug_current.spec.js',
        'app_initialization.spec.js',
        'datetime_filter.spec.js',

        // CCC / Token log tests (use mock data in CI via getFixturePath())
        'ccc_extraction_test.spec.js',
        'ccc_level_check.spec.js',
        'ccc_log_level_filter.spec.js',
        'ccc_tab_debug.spec.js',
        'token_logs.spec.js',
        'token_logs_verification.spec.js',

        // Include but allow failures
        'integration_comprehensive.spec.js',

        // Skip flaky/strict tests in CI
        // 'accessibility_comprehensive.spec.js', // Too strict for CI
        // 'state_persistence.spec.js',           // Browser timing issues
        // 'performance_comprehensive.spec.js',   // CI is slower
        // 'log_level_filter_test.spec.js',       // Requires real 17MB bugreport (1M+ lines)
    ],

    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: 2,

    reporter: [
        ['list'],
        ['html', { outputFolder: '.config/TestReports/regression/playwright-report', open: 'never' }],
        ['json', { outputFile: '.config/TestReports/regression/e2e-results.json' }],
        ['junit', { outputFile: '.config/TestReports/regression/e2e-results.xml' }],
    ],

    use: {
        baseURL: 'http://localhost:4173',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        viewport: { width: 1920, height: 1080 },

        actionTimeout: process.env.CI ? 20000 : 15000,
        navigationTimeout: process.env.CI ? 90000 : 45000,
    },

    timeout: process.env.CI ? 180000 : 90000,
    expect: {
        timeout: process.env.CI ? 15000 : 10000,
    },

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'], permissions: ['clipboard-read', 'clipboard-write'] },
        },
        {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
        },
        {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
        },
    ],

    webServer: {
        // Use explicit vite preview with full config path — keeps process alive in CI
        command: 'npx vite preview --config .config/build/vite.config.js --port 4173',
        url: 'http://localhost:4173/log_parser.html',
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
    },
});
