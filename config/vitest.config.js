import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

export default defineConfig({
    root: projectRoot,
    test: {
        // Test environment
        environment: 'jsdom',

        // Global test setup
        globals: true,

        // Coverage configuration
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html', 'lcov'],
            exclude: [
                'node_modules/',
                'tests/',
                'config/',
                '**/*.config.js',
                'src/jszip.min.js',
                'src/table-resize.js'
            ],
            thresholds: {
                lines: 70,
                functions: 70,
                branches: 65,
                statements: 70
            }
        },

        // Test file patterns
        include: ['tests/unit/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
        exclude: ['node_modules', 'dist', '.git', '.cache', 'tests/e2e/**', 'tests/performance/**', 'tests/integration/**'],

        // Test timeout
        testTimeout: 10000,
        hookTimeout: 10000,

        // Reporter configuration
        reporters: ['verbose', 'json', 'html'],
        outputFile: {
            json: 'results/test-results/unit-results.json',
            html: 'results/test-results/unit-results.html'
        },

        // Mock configuration
        mockReset: true,
        restoreMocks: true,

        // Parallel execution
        threads: true,
        maxThreads: 4,
        minThreads: 1,

        // Watch mode configuration
        watch: false,

        // Setup files
        setupFiles: ['tests/setup.js']
    },

    // Resolve configuration
    resolve: {
        alias: {
            '@': projectRoot
        }
    }
});
