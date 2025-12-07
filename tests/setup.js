/**
 * Test setup file for Vitest
 * Runs before all tests
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto'; // Mock IndexedDB for testing

// Global test setup
beforeAll(() => {
    console.log('🧪 Starting test suite...');

    // Mock browser APIs if needed
    global.performance = global.performance || {
        now: () => Date.now(),
        mark: () => { },
        measure: () => ({ duration: 0 }),
        clearMarks: () => { },
        clearMeasures: () => { },
        memory: {
            usedJSHeapSize: 1000000,
            totalJSHeapSize: 2000000,
            jsHeapSizeLimit: 4000000
        }
    };

    // Mock URL.createObjectURL for Web Workers
    global.URL.createObjectURL = () => 'blob:mock-url';
    global.URL.revokeObjectURL = () => { };

    // Mock Worker if not available
    if (typeof Worker === 'undefined') {
        global.Worker = class MockWorker {
            constructor() {
                this.onmessage = null;
            }
            postMessage() { }
            terminate() { }
        };
    }
});

// Cleanup after all tests
afterAll(() => {
    console.log('✅ Test suite completed');
});

// Reset state before each test
beforeEach(() => {
    // Clear any mocks or state
});

// Cleanup after each test
afterEach(() => {
    // Clean up any resources
});
