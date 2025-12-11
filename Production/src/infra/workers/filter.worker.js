// Filter Worker - Performs log filtering in background thread
// This worker receives log data and filter configuration, then returns matching line indices

let storedLogLines = [];

/**
 * Convert wildcard pattern to regex (duplicated from utils/regex.js for worker context)
 */
function wildcardToRegex(wildcard) {
    const escapedPattern = wildcard.replace(/([.+?^\\$\\{\\}()|[\\]\\\\])/g, "\\\\$1");
    // If no wildcard, do a whole-word search, which is faster and more precise.
    if (!wildcard.includes('*')) {
        return new RegExp(`\\b${escapedPattern}\\b`, 'i');
    }
    // Otherwise, treat as a "contains" search.
    const regexPattern = escapedPattern.replace(/\\\\\\*/g, '.*');
    return new RegExp(regexPattern, 'i');
}

/**
 * Main filter logic - returns indices of matching lines
 */
function runFilter(lines, config) {
    const { activeKeywords, isAndLogic, liveSearchQuery, activeLogLevels, timeRange, collapsedFileHeaders, isTimeFilterActive } = config;
    const logLevelsSet = new Set(activeLogLevels);
    const collapsedHeadersSet = new Set(collapsedFileHeaders);
    const keywordRegexes = activeKeywords.length > 0 ? activeKeywords.map(wildcardToRegex) : null;
    const liveSearchRegex = liveSearchQuery ? wildcardToRegex(liveSearchQuery) : null;

    // FIX: Append ':00Z' to treat datetime-local string as UTC, matching main thread logic.
    const startTimeResult = timeRange.start ? new Date(timeRange.start + ':00Z') : null;
    const endTimeResult = timeRange.end ? new Date(timeRange.end + ':00Z') : null;
    const indices = [];
    const checkTime = isTimeFilterActive && (startTimeResult || endTimeResult);
    let stateInsideCollapsed = false;
    let currentHeaderIndex = -1;
    let headerHasMatches = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.isMeta) {
            currentHeaderIndex = i;
            headerHasMatches = false;
            stateInsideCollapsed = collapsedHeadersSet.has(line.originalText);
            continue;
        }
        if (stateInsideCollapsed) continue;

        if (keywordRegexes) {
            const matches = isAndLogic
                ? keywordRegexes.every(regex => regex.test(line.originalText))
                : keywordRegexes.some(regex => regex.test(line.originalText));
            if (!matches) continue;
        }
        if (liveSearchRegex && !liveSearchRegex.test(line.originalText)) continue;
        if (checkTime && line.dateObj) {
            const d = new Date(line.dateObj);
            if (isNaN(d.getTime())) {
                // console.log('Invalid Date for line:', line.originalText);
                // continue; 
            }
            if ((startTimeResult && d < startTimeResult) || (endTimeResult && d > endTimeResult)) {
                // console.log('Skipping line time:', line.timestamp, 'Start:', startTimeResult.toISOString(), 'End:', endTimeResult.toISOString(), 'LogDate:', d.toISOString());
                continue;
            }
        }
        if (line.level && !logLevelsSet.has(line.level)) continue;

        if (!headerHasMatches && currentHeaderIndex !== -1) {
            indices.push(currentHeaderIndex);
            headerHasMatches = true;
        }
        indices.push(i);
    }
    return indices;
}

/**
 * Worker message handler
 */
self.onmessage = function (e) {
    const { command, jobId, payload } = e.data;
    try {
        switch (command) {
            case 'LOAD_DATA':
                storedLogLines = payload;
                self.postMessage({ command: 'LOAD_COMPLETE', jobId, count: storedLogLines.length });
                break;
            case 'FILTER':
                if (!storedLogLines || storedLogLines.length === 0) {
                    self.postMessage({ command: 'FILTER_COMPLETE', jobId, indices: [] });
                    return;
                }
                const indices = runFilter(storedLogLines, payload);
                self.postMessage({ command: 'FILTER_COMPLETE', jobId, indices });
                break;
            case 'CLEAR':
                storedLogLines = [];
                self.postMessage({ command: 'CLEARED', jobId });
                break;
        }
    } catch (error) {
        self.postMessage({ command: 'ERROR', jobId, error: error.message });
    }
};
