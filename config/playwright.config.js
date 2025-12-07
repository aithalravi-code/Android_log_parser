import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for E2E testing
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
    // Test directory
    testDir: '../tests/e2e',

    // Test file pattern
    testMatch: '**/*.spec.js',

    // Timeout for each test
    timeout: 30000,

    // Expect timeout
    expect: {
        timeout: 5000
    },

    // Run tests in files in parallel
    fullyParallel: true,

    // Fail the build on CI if you accidentally left test.only in the source code
    forbidOnly: !!process.env.CI,

    // Retry on CI only
    retries: process.env.CI ? 2 : 0,

    // Number of workers
    workers: process.env.CI ? 1 : undefined,

    // Reporter configuration
    reporter: [
        ['list'],
        ['html', { outputFolder: '../results/playwright-report', open: 'never' }],
        ['json', { outputFile: '../results/test-results/e2e-results.json' }],
        ['junit', { outputFile: '../results/test-results/e2e-results.xml' }],
        ['allure-playwright', { outputFolder: '../results/allure-results' }]
    ],

    // Shared settings for all projects
    use: {
        // Base URL for navigation
        baseURL: 'file:///home/rk/Documents/Android_log_parser (copy)/src/index.html',

        // Collect trace when retrying the failed test
        trace: 'on-first-retry',

        // Screenshot on failure
        screenshot: 'only-on-failure',

        // Video on failure
        video: 'retain-on-failure',

        // Viewport size
        viewport: { width: 1920, height: 1080 },

        // Action timeout
        actionTimeout: 10000,

        // Navigation timeout
        navigationTimeout: 30000,

        // Ignore HTTPS errors
        ignoreHTTPSErrors: true,

        // Locale
        locale: 'en-US',

        // Timezone
        timezoneId: 'America/New_York',

        // Context options
        contextOptions: {
            // Allow file access
            acceptDownloads: true
        }
    },

    // Configure projects for major browsers
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                // Enable Chrome DevTools Protocol for performance monitoring
                launchOptions: {
                    args: ['--enable-precise-memory-info']
                }
            }
        },

        {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] }
        },

        {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] }
        },

        // Mobile testing (optional)
        // {
        //   name: 'Mobile Chrome',
        //   use: { ...devices['Pixel 5'] }
        // },
        // {
        //   name: 'Mobile Safari',
        //   use: { ...devices['iPhone 12'] }
        // }
    ],

    // Output folder for test artifacts
    outputDir: '../results/test-results/artifacts',

    // Global setup/teardown
    // globalSetup: './tests/global-setup.js',
    // globalTeardown: './tests/global-teardown.js',

    // Web server configuration (if needed)
    // webServer: {
    //   command: 'npm run start',
    //   port: 3000,
    //   timeout: 120000,
    //   reuseExistingServer: !process.env.CI
    // }
});
