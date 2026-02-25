/**
 * Filter Manager Module
 * Handles all filtering operations for log views
 */
import { logger } from '../utils/logger.js';
import { appState } from '../core/state/AppState.js';

/**
 * Computes a hash of the current filter state for caching
 * @param {Object} config - Filter configuration
 * @returns {string} Hash string
 */
export function computeFilterStateHash(config) {
    const {
        activeLogLevels = new Set(),
        keywords = [],
        isAndLogic = false,
        liveSearchQuery = '',
        startTime = null,
        endTime = null
    } = config;

    const parts = [
        Array.from(activeLogLevels).sort().join(','),
        keywords.map(k => `${k.text}:${k.active}`).join('|'),
        isAndLogic ? '1' : '0',
        liveSearchQuery || '',
        startTime || '',
        endTime || ''
    ];

    return parts.join('::');
}

/**
 * Checks if refiltering is needed for a tab
 * @param {string} tabId - Tab identifier
 * @param {string} currentHash - Current filter hash
 * @returns {boolean} True if refiltering is needed
 */
export function needsRefiltering(tabId, currentHash) {
    const cached = appState.filter.cachedResults[tabId];
    if (!cached) {
        return true;
    }
    return cached.hash !== currentHash;
}

/**
 * Caches filtered results for a tab
 * @param {string} tabId - Tab identifier
 * @param {string} hash - Filter hash
 * @param {Array} results - Filtered results
 */
export function cacheFilteredResults(tabId, hash, results) {
    appState.filter.cachedResults[tabId] = { hash, results: [...results] };
}

/**
 * Gets cached filter results
 * @param {string} tabId - Tab identifier
 * @returns {Array|null} Cached results or null
 */
export function getCachedResults(tabId) {
    const cached = appState.filter.cachedResults[tabId];
    return cached ? cached.results : null;
}

/**
 * Clears filter cache
 * @param {string} tabId - Optional tab ID to clear specific cache
 */
export function clearFilterCache(tabId = null) {
    if (tabId) {
        delete appState.filter.cachedResults[tabId];
    } else {
        appState.filter.clearCache();
    }
}

/**
 * Applies main log filters to a chunk of lines
 * @param {Array} lines - Lines to filter
 * @param {Object} collapseState - Collapse state tracker
 * @param {Set} activeCollapseSet - Set of collapsed headers
 * @param {Object} filterConfig - Filter configuration
 * @returns {Array} Filtered lines
 */
export function applyMainFilters(lines, collapseState, activeCollapseSet, filterConfig) {
    const {
        activeLogLevels = new Set(['V', 'D', 'I', 'W', 'E', 'F', 'A', 'S']),
        keywords = [],
        isAndLogic = false,
        liveSearchQuery = '',
        startTime = null,
        endTime = null,
        isTimeFilterActive = false
    } = filterConfig;

    logger.filter('START - Input lines:', lines.length, 'Active levels:', Array.from(activeLogLevels));

    const filtered = [];
    let rejectedByLevel = 0, rejectedByKeyword = 0, rejectedByLiveSearch = 0, rejectedByTime = 0, rejectedByCollapse = 0;

    // Pre-calculate active keywords to avoid doing it in the loop
    let activeKeywords = [];
    if (keywords.length > 0) {
        activeKeywords = keywords.filter(kw => kw.active).map(kw => ({
            regex: kw.regex || new RegExp(kw.text, 'i')
        }));
    }

    const liveRegex = liveSearchQuery ? new RegExp(liveSearchQuery, 'i') : null;

    for (const line of lines) {
        // Handle Meta (Header) Lines
        if (line.isMeta) {
            const currentHeader = line.originalText;
            collapseState.isInside = activeCollapseSet.has(currentHeader);

            // BUFFER the header. Do not push it yet.
            // We only push it if we find a matching line within this file.
            collapseState.pendingHeader = line;
            collapseState.headerPushed = false;

            // If collapsed, we previously skipped content lines.
            // FIX: We must NOT continue here if we want to support "Show Header if Matches Exist".
            // Actually, we DO continue, ensuring we process the NEXT lines (content).
            continue;
        }

        // --- FILTERING LOGIC ---
        // Note: We check filters even if collapsed (isInside=true) so we know if the Header should be shown.

        // Log level filter - treat lines without a level as 'V' (Verbose)
        const lineLevel = line.level || 'V';



        if (!activeLogLevels.has(lineLevel)) {
            rejectedByLevel++;
            continue;
        }

        // Keyword filter
        // ... (existing keyword logic) ...
        // Optimized keyword check (matches worker logic)
        let keywordMatch = true;

        if (activeKeywords.length > 0) {
            const textToScan = (line.message || line.originalText) + (line.tag || '');
            if (isAndLogic) {
                // AND: Must match ALL active keywords
                keywordMatch = activeKeywords.every(kw => kw.regex.test(textToScan));
            } else {
                // OR: Must match AT LEAST ONE active keyword
                keywordMatch = activeKeywords.some(kw => kw.regex.test(textToScan));
            }
        }

        if (!keywordMatch) {
            rejectedByKeyword++;
            continue;
        }


        // Live Search (Quick Filter)
        if (liveRegex && !liveRegex.test(line.originalText)) {
            rejectedByLiveSearch++;
            continue;
        }

        // Time Filter (UTC-based comparison)
        if (isTimeFilterActive && startTime && endTime) {
            let lineTime = null;
            if (line.dateObj) {
                lineTime = new Date(line.dateObj).getTime();
            } else if (line.timestamp) {
                lineTime = new Date(line.timestamp).getTime();
            }

            if (lineTime !== null && !isNaN(lineTime)) {
                const minTime = startTime.getTime();
                const maxTime = endTime.getTime();

                if (lineTime < minTime || lineTime > maxTime) {
                    if (isToken) console.log('[FilterManager] REJECTED TOKEN by Time:', new Date(lineTime).toISOString(), 'Range:', startTime.toISOString(), '-', endTime.toISOString());
                    rejectedByTime++;
                    continue;
                }
            } else {
                // No valid time, reject if strict? For now, we reject to be safe as per "missing timestamp" logic
                if (isToken) console.log('[FilterManager] REJECTED TOKEN by Invalid/Missing Timestamp');
                rejectedByTime++;
                continue;
            }
        }


        if (activeKeywords.length > 0) {
            const matches = activeKeywords.map(kw => kw.regex.test(line.originalText));
            if (isAndLogic) {
                if (!matches.every(m => m)) {
                    rejectedByKeyword++;
                    continue;
                }
            } else {
                if (!matches.some(m => m)) {
                    rejectedByKeyword++;
                    continue;
                }
            }
        }

        // Live search filter
        if (liveRegex && !liveRegex.test(line.originalText)) {
            rejectedByLiveSearch++;
            continue;
        }



        // --- MATCH FOUND ---

        // If we have a pending header that hasn't been pushed yet, push it now.
        // This ensures the header appears if ANY line in the section matches.
        if (collapseState.pendingHeader && !collapseState.headerPushed) {
            filtered.push(collapseState.pendingHeader);
            collapseState.headerPushed = true;
        }

        // --- COLLAPSE LOGIC ---
        // If content matches, we've enabled the header.
        // NOW we check if we should hide the content line itself.
        if (collapseState.isInside) {
            rejectedByCollapse++;
            continue;
        }

        filtered.push(line);
    }

    logger.filter('END - Output lines:', filtered.length,
        '| Rejected by: Level=', rejectedByLevel, 'Keyword=', rejectedByKeyword,
        'LiveSearch=', rejectedByLiveSearch, 'Time=', rejectedByTime, 'Collapse=', rejectedByCollapse);
    return filtered;
}

/**
 * Applies filters asynchronously with chunking to prevent UI freezing
 * @param {Array} sourceLines - Source lines to filter
 * @param {Object} config - Filter configuration
 * @param {Object} options - Additional options
 * @returns {Promise<Array>} Filtered lines
 */
export async function applyFiltersAsync(sourceLines, config, options = {}) {
    const {
        chunkSize = 50000,
        onProgress = null,
        collapseState = { isInside: false },
        activeCollapseSet = new Set()
    } = options;

    const currentVersion = appState.filter.incrementVersion();
    const tempFiltered = [];

    for (let i = 0; i < sourceLines.length; i += chunkSize) {
        // Check if a new filter operation has started
        if (appState.filter.version !== currentVersion) {
            return null; // Cancelled
        }

        const chunk = sourceLines.slice(i, i + chunkSize);
        const filteredChunk = applyMainFilters(chunk, collapseState, activeCollapseSet, config);
        tempFiltered.push(...filteredChunk);

        // Report progress if callback provided
        if (onProgress) {
            const progress = Math.min(100, ((i + chunkSize) / sourceLines.length) * 100);
            onProgress(progress);
        }

        // Yield to the main thread
        await new Promise(resolve => setTimeout(resolve, 0));
    }

    // Final check
    if (appState.filter.version !== currentVersion) {
        return null;
    }

    return tempFiltered;
}

/**
 * Gets the current filter version (for cancellation)
 * @returns {number} Current filter version
 */
export function getFilterVersion() {
    return appState.filter.version;
}

/**
 * Increments and returns the filter version
 * @returns {number} New filter version
 */
export function incrementFilterVersion() {
    return appState.filter.incrementVersion();
}

/**
 * Resets the filter manager state
 */
export function resetFilterManager() {
    appState.filter.reset();
}
