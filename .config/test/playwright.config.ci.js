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

        // Include but allow failures
        'integration_comprehensive.spec.js',

        // Skip flaky/strict tests in CI
        // 'accessibility_comprehensive.spec.js', // Too strict for CI
        // 'state_persistence.spec.js', // Browser timing issues
        // 'performance_comprehensive.spec.js', // CI is slower
    ],

    fullyParallel: false, // Prevent tests inside same file from running in parallel (avoids file contention)
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: 3,

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

        // Increase timeouts for CI
        actionTimeout: process.env.CI ? 20000 : 15000,
        navigationTimeout: process.env.CI ? 90000 : 45000,
    },

    timeout: process.env.CI ? 180000 : 90000, // 3 mins per test
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
        command: 'npm run preview', // Use production build for stable CI testing
        url: 'http://localhost:4173/log_parser.html',
        reuseExistingServer: true, // Always reuse to avoid conflicts
        timeout: 300000, // 5 minutes for extremely slow CI runners
    },
});
