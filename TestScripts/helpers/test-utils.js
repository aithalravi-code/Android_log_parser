/**
 * Shared Test Utilities
 * Common helper functions for E2E tests
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

/**
 * Returns the path to a test fixture file.
 * In CI environments (process.env.CI === 'true'), returns path to the small
 * mock-data version so the large real files don't need to be committed.
 * Locally, returns the full-fidelity version in TestData/fixtures/.
 *
 * @param {string} filename - File name (e.g., 'bugreport-caiman-BP3A.250905.014-2025-09-24-10-26-57.zip')
 * @returns {string} Absolute path to the fixture file
 */
export function getFixturePath(filename) {
    const subDir = process.env.CI ? 'mock-data' : 'fixtures';
    return path.resolve(projectRoot, 'TestData', subDir, filename);
}

/**
 * Wait for log processing to complete
 * @param {Page} page - Playwright page object
 * @param {number} timeout - Maximum wait time in ms (default: 30000)
 */
export async function waitForLogProcessing(page, timeout = 30000) {
    // Wait for file display to update
    await page.waitForFunction(() => {
        const display = document.getElementById('current-file-display');
        return display && display.textContent.trim().length > 0;
    }, null, { timeout });

    // Wait for log lines to appear
    await page.waitForFunction(() => {
        const viewport = document.getElementById('logViewport');
        return viewport && viewport.querySelectorAll('.log-line').length > 0;
    }, null, { timeout });

    // Give a bit more time for rendering to stabilize
    await page.waitForTimeout(500);
}

/**
 * Clear application state (IndexedDB and UI)
 * @param {Page} page - Playwright page object
 */
export async function clearAppState(page) {
    // Click clear state button if available
    await ensureSidebarExpanded(page);
    const clearBtn = page.locator('#clearStateBtn');
    if (await clearBtn.isVisible()) {
        await clearBtn.click();
        await page.waitForTimeout(500);
    }

    // Also clear IndexedDB directly
    await page.evaluate(() => {
        return new Promise((resolve) => {
            const request = indexedDB.deleteDatabase('logParserDB');
            request.onsuccess = () => resolve(true);
            request.onerror = () => resolve(false);
        });
    });

    await page.waitForTimeout(500);
}

/**
 * Upload a file and wait for processing
 * @param {Page} page - Playwright page object
 * @param {string|string[]} filePath - Path to file(s) to upload
 * @param {Object} options - Options
 * @param {number} options.timeout - Timeout in ms
 * @param {boolean} options.waitForProcessing - Wait for processing to complete
 */
export async function uploadFile(page, filePath, options = {}) {
    const { timeout = 30000, waitForProcessing = true } = options;

    const fileInput = page.locator('#logFilesInput');
    await fileInput.setInputFiles(filePath);

    if (waitForProcessing) {
        await waitForLogProcessing(page, timeout);
    }
}

/**
 * Get current log line count
 * @param {Page} page - Playwright page object
 * @returns {Promise<number>} - Number of log lines
 */
export async function getLogCount(page) {
    return await page.evaluate(() => {
        return window._debug?.originalLogLines()?.length || 0;
    });
}

/**
 * Get filtered log line count
 * @param {Page} page - Playwright page object
 * @returns {Promise<number>} - Number of filtered log lines
 */
export async function getFilteredLogCount(page) {
    return await page.evaluate(() => {
        return window._debug?.filteredLogLines()?.length || 0;
    });
}

/**
 * Apply filters to logs
 * @param {Page} page - Playwright page object
 * @param {Object} filters - Filter configuration
 * @param {string[]} filters.levels - Log levels to enable (e.g., ['E', 'W'])
 * @param {string} filters.search - Search keyword
 * @param {string} filters.tag - Tag filter
 * @param {string} filters.logic - 'AND' or 'OR' logic
 * @param {Object} filters.timeRange - Time range {start, end}
 */
export async function applyFilters(page, filters = {}) {
    const { levels, search, tag, logic, timeRange } = filters;

    // Ensure sidebar is visible before interacting with filters
    await ensureSidebarExpanded(page);

    // Apply log level filters
    if (levels) {
        // First, disable all levels
        const allLevels = ['V', 'D', 'I', 'W', 'E'];
        for (const level of allLevels) {
            const btn = page.locator(`[data-level="${level}"]`);
            const isActive = await btn.evaluate(el => el.classList.contains('active'));
            if (isActive && !levels.includes(level)) {
                await btn.click();
                await page.waitForTimeout(100);
            } else if (!isActive && levels.includes(level)) {
                await btn.click();
                await page.waitForTimeout(100);
            }
        }
    }

    // Apply search keyword
    if (search !== undefined) {
        const searchInput = page.locator('#searchInput');
        if (search === '') {
            await searchInput.fill('');
            await searchInput.press('Enter');
            // Clear all chips using internal debug helper
            await page.evaluate(() => {
                const debugKeys = window._debug ? Object.keys(window._debug) : 'undefined';
                console.log(`[Test Debug] window._debug keys: ${debugKeys}`);
                if (window._debug && window._debug.clearKeywords) {
                    window._debug.clearKeywords();
                } else {
                    console.log('[Test Debug] clearKeywords not found, using fallback');
                    // Fallback to DOM manipulation if helper not available
                    const chips = document.querySelectorAll('.remove-chip');
                    chips.forEach(chip => chip.click());
                }
            });
        } else {
            await searchInput.fill(search);
            await searchInput.press('Enter');
        }
        await page.waitForTimeout(300);
    }

    // Apply tag filter
    if (tag !== undefined) {
        const tagInput = page.locator('#tagInput');
        if (tagInput) {
            await tagInput.fill(tag);
            await page.waitForTimeout(300);
        }
    }

    // Apply AND/OR logic
    if (logic) {
        const logicBtn = logic === 'AND' ? page.locator('#logicAndBtn') : page.locator('#logicOrBtn');
        await logicBtn.click();
        await page.waitForTimeout(100);
    }

    // Apply time range
    if (timeRange) {
        if (timeRange.start) {
            const startInput = page.locator('#startTime');
            await startInput.fill(timeRange.start);
        }
        if (timeRange.end) {
            const endInput = page.locator('#endTime');
            await endInput.fill(timeRange.end);
        }
        await page.waitForTimeout(300);
    }

    // Wait for filtering to complete
    await page.waitForTimeout(3000);
}

/**
 * Switch to a specific tab
 * @param {Page} page - Playwright page object
 * @param {string} tabName - Tab name (e.g., 'logs', 'btsnoop', 'stats', 'ccc')
 */
export async function switchTab(page, tabName) {
    const tab = page.locator(`[data-tab="${tabName}"]`);
    await tab.click();
    await page.waitForTimeout(500); // Wait for tab content to render
}

/**
 * Wait for BTSnoop processing
 * @param {Page} page - Playwright page object
 * @param {number} timeout - Timeout in ms
 */
export async function waitForBTSnoopProcessing(page, timeout = 30000) {
    // Wait for BTSnoop tab to be available
    await page.waitForSelector('[data-tab="btsnoop"]', { timeout });

    // Switch to BTSnoop tab
    await switchTab(page, 'btsnoop');

    // Wait for packets to appear
    await page.waitForSelector('.btsnoop-row', { state: 'visible', timeout });
}

/**
 * Get BTSnoop packet count
 * @param {Page} page - Playwright page object
 * @returns {Promise<number>} - Number of packets
 */
export async function getBTSnoopPacketCount(page) {
    return await page.evaluate(() => {
        return window._debug?.btsnoopPackets?.length || 0;
    });
}

/**
 * Wait for chart to render
 * @param {Page} page - Playwright page object
 * @param {string} chartSelector - CSS selector for chart container
 */
export async function waitForChartRender(page, chartSelector) {
    await page.waitForSelector(chartSelector, { state: 'visible' });

    // Wait for canvas or SVG to appear
    await page.waitForFunction(
        (selector) => {
            const container = document.querySelector(selector);
            return container && (container.querySelector('canvas') || container.querySelector('svg'));
        },
        chartSelector,
        { timeout: 10000 }
    );
}

/**
 * Trigger download and get downloaded file path
 * @param {Page} page - Playwright page object
 * @param {Function} downloadTrigger - Function that triggers the download
 * @returns {Promise<Download>} - Playwright Download object
 */
export async function triggerDownload(page, downloadTrigger) {
    const downloadPromise = page.waitForEvent('download');
    await downloadTrigger();
    const download = await downloadPromise;
    return download;
}

/**
 * Check if element is in viewport
 * @param {Page} page - Playwright page object
 * @param {string} selector - CSS selector
 * @returns {Promise<boolean>} - True if in viewport
 */
export async function isInViewport(page, selector) {
    return await page.evaluate((sel) => {
        const element = document.querySelector(sel);
        if (!element) return false;

        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }, selector);
}

/**
 * Measure performance of an action
 * @param {Page} page - Playwright page object
 * @param {Function} action - Async function to measure
 * @returns {Promise<number>} - Duration in milliseconds
 */
export async function measurePerformance(page, action) {
    const startTime = Date.now();
    await action();
    return Date.now() - startTime;
}

/**
 * Get memory usage
 * @param {Page} page - Playwright page object
 * @returns {Promise<Object>} - Memory usage info
 */
export async function getMemoryUsage(page) {
    return await page.evaluate(() => {
        if (performance.memory) {
            return {
                usedJSHeapSize: performance.memory.usedJSHeapSize,
                totalJSHeapSize: performance.memory.totalJSHeapSize,
                jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
            };
        }
        return null;
    });
}

/**
 * Wait for worker to be ready
 * @param {Page} page - Playwright page object
 */
export async function waitForWorkerReady(page) {
    await page.waitForFunction(() => {
        return window._debug?.workerReady?.() || false;
    }, { timeout: 10000 });
}

/**
 * Scroll virtual list to position
 * @param {Page} page - Playwright page object
 * @param {string} containerSelector - Selector for scroll container
 * @param {number} scrollTop - Scroll position
 */
export async function scrollVirtualList(page, containerSelector, scrollTop) {
    await page.evaluate(
        ({ selector, position }) => {
            const container = document.querySelector(selector);
            if (container) {
                container.scrollTop = position;
            }
        },
        { selector: containerSelector, position: scrollTop }
    );
    await page.waitForTimeout(300); // Wait for virtual list to update
}

/**
 * Get visible log lines in viewport
 * @param {Page} page - Playwright page object
 * @returns {Promise<Array>} - Array of visible log line texts
 */
export async function getVisibleLogLines(page) {
    return await page.evaluate(() => {
        const viewport = document.getElementById('logViewport');
        if (!viewport) return [];

        const lines = Array.from(viewport.querySelectorAll('.log-line'));
        return lines.map(line => line.textContent.trim());
    });
}

/**
 * Check if app is in loading state
 * @param {Page} page - Playwright page object
 * @returns {Promise<boolean>} - True if loading
 */
export async function isLoading(page) {
    return await page.evaluate(() => {
        const spinner = document.querySelector('.loading-spinner, .spinner, [data-loading="true"]');
        return spinner && spinner.style.display !== 'none';
    });
}

/**
 * Wait for app to finish loading
 * @param {Page} page - Playwright page object
 * @param {number} timeout - Timeout in ms
 */
export async function waitForLoadingComplete(page, timeout = 30000) {
    const startTime = Date.now();
    while (await isLoading(page)) {
        if (Date.now() - startTime > timeout) {
            throw new Error('Timeout waiting for loading to complete');
        }
        await page.waitForTimeout(100);
    }
}

/**
 * Ensure the left sidebar/panel is expanded
 * This is necessary because the panel auto-collapses after file loading for better readability
 * @param {Page} page - Playwright page object
 */
export async function ensureSidebarExpanded(page) {
    const leftPanel = page.locator('.left-panel');
    const isCollapsed = await leftPanel.evaluate(el => el.classList.contains('collapsed'));

    if (isCollapsed) {
        await page.click('#panel-toggle-btn');
        // Wait for the collapse/expand transition (0.35s)
        await page.waitForTimeout(400);
    }
}
