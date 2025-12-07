import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Integration/Performance testing
 */
export default defineConfig({
    // Test directory for integration tests
    testDir: './tests/integration',

    // Test file pattern
    testMatch: '**/*.spec.js',

    // Longer timeout for performance tests
    timeout: 120000, // 2 minutes

    // Expect timeout
    expect: {
        timeout: 10000
    },

    // Run tests sequentially for accurate performance measurements
    fullyParallel: false,
    workers: 1,

    // Retry on failure
    retries: 0,

    // Reporter configuration
    reporter: [
        ['list'],
        ['html', { outputFolder: 'playwright-report-integration', open: 'never' }],
        ['json', { outputFile: 'test-results/integration-results.json' }]
    ],

    // Shared settings
    use: {
        // Base URL - using HTTP server
        baseURL: 'http://localhost:8080',

        // Collect trace
        trace: 'on-first-retry',

        // Screenshot on failure
        screenshot: 'only-on-failure',

        // Video on failure
        video: 'retain-on-failure',

        // Viewport size
        viewport: { width: 1920, height: 1080 },

        // Longer timeouts for file operations
        actionTimeout: 30000,
        navigationTimeout: 60000,

        // Context options
        contextOptions: {
            acceptDownloads: true
        }
    },

    // Only test on Chromium for performance consistency
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                launchOptions: {
                    args: ['--enable-precise-memory-info']
                }
            }
        }
    ],

    // Output folder
    outputDir: 'test-results/integration-artifacts'
});
