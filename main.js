document.addEventListener('DOMContentLoaded', () => {
    // --- IndexedDB Helper ---
    const DB_NAME = 'logViewerDB';
    const DB_VERSION = 2;
    const LOG_STORE_NAME = 'logStore';
    const BTSNOOP_STORE_NAME = 'btsnoopStore';
    let db;

    function openDb() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onerror = (event) => reject('Error opening IndexedDB');
            request.onsuccess = (event) => {
                db = event.target.result;
                resolve(db);
            };
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(LOG_STORE_NAME)) {
                    db.createObjectStore(LOG_STORE_NAME, { keyPath: 'key' });
                }
                if (!db.objectStoreNames.contains(BTSNOOP_STORE_NAME)) {
                    const btsnoopStore = db.createObjectStore(BTSNOOP_STORE_NAME, { keyPath: 'number' });
                    btsnoopStore.createIndex('tags', 'tags', { multiEntry: true });
                }
            };
        });
    }

    function dbAction(type, key, value = null) {
        return new Promise((resolve, reject) => {
            if (!db) return reject('DB not open');
            const transaction = db.transaction([LOG_STORE_NAME], type);
            const store = transaction.objectStore(LOG_STORE_NAME);
            const request = type === 'readwrite' ? store.put({ key, value }) : store.get(key);
            transaction.oncomplete = () => resolve(request.result);
            transaction.onerror = (event) => reject('DB transaction error: ' + event.target.error);
        });
    }

    const saveData = (key, value) => dbAction('readwrite', key, value);
    const loadData = (key) => dbAction('readonly', key);
    const clearData = () => {
        return new Promise((resolve, reject) => {
            if (!db) return reject('DB not open');
            // Get all store names from the database
            const storeNames = Array.from(db.objectStoreNames);
            const transaction = db.transaction(storeNames, 'readwrite');
            storeNames.forEach(name => transaction.objectStore(name).clear());
            transaction.oncomplete = () => resolve();
            transaction.onerror = (event) => reject('DB clear error: ' + event.target.error);
        });
    };

    // --- UI Elements ---
    // --- UI Elements ---
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const zipInput = document.getElementById('zipInput');
    const logFilesInput = document.getElementById('logFilesInput');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');

    // --- OPTIMIZATION Phase 3: Web Worker for Filtering ---
    // --- OPTIMIZATION Phase 3: Web Worker for Filtering ---
    // Inlined for monolithic support (works without server/file://)
    const filterWorkerCode = `
    let storedLogLines = [];

    function wildcardToRegex(wildcard) {
        const escaped = wildcard.replace(/[.+^$\{ }()|[\\]\\\\]/g, '\\\\$&');
        const pattern = escaped.replace(/\\*/g, '.*');
        return new RegExp('^' + pattern + '$', 'i');
    }

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

    function runFilter(lines, config) {
        const { activeKeywords, isAndLogic, liveSearchQuery, activeLogLevels, timeRange, collapsedFileHeaders, isTimeFilterActive } = config;
        const logLevelsSet = new Set(activeLogLevels);
        const collapsedHeadersSet = new Set(collapsedFileHeaders);
        const keywordRegexes = activeKeywords.length > 0 ? activeKeywords.map(wildcardToRegex) : null;
        const liveSearchRegex = liveSearchQuery ? wildcardToRegex(liveSearchQuery) : null;
        
        const startTimeResult = timeRange.start ? new Date(timeRange.start) : null;
        const endTimeResult = timeRange.end ? new Date(timeRange.end) : null;
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
                if ((startTimeResult && d < startTimeResult) || (endTimeResult && d > endTimeResult)) continue;
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
    `;

    const filterWorkerBlob = new Blob([filterWorkerCode], { type: 'application/javascript' });
    const filterWorkerUrl = URL.createObjectURL(filterWorkerBlob);
    const filterWorker = new Worker(filterWorkerUrl);
    let currentFilterJobId = 0;
    let pendingFilterPromise = null;

    filterWorker.onmessage = function (e) {
        const { command, jobId, indices, error } = e.data;

        if (command === 'FILTER_COMPLETE') {
            if (pendingFilterPromise && pendingFilterPromise.jobId === jobId) {
                pendingFilterPromise.resolve(indices);
                pendingFilterPromise = null;
            }
        } else if (command === 'LOAD_COMPLETE') {
            console.log(`[Worker] Data loaded: ${e.data.count} lines`);
        } else if (command === 'ERROR') {
            console.error('[Worker Error]', error);
            if (pendingFilterPromise && pendingFilterPromise.jobId === jobId) {
                pendingFilterPromise.reject(error);
                pendingFilterPromise = null;
            }
        }
    };

    /**
     * Send log data to worker
     */
    function syncDataToWorker(lines) {
        // We use postMessage. For large arrays, implementation might copy.
        // Ideally we'd validte structured clone performance.
        console.log('[Worker] Syncing data...');
        filterWorker.postMessage({ command: 'LOAD_DATA', payload: lines });
    }

    /**
     * Request filtering from worker
     */
    function requestWorkerFilter(config) {
        return new Promise((resolve, reject) => {
            currentFilterJobId++;
            pendingFilterPromise = { jobId: currentFilterJobId, resolve, reject };

            filterWorker.postMessage({
                command: 'FILTER',
                jobId: currentFilterJobId,
                payload: config
            });
        });
    }

    // --- DOM Elements ---
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const searchInput = document.getElementById('searchInput');
    const startTimeInput = document.getElementById('startTime');
    const endTimeInput = document.getElementById('endTime');
    const keywordChipsContainer = document.getElementById('keywordChips');
    const logLevelButtons = document.querySelectorAll('#filterSection .filter-icon');
    const logLevelToggleBtn = document.getElementById('logLevelToggleBtn');
    const autocompleteSuggestions = document.getElementById('autocompleteSuggestions');
    const logicOrBtn = document.getElementById('logicOrBtn');
    const logicAndBtn = document.getElementById('logicAndBtn');
    const timeRangeSlider = document.getElementById('timeRangeSlider');
    const saveFiltersBtn = document.getElementById('saveFiltersBtn');
    const loadFiltersBtn = document.getElementById('loadFiltersBtn');
    const currentFileDisplay = document.getElementById('current-file-display');
    const logCounts = document.getElementById('logCounts');
    const errorDistribution = document.getElementById('errorDistribution');
    const systemStatusContainer = document.getElementById('systemStatusContainer');
    // These will be queried after the DOM is fully set up
    let cpuLoadStats, temperatureStats;
    let cpuLoadPlotContainer;
    let appVersionsTable;
    let batteryStats, batteryPlotContainer;
    let accountsList, deviceEventsTable, walletEventsTable;
    let storedHighlights = null; // Store highlights globally to preserve across BTSnoop processing
    let nfcFilterButtons, bleFilterButtons, dckFilterButtons;
    let bleLogContainer, bleLogSizer, bleLogViewport;
    let bleKeysTable;
    let btsnoopFilterButtons;
    let appSearchInput;
    let btsnoopColumnFilters;
    let nfcLogContainer, nfcLogSizer, nfcLogViewport;
    let dckLogContainer, dckLogSizer, dckLogViewport;
    let btsnoopLogContainer, btsnoopLogViewport;
    let kernelLogContainer, kernelLogSizer, kernelLogViewport;
    let btsnoopLogSizer;
    let btsnoopInitialView, btsnoopContentView, btsnoopFilterContainer;

    // Virtual scroll elements
    const logContainer = document.getElementById('logContainer');
    const logSizer = document.getElementById('logSizer');
    const logViewport = document.getElementById('logViewport');
    // Modal elements
    const zipModal = document.getElementById('zipModal');
    const zipFileSelection = document.getElementById('zipFileSelection');
    const toggleAllFiles = document.getElementById('toggleAllFiles');
    const fileSelectionDetails = document.getElementById('file-selection-details');
    const leftPanel = document.querySelector('.left-panel');
    const panelToggleBtn = document.getElementById('panel-toggle-btn');
    const resizeHandle = document.getElementById('resize-handle');
    const loadSelectedBtn = document.getElementById('loadSelectedBtn');
    const cancelZipSelectionBtn = document.getElementById('cancelZipSelectionBtn');
    const clearStateBtn = document.getElementById('clearStateBtn');

    // --- Application State ---
    let originalLogLines = []; // Holds all lines from all files, with metadata
    let filterKeywords = []; // Array of {text: string, active: boolean}
    let liveSearchQuery = ''; // For live filtering as the user types
    let currentZipFileName = ''; // To store the name of the loaded ZIP
    let isAndLogic = false; // Default to OR logic
    let activeLogLevels = new Set(['V', 'D', 'I', 'W', 'E']); // Default to all levels active
    let bleLogLines = []; // Holds all BLE-related log lines
    let filteredBleLogLines = []; // The currently filtered set of BLE lines
    let nfcLogLines = []; // Holds all NFC-related log lines
    let dckLogLines = []; // Holds all DCK-related log lines
    let btsnoopPackets = []; // Holds parsed btsnoop packets

    // NEW: Connectivity Tab Globals
    let connectivityLogLines = []; // Mapped/Merged lines for the connectivity view
    let filteredConnectivityLogLines = []; // The currently filtered set derived from connectivityLogLines
    let activeTechs = { ble: false, nfc: false, dck: true }; // Master Toggles State

    let filteredBtsnoopPackets = []; // Holds the filtered set of btsnoop packets
    // OPTIMIZATION Phase 3: Cache BTSnoop row positions
    let btsnoopRowPositions = [];
    let btsnoopTotalHeight = 0;
    let btsnoopConnectionEvents = []; // Holds LE Connection Complete events
    let btsnoopConnectionMap = new Map(); // Maps connection handle to BT address
    let cccStatsData = []; // Holds the filtered set of CCC packets
    let allAppVersions = []; // Holds all found app versions
    let filteredKernelLogLines = []; // The currently filtered set of Kernel lines
    let filteredLogLines = []; // The currently filtered set of lines
    let fileTasks = []; // Holds all discovered file tasks for later processing (e.g., btsnoop)
    let logTags = []; // Unique list of tags for autocomplete
    let zipEntriesToProcess = []; // Temp storage for entries from a zip
    let lastCheckedIndex = -1; // For shift-click selection
    let activeBleLayers = new Set(['manager', 'gatt', 'smp', 'hci']); // Default to all layers active
    let activeNfcLayers = new Set(['framework', 'hce', 'p2p', 'hal']); // Default to all layers active
    let activeBtsnoopFilters = new Set(['cmd', 'evt', 'acl', 'l2cap', 'smp', 'att']); // Holds active btsnoop filter types (e.g. 'cmd', 'evt') - Default ALL active
    let activeDckLayers = new Set(['manager', 'hal', 'oem']); // Default to all layers active
    let filterVersion = 0; // "Cancellation token" for async filtering
    let isProcessing = false; // Flag to prevent race conditions during filtering
    let btsnoopColumnFilterDebounceTimer = null;
    let userAnchorLine = null; // The log line object the user has clicked to anchor
    let mainScrollThrottleTimer = null; // For throttling main log scroll events
    let bleScrollListenerAttached = false;
    let collapsedFileHeaders = new Set(); // For collapsible file logs
    let nfcScrollListenerAttached = false;
    let dckScrollListenerAttached = false;
    let kernelScrollListenerAttached = false;
    let btsnoopScrollListenerAttached = false;
    let isBtsnoopProcessed = false; // FIX: New flag to prevent double processing.
    let btsnoopScrollThrottleTimer = null; // For throttling btsnoop scroll events
    let btsnoopRowPool = []; // For recycling DOM elements in btsnoop virtual scroll
    let selectedBtsnoopPacket = null; // Track the user-selected BTSnoop packet
    let currentBtsnoopGridTemplate = null; // Store the current grid column layout
    let localBtAddress = 'Host'; // Store the local device's BT address.

    // --- OPTIMIZATION Phase 1: Filter State Tracking & Caching ---
    let filterStateHash = null;
    let cachedFilteredResults = {
        logs: null,
        connectivity: null,
        btsnoop: null
    };

    // --- OPTIMIZATION Phase 1: CCC Stats Memoization ---
    let cccStatsRenderedHTML = null;
    let cccStatsDataHash = null;

    // --- OPTIMIZATION Phase 1: Debounced Save Timer ---
    let saveDebounceTimer = null;

    // --- OPTIMIZATION Phase 2: Lazy Loading State ---
    let tabsLoaded = {
        logs: true,      // Main logs always loaded
        ble: false,      // Load on first visit
        nfc: false,      // Load on first visit
        dck: false,      // Load on first visit
        kernel: false,   // Load on first visit
        btsnoop: false,  // Load on first visit
        stats: false     // Load on first visit
    };

    // --- Virtual Scroll State ---
    const LINE_HEIGHT = 20; // Estimated height of a single log line in pixels
    const BUFFER_LINES = 50; // Number of lines to render above/below the viewport

    // --- Time Filter State ---
    let minLogDate = null;
    let maxLogDate = null;
    let isTimeFilterActive = false;
    let debounceTimer = null;

    // --- Performance Debugging ---
    const TimeTracker = {
        tasks: {},
        start(name) {
            this.tasks[name] = { start: performance.now(), duration: 0, running: true };
        },
        stop(name) {
            if (this.tasks[name] && this.tasks[name].running) {
                this.tasks[name].duration = performance.now() - this.tasks[name].start;
                this.tasks[name].running = false;
            }
        },
        getResults() {
            return Object.entries(this.tasks)
                .map(([name, data]) => `${name.padEnd(35)}: ${data.duration.toFixed(2)} ms`)
                .join('\n');
        },
        reset() { this.tasks = {}; }
    };

    function handleMainLogScroll() {
        if (!mainScrollThrottleTimer) {
            mainScrollThrottleTimer = setTimeout(() => {
                // Pass the correct elements for the main log view
                renderVirtualLogs(logContainer, logSizer, logViewport, filteredLogLines);
                mainScrollThrottleTimer = null;
            }, 100); // OPTIMIZATION: Increased from 50ms to 100ms for better performance
        }
    }


    // --- Tab Navigation ---
    tabs.forEach(tab => {
        tab.addEventListener('click', async () => {
            // Deactivate all tabs and content
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Activate clicked tab and corresponding content
            tab.classList.add('active');
            const tabId = tab.dataset.tab;
            document.getElementById(tabId + 'Tab').classList.add('active');

            // FIX: Use requestAnimationFrame to ensure the tab is visible before rendering.
            // This is the definitive fix for the "47 lines" bug.
            requestAnimationFrame(() => {
                // When switching tabs, always refresh the view with the correct filters.
                refreshActiveTab();
            });
        });
    });

    function updateCollapsedMargin() {
        const panelWidth = leftPanel.offsetWidth;
        // Find the stylesheet and rule for .left-panel.collapsed
        for (const sheet of document.styleSheets) {
            try {
                for (const rule of sheet.cssRules) {
                    if (rule.selectorText === '.left-panel.collapsed') {
                        rule.style.marginLeft = `-${panelWidth}px`;
                        return;
                    }
                }
            } catch (e) {
                // Ignore CORS errors on external stylesheets
            }
        }
    }

    // =================================================================================
    // --- Style Injection for Log Levels ---
    // =================================================================================
    // Inject CSS for log level colors directly, as we can't edit the CSS file.
    function injectLogLevelStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* --- Android Studio Font --- */
            .log-line, .btsnoop-table {
                font-family: 'JetBrains Mono', 'Consolas', 'Menlo', 'Courier New', monospace;
                font-size: 13px;
            }
            /* FIX: Make the log line a flex container to prevent overlap */
            .log-line {
                display: flex;
                align-items: center;
                padding: 2px 5px;
                border-bottom: 1px solid #333;
                cursor: pointer;
                min-height: ${LINE_HEIGHT}px;
                box-sizing: border-box;
            }
            
            /* BTSnoop rows need absolute positioning for virtual scrolling */
            #btsnoopLogViewport .log-line {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
            }
            
            .log-line:hover {
                background-color: #444;
            }
            .log-line-E { color: #D32F2F; }
            .log-line-W { color: #FBC02D; }
            .log-line-I { color: #388E3C; }
            .log-line-D { color: #1976D2; }
            
            /* Line numbers - fixed width to prevent misalignment */
            .line-number {
                display: inline-block;
                width: 60px;
                text-align: right;
                padding-right: 10px;
                color: #888;
                flex-shrink: 0;
                font-size: 11px;
            }

            /* --- Table-based Layout for BTSnoop --- */
            #btsnoopContentView {
                display: flex;
                flex-direction: column;
                height: 100%;
            }
            /* --- Log Level Background Boxes --- */
            .log-level-box {
                display: inline-block;
                padding: 0 5px;
                margin: 0 5px;
                border-radius: 3px;
                color: #FFFFFF; /* White text on all backgrounds */
                flex-shrink: 0; /* Don't shrink */
                width: 20px; /* Fixed width for alignment */
                text-align: center;
            }
            .log-level-box.log-level-E { background-color: #D32F2F; }
            .log-level-box.log-level-W { background-color: #FBC02D; }
            .log-level-box.log-level-I { background-color: #388E3C; }
            .log-level-box.log-level-D { background-color: #1976D2; }
            .log-level-box.log-level-V { background-color: #757575; }

            /* --- Android Studio Style Log Lines --- */
            .log-line-content {
                display: flex;
                flex-direction: row;
                white-space: nowrap;
            }
            .log-meta {
                flex: 0 0 160px; /* Do not grow, do not shrink, base width 160px */
                white-space: nowrap;
            }
            .log-pid-tid {
                flex: 0 0 100px; /* Fixed width for PID-TID */
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .log-tag {
                flex: 0 0 180px; /* Fixed width for the tag */
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                color: #E0E0E0;
            }
            .log-message {
                flex-grow: 1; /* Take up remaining space */
                white-space: nowrap;
            }
            
            /* --- Enable horizontal scrolling for all log containers --- */
            .log-container {
                overflow-x: auto; /* This was correct */
                overflow-y: auto;
            }
            
            #btsnoopContentView {
                display: flex;
                flex-direction: column;
                height: 100%;
            }
            .btsnoop-table { /* A single class for both header and body tables */
                width: 100%;
                min-width: 1200px; /* Ensure table is wide enough to trigger horizontal scroll */
                table-layout: auto; /* FIX: Allow table to expand with content, enabling horizontal scroll */
                border-collapse: collapse;
            }
            
            #btsnoopLogContainer { /* The scrollable body container */
                flex-grow: 1;
                overflow-y: auto;
                overflow-x: auto; /* FIX: Enable horizontal scrolling */
                position: relative; /* Required for virtual scrolling viewport */
                width: 100%; /* Ensure container respects parent width */
            }
            
            #btsnoopLogSizer {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                min-width: 1200px; /* Match table min-width for horizontal scroll */
                pointer-events: none;
            }
            
            #btsnoopLogViewport {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                min-width: 1200px; /* Match table min-width for horizontal scroll */
            }
            
            /* BTSnoop row styling */
            .btsnoop-row {
                display: block;
                padding: 0;
                border-bottom: 1px solid #444;
            }
            
            .btsnoop-row table {
                width: 100%;
                min-width: 1200px; /* Match header table min-width */
                margin: 0;
                border-spacing: 0;
            }
            
            #btsnoopHeaderTable th {
                background-color: #f2f2f2;
                font-weight: bold;
                text-align: left;
                border-bottom: 2px solid #ccc;
            }
            .btsnoop-table th, .btsnoop-table td, .btsnoop-table .log-line-cell {
                padding: 2px 5px;
                overflow: hidden;
                box-sizing: border-box;
                vertical-align: top;
                white-space: nowrap; /* Keep content on one line */
                text-overflow: ellipsis; /* Truncate with ... */
            }
            /* Define column widths for both header and body */
            .btsnoop-table col:nth-child(1) { width: 60px; }
            .btsnoop-table col:nth-child(2) { width: 120px; }
            .btsnoop-table col:nth-child(3) { width: 160px; }
            .btsnoop-table col:nth-child(4) { width: 160px; }
            .btsnoop-table col:nth-child(5) { width: 80px; }
            .btsnoop-table col:nth-child(6) { width: 40%; } /* Summary */
            .btsnoop-table col:nth-child(7) { width: 60%; } /* Data */

            /* --- Fixes for Final Table Layout --- */
            .btsnoop-row {
                position: absolute; /* Required for virtual scrolling */
                left: 0;
                right: 0;
                height: ${LINE_HEIGHT}px; /* Fixed height is crucial for virtual scrolling performance */
                background-color: #2C2C2C; /* Dark background for rows */
            }
            .btsnoop-row:nth-child(even) {
                background-color: #343434; /* Slightly lighter for even rows */
            }

        `;
        document.head.appendChild(style);
    }
    injectLogLevelStyles();

    // =================================================================================
    // --- OPTIMIZATION: Helper Functions ---
    // =================================================================================

    /**
     * Compute a hash of the current filter state to detect changes
     * Only re-filter when this hash changes
     */
    function computeFilterStateHash() {
        return JSON.stringify({
            keywords: filterKeywords.map(kw => ({ text: kw.text, active: kw.active })),
            levels: Array.from(activeLogLevels).sort(),
            isAnd: isAndLogic,
            liveSearch: liveSearchQuery,
            timeRange: {
                start: startTimeInput?.value || '',
                end: endTimeInput?.value || ''
            },
            techs: { ...activeTechs }, // Include connectivity toggle state
            activeBleLayers: Array.from(activeBleLayers).sort(),
            activeNfcLayers: Array.from(activeNfcLayers).sort(),
            activeDckLayers: Array.from(activeDckLayers).sort()
        });
    }

    /**
     * Check if filtering is needed for a specific tab
     * Returns true if filter state changed or cache is empty
     */
    function needsRefiltering(tabId) {
        const currentHash = computeFilterStateHash();

        if (currentHash !== filterStateHash) {
            filterStateHash = currentHash;
            Object.keys(cachedFilteredResults).forEach(key => {
                cachedFilteredResults[key] = null;
            });
            return true;
        }

        return cachedFilteredResults[tabId] === null;
    }

    /**
     * Store filtered results in cache for a specific tab
     */
    function cacheFilteredResults(tabId, results) {
        cachedFilteredResults[tabId] = results;
    }

    /**
     * Debounced save to IndexedDB - prevents blocking UI during saves
     */
    async function debouncedSave(key, value) {
        clearTimeout(saveDebounceTimer);
        saveDebounceTimer = setTimeout(async () => {
            try {
                await saveData(key, value);
                console.log(`[Perf] Saved ${key} to IndexedDB (non-blocking)`);
            } catch (error) {
                console.error(`[Perf] Failed to save ${key}:`, error);
            }
        }, 2000);
    }

    /**
     * OPTIMIZATION Phase 2: Lazy load tab data on first visit
     */
    async function lazyLoadTab(tabId) {
        if (tabsLoaded[tabId] || tabId === 'logs') {
            return;
        }

        console.log(`[Perf Phase2] Lazy loading ${tabId} tab...`);
        const startTime = performance.now();

        try {
            switch (tabId) {
                case 'connectivity':
                    // Filter BLE
                    bleLogLines = originalLogLines.filter(line => {
                        if (line.isMeta) return true;
                        if (!line.tag) return false;
                        const tagLower = line.tag.toLowerCase();
                        return (
                            tagLower.includes('bluetoothgatt') ||
                            tagLower.includes('bluetoothadapter') ||
                            tagLower.includes('bt_') ||
                            tagLower.includes('bluetooth')
                        );
                    });

                    // Filter NFC
                    nfcLogLines = originalLogLines.filter(line => {
                        if (line.isMeta) return true;
                        if (!line.tag) return false;
                        const tagLower = line.tag.toLowerCase();
                        return tagLower.includes('nfc');
                    });

                    // Filter DCK
                    dckLogLines = originalLogLines.filter(line => {
                        if (line.isMeta) return true;
                        if (!line.tag) return false;
                        const tagLower = line.tag.toLowerCase();
                        return (
                            tagLower.includes('digitalkey') ||
                            tagLower.includes('carkey') ||
                            tagLower.includes('dck') ||
                            tagLower.includes('digital_key') ||
                            tagLower.includes('car_key')
                        );
                    });
                    console.log(`[Perf Phase2] Extracted Connectivity lines: BLE=${bleLogLines.length}, NFC=${nfcLogLines.length}, DCK=${dckLogLines.length}`);
                    break;

                case 'btsnoop':
                    // Only process if not already done.
                    if (!isBtsnoopProcessed) {
                        await processForBtsnoop();
                    }
                    console.log(`[Perf Phase2] BTSnoop tab loaded. Total packets: ${btsnoopPackets.length}`);
                    break;

                case 'ccc':
                case 'stats':
                    console.log(`[Perf Phase2] ${tabId} tab ready`);
                    break;
            }

            const duration = performance.now() - startTime;
            console.log(`[Perf Phase2] ${tabId} tab loaded in ${duration.toFixed(2)}ms`);

            // Set loaded flag AFTER processing to avoid race conditions.
            tabsLoaded[tabId] = true;

        } catch (error) {
            console.error(`[Perf Phase2] Failed to lazy load ${tabId} tab:`, error);
            tabsLoaded[tabId] = true;
        }
    }

    // =================================================================================
    // --- File Processing ---
    // =================================================================================
    // --- Radio Button Logic for File Input ---
    const folderChoice = document.getElementById('folderChoice');
    const fileChoice = document.getElementById('fileChoice');
    const folderInputContainer = document.getElementById('folderInputContainer');
    const fileInputContainer = document.getElementById('fileInputContainer');

    if (folderChoice) {
        folderChoice.addEventListener('change', () => {
            if (folderChoice.checked) {
                folderInputContainer.style.display = 'block'; // This is line 323
                fileInputContainer.style.display = 'none'; // This is line 324
            }
        });
    } else {
        fileChoice.addEventListener('change', () => {
            if (fileChoice.checked) {
                folderInputContainer.style.display = 'none';
                fileInputContainer.style.display = 'block';
            }
        });
    }

    async function checkForPersistedLogs() {
        try {
            const persistedData = await loadData('logData');
            if (persistedData && persistedData.value) {
                originalLogLines = persistedData.value;

                // Assign indices to restored lines
                for (let i = 0; i < originalLogLines.length; i++) {
                    originalLogLines[i].index = i;
                }

                // OPTIMIZATION Phase 3: Sync data to filter worker
                syncDataToWorker(originalLogLines);

                const persistedFileName = await loadData('fileName');
                currentZipFileName = persistedFileName?.value || '';
                currentFileDisplay.textContent = `Restored: ${currentZipFileName || 'log files'}`;

                // --- Re-process restored data to rebuild the UI state ---
                const finalStats = { total: 0, E: 0, W: 0, I: 0, D: 0, V: 0 };
                const finalHighlights = { accounts: new Set(), deviceEvents: [], walletEvents: [] };
                const accountRegex = /Account {name=([^,]+), type=[^}]+}/g;
                const lockRegex = /KeyguardUpdateMonitor.*Device.*policy: 1/;
                const unlockRegex = /KeyguardUpdateMonitor.*Device.*policy: 2/;

                for (const line of originalLogLines) {
                    if (line.isMeta) continue;
                    finalStats.total++;
                    if (line.level && finalStats[line.level] !== undefined) finalStats[line.level]++;

                    const allAccountMatches = line.originalText.matchAll(accountRegex);
                    for (const accountMatch of allAccountMatches) {
                        if (accountMatch && accountMatch[1]) finalHighlights.accounts.add(accountMatch[1]);
                    }
                }

                renderStats(finalStats);
                storedHighlights = finalHighlights; // Store highlights
                renderHighlights(finalHighlights);
                const dashboardStats = processForDashboardStats();
                renderDashboardStats(dashboardStats);
                renderCpuPlot(dashboardStats.cpuDataPoints);

                initializeTimeFilterFromLines();
                await renderUI(true); // Use fast initial render and wait for it to complete

                // Auto-collapse left panel to maximize log viewing space
                if (leftPanel && panelToggleBtn && !leftPanel.classList.contains('collapsed')) {
                    leftPanel.classList.add('collapsed');
                    panelToggleBtn.innerHTML = '&raquo;';
                    console.log('[UI] Auto-collapsed left panel after restoring logs');
                }

                return true; // Explicitly return true on success
            }
        } catch (error) {
            console.error('Could not restore persisted logs:', error);
        }
        return false; // Return false if no session was restored
    }

    async function checkForPersistedFilters() {
        const persistedFilters = await loadData('filterConfig');
        if (persistedFilters && persistedFilters.value) {
            loadFiltersBtn.style.display = 'inline-block';
        }
    }

    function initializeDynamicElements() {
        // Query for elements that are inside tab content
        accountsList = document.getElementById('accountsList');
        deviceEventsTable = document.getElementById('deviceEventsTable')?.getElementsByTagName('tbody')[0];
        cpuLoadStats = document.getElementById('cpuLoadStats');
        cpuLoadPlotContainer = document.getElementById('cpuLoadPlotContainer');
        appVersionsTable = document.getElementById('appVersionsTable')?.getElementsByTagName('tbody')[0];
        appSearchInput = document.getElementById('appSearchInput');
        temperatureStats = document.getElementById('temperatureStats');
        bleLogContainer = document.getElementById('bleLogContainer'); bleLogSizer = document.getElementById('bleLogSizer');
        batteryStats = document.getElementById('batteryStats');
        batteryPlotContainer = document.getElementById('batteryPlotContainer');
        bleLogViewport = document.getElementById('bleLogViewport');
        nfcLogContainer = document.getElementById('nfcLogContainer');
        nfcLogSizer = document.getElementById('nfcLogSizer');
        nfcLogViewport = document.getElementById('nfcLogViewport');
        dckLogContainer = document.getElementById('dckLogContainer');
        dckLogSizer = document.getElementById('dckLogSizer');
        dckLogViewport = document.getElementById('dckLogViewport');
        btsnoopLogContainer = document.getElementById('btsnoopLogContainer');
        btsnoopLogSizer = document.getElementById('btsnoopLogSizer');
        btsnoopConnectionEventsTable = document.getElementById('btsnoopConnectionEventsTable')?.getElementsByTagName('tbody')[0];
        kernelLogContainer = document.getElementById('kernelLogContainer');
        kernelLogSizer = document.getElementById('kernelLogSizer');
        kernelLogViewport = document.getElementById('kernelLogViewport');
        btsnoopInitialView = document.getElementById('btsnoopInitialView');
        btsnoopContentView = document.getElementById('btsnoopContentView');
        btsnoopFilterContainer = document.getElementById('btsnoopFilterContainer');

        nfcFilterButtons = document.querySelectorAll('[data-nfc-filter]');
        bleFilterButtons = document.querySelectorAll('[data-ble-filter]');
        btsnoopFilterButtons = document.querySelectorAll('[data-btsnoop-filter]');
        btsnoopColumnFilters = document.querySelectorAll('.btsnoop-column-filters input');
        dckFilterButtons = document.querySelectorAll('[data-dck-filter]');

        // Attach event listeners now that elements are guaranteed to exist - with throttling
        if (logContainer) logContainer.addEventListener('scroll', handleMainLogScroll);
        // Removed specialized log container scroll listeners from here.
        // They will be attached dynamically when the tab is first accessed.
        if (keywordChipsContainer) keywordChipsContainer.addEventListener('mousedown', handleChipClick);

        [logViewport, bleLogViewport, nfcLogViewport, dckLogViewport, kernelLogViewport].forEach(vp => {
            if (vp) vp.addEventListener('mousedown', handleViewportInteraction);
        });
        if (dckLogViewport) dckLogViewport.addEventListener('mousedown', handleViewportInteraction);
        if (kernelLogViewport) kernelLogViewport.addEventListener('mousedown', handleViewportInteraction);
        const connectivityLogViewport = document.getElementById('connectivityLogViewport');
        if (connectivityLogViewport) connectivityLogViewport.addEventListener('mousedown', handleViewportInteraction);
        if (appSearchInput) appSearchInput.addEventListener('input', () => renderAppVersions(allAppVersions));

        // Bind master toggles
        // Bind master toggles
        bindMasterToggle('masterToggleBle', 'ble', 'bleFiltersPanel', activeBleLayers);
        bindMasterToggle('masterToggleNfc', 'nfc', 'nfcFiltersPanel', activeNfcLayers);
        bindMasterToggle('masterToggleDck', 'dck', null, null); // DCK has no sub-filters now

        attachLayerFilterListeners(nfcFilterButtons, activeNfcLayers, applyConnectivityFilters);
        attachLayerFilterListeners(bleFilterButtons, activeBleLayers, applyConnectivityFilters);
        attachLayerFilterListeners(btsnoopFilterButtons, activeBtsnoopFilters, () => renderBtsnoopPackets());
        // DCK layer listeners removed as panel is gone

        // Attach listeners for filter configuration
        if (saveFiltersBtn) saveFiltersBtn.addEventListener('click', saveFilterState);
        if (loadFiltersBtn) loadFiltersBtn.addEventListener('click', loadFilterState);

        if (logicOrBtn) {
            logicOrBtn.addEventListener('click', () => {
                isAndLogic = false;
                logicOrBtn.classList.add('active');
                logicAndBtn.classList.remove('active');
                refreshActiveTab();
            });
        }

        if (logicAndBtn) {
            logicAndBtn.addEventListener('click', () => {
                isAndLogic = true;
                logicAndBtn.classList.add('active');
                logicOrBtn.classList.remove('active');
                refreshActiveTab();
            });
        }

        if (panelToggleBtn) {
            panelToggleBtn.addEventListener('click', () => {
                updateCollapsedMargin(); // Ensure margin is correct before toggling
                leftPanel.classList.toggle('collapsed');
                if (leftPanel.classList.contains('collapsed')) {
                    panelToggleBtn.innerHTML = '&raquo;';
                } else {
                    panelToggleBtn.innerHTML = '&laquo;';
                }
            });
        }

        // --- Panel Resize Logic ---
        if (resizeHandle) {
            let isResizing = false;
            resizeHandle.addEventListener('mousedown', (e) => {
                isResizing = true;
                document.body.style.cursor = 'col-resize';
                document.body.style.userSelect = 'none';
            });

            document.addEventListener('mousemove', (e) => {
                if (!isResizing) return;
                const newWidth = e.clientX - leftPanel.getBoundingClientRect().left;
                const minWidth = parseInt(getComputedStyle(leftPanel).minWidth);
                const maxWidth = parseInt(getComputedStyle(leftPanel).maxWidth);
                const finalWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
                leftPanel.style.width = `${finalWidth}px`;
            });

            document.addEventListener('mouseup', () => {
                isResizing = false;
                document.body.style.cursor = 'default';
                document.body.style.userSelect = 'auto';
            });
        }
        // Attach export listeners
        const exportLogsBtn = document.getElementById('exportLogsBtn');
        if (exportLogsBtn) exportLogsBtn.addEventListener('click', () => handleExport(filteredLogLines, 'filtered_logs.txt'));

        const exportBtsnoopXlsxBtn = document.getElementById('exportBtsnoopXlsxBtn');
        if (exportBtsnoopXlsxBtn) {
            // FIX: Attach the event listener for the Excel export button.
            exportBtsnoopXlsxBtn.addEventListener('click', () => exportBtsnoopToXlsx());
        }

        const exportBleBtn = document.getElementById('exportBleBtn');
        if (exportBleBtn) exportBleBtn.addEventListener('click', () => handleExport(bleLogLines, 'ble_logs.txt'));

        const exportNfcBtn = document.getElementById('exportNfcBtn');
        if (exportNfcBtn) exportNfcBtn.addEventListener('click', () => handleExport(nfcLogLines, 'nfc_logs.txt'));

        const exportDckBtn = document.getElementById('exportDckBtn');
        if (exportDckBtn) exportDckBtn.addEventListener('click', () => handleExport(dckLogLines, 'dck_logs.txt'));

        const exportConnectivityBtn = document.getElementById('exportConnectivityBtn');
        if (exportConnectivityBtn) exportConnectivityBtn.addEventListener('click', () => handleExport(filteredConnectivityLogLines, 'connectivity_logs.txt'));

        const exportAnalyticsBtn = document.getElementById('exportStatsBtn');
        if (exportAnalyticsBtn) {
            exportAnalyticsBtn.addEventListener('click', () => exportStatsToExcel());
        }

    }

    // New Function: Export Stats Tab to Multi-sheet Excel
    function exportStatsToExcel() {
        if (typeof XLSX === 'undefined') {
            alert('SheetJS (XLSX) library not loaded!');
            return;
        }

        const wb = XLSX.utils.book_new();

        // Sheet 1: Log Summary
        const summaryData = [
            ['Analysis Generated', new Date().toLocaleString()],
            ['Total Log Lines', originalLogLines.length],
            ['Start Time', minLogDate ? minLogDate.toISOString() : 'N/A'],
            ['End Time', maxLogDate ? maxLogDate.toISOString() : 'N/A'],
            [],
            ['Log Level Distribution'],
            ...Object.entries(calculateLogLevels(originalLogLines))
        ];
        // Add error distribution
        summaryData.push([], ['Error Tag Distribution']);
        const errorCounts = {};
        originalLogLines.filter(l => l.level === 'E').forEach(l => {
            errorCounts[l.tag] = (errorCounts[l.tag] || 0) + 1;
        });
        Object.entries(errorCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .forEach(([tag, count]) => summaryData.push([tag, count]));

        const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

        // Sheet 2: Accounts
        const highlightAccounts = document.getElementById('accountsList');
        if (highlightAccounts) {
            const accounts = Array.from(highlightAccounts.querySelectorAll('li')).map(li => [li.textContent]);
            if (accounts.length > 0) {
                const wsAccounts = XLSX.utils.aoa_to_sheet([['Discovered Accounts'], ...accounts]);
                XLSX.utils.book_append_sheet(wb, wsAccounts, 'Accounts');
            }
        }

        // Sheet 3: Device Events (Scrape from table)
        const deviceTable = document.getElementById('deviceEventsTable');
        if (deviceTable) {
            const wsDevice = XLSX.utils.table_to_sheet(deviceTable);
            XLSX.utils.book_append_sheet(wb, wsDevice, 'Device Events');
        }

        // Sheet 4: BLE Keys
        const bleKeysTable = document.getElementById('bleKeysTable');
        if (bleKeysTable) {
            const wsKeys = XLSX.utils.table_to_sheet(bleKeysTable);
            XLSX.utils.book_append_sheet(wb, wsKeys, 'BLE Keys');
        }

        // Sheet 5: BTSnoop Events
        const btConnectionTable = document.getElementById('btsnoopConnectionEventsTable');
        if (btConnectionTable) {
            const wsBtEvents = XLSX.utils.table_to_sheet(btConnectionTable);
            XLSX.utils.book_append_sheet(wb, wsBtEvents, 'Connection Events');
        }

        // Sheet 6: App Versions
        const appTable = document.getElementById('appVersionsTable');
        if (appTable) {
            const wsApps = XLSX.utils.table_to_sheet(appTable);
            XLSX.utils.book_append_sheet(wb, wsApps, 'App Versions');
        }

        XLSX.writeFile(wb, 'android_log_stats.xlsx');
    }

    // Helper for summary stats (simplified re-implementation)
    function calculateLogLevels(lines) {
        const counts = { V: 0, D: 0, I: 0, W: 0, E: 0 };
        lines.forEach(l => { if (counts[l.level] !== undefined) counts[l.level]++; });
        return counts;
    }

    async function clearPreviousState(clearStorage = false) {
        // Invalidate any currently running filter operations
        filterVersion++;

        originalLogLines = [];
        filterKeywords = [];
        liveSearchQuery = ''; // Reset live search query
        searchInput.value = ''; // Clear the input field visually

        // Clear time filters
        startTimeInput.value = '';
        endTimeInput.value = '';
        isTimeFilterActive = false;
        if (timeRangeSlider && timeRangeSlider.noUiSlider) {
            timeRangeSlider.noUiSlider.destroy();
            document.getElementById('timeRangeSliderContainer').style.display = 'none';
        }

        // Reset log levels to default (all active)
        activeLogLevels = new Set(['V', 'D', 'I', 'W', 'E']);
        logLevelButtons.forEach(btn => btn.classList.add('active'));

        // Reset specialized log data
        logTags = [];
        bleLogLines = [];
        collapsedFileHeaders.clear();
        filteredBleLogLines = [];
        nfcLogLines = [];
        filteredNfcLogLines = [];
        dckLogLines = [];
        filteredDckLogLines = [];
        filteredDckLogLines = [];
        localBtAddress = 'Host'; // Reset local address on clear.
        if (typeof btsnoopConnectionMap !== 'undefined') {
            btsnoopConnectionMap.clear();
        } else {
            btsnoopConnectionMap = new Map(); // Safety init
        }
        btsnoopConnectionMap = new Map(); // Safety init

        btsnoopPackets = [];
        btsnoopConnectionEvents = [];
        kernelLogLines = [];
        isBtsnoopProcessed = false; // FIX: Reset the processing flag.
        allAppVersions = [];
        activeBtsnoopFilters = new Set(['cmd', 'evt', 'acl', 'l2cap', 'smp', 'att']);
        fileTasks = []; // Clear the list of discovered files
        if (bleKeysTable) bleKeysTable.innerHTML = '';
        if (appVersionsTable) appVersionsTable.innerHTML = '';
        filteredKernelLogLines = [];
        if (accountsList) accountsList.innerHTML = '';
        if (deviceEventsTable) deviceEventsTable.innerHTML = '';
        if (currentFileDisplay) currentFileDisplay.textContent = '';
        renderFilterChips(); // Clear filter chips from the UI
        userAnchorLine = null; // Clear the user-selected anchor

        // Directly clear the log view instead of calling renderUI, which can cause race conditions.
        filteredLogLines = [];
        filteredConnectivityLogLines = []; // Clear connectivity lines
        activeTechs = { ble: false, nfc: false, dck: true }; // Reset to default
        logViewport.innerHTML = '';
        logSizer.style.height = '0px';

        // OPTIMIZATION Phase 2: Reset lazy loading flags
        tabsLoaded = {
            logs: true,
            connectivity: false,
            btsnoop: false,
            ccc: false,
            stats: false
        };

        if (clearStorage && db) { // Also clear the persisted data from IndexedDB
            await clearData();
        }
    }

    async function processFiles(files, fromModal = false) {
        // If no files were selected (e.g., user cancelled the dialog), do nothing.
        if (!files || files.length === 0) {
            return;
        }
        // Clear the previous state now that we are sure new files are being processed.
        await clearPreviousState(true);

        // Set the processing flag to prevent concurrent filtering operations
        isProcessing = true;

        TimeTracker.reset();
        TimeTracker.start('Total Processing Time');

        if (files.length === 1 && files[0].name.endsWith('.zip')) {
            // No pre-sorting needed for a single zip file; the modal will handle it.
        } else {
            // FIX: Sort files chronologically before processing to ensure correct order.
            // This handles log rotation correctly (e.g., logcat.txt.1 before logcat.txt).
            files = Array.from(files).sort((a, b) => {
                const nameA = a.webkitRelativePath || a.name;
                const nameB = b.webkitRelativePath || b.name;
                return nameB.localeCompare(nameA, undefined, { numeric: true, sensitivity: 'base' });
            });
        }

        // Display file/folder name
        if (files.length === 1 && files[0].name.endsWith('.zip')) {
            currentFileDisplay.textContent = `File: ${files[0].name}`;
            currentZipFileName = files[0].name; // Store for later use in exports
        } else if (files.length > 0 && files[0].webkitRelativePath) {
            const pathParts = files[0].webkitRelativePath.split('/');
            if (pathParts.length > 1) {
                currentFileDisplay.textContent = `Folder: ${pathParts[0]}`;
                currentZipFileName = pathParts[0]; // Store folder name
            }
        } else if (files.length > 1) {
            currentFileDisplay.textContent = `${files.length} files selected`;
        } else if (files.length === 1) {
            currentFileDisplay.textContent = `File: ${files[0].name}`;
        }
        progressText.textContent = 'Initializing...';
        progressBar.style.width = '0%';

        TimeTracker.start('File Discovery & Decompression');

        // --- Unified Processing Logic ---
        const processFileEntry = async (file) => {
            const path = file.webkitRelativePath || file.name;
            if (file.name.endsWith('.zip')) {
                // Use the Blob URL workaround to create the zip worker, avoiding CORS issues.
                await new Promise((resolve, reject) => {
                    const zipWorkerScriptText = `
                    self.importScripts('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');

                    async function processZip(zipData, currentPath, fileTasks) {
                        const jszip = new JSZip();
                        const zip = await jszip.loadAsync(zipData);
                        const promises = [];

                        zip.forEach((relativePath, zipEntry) => {
                            const fullPath = currentPath ? currentPath + ' -> ' + zipEntry.name : zipEntry.name;
                            if (zipEntry.dir) return;

                            if (zipEntry.name.endsWith('.zip')) {
                                promises.push(
                                    zipEntry.async('arraybuffer').then(nestedZipData => processZip(nestedZipData, fullPath, fileTasks))
                                );
                            } else if (zipEntry.name.endsWith('.txt') || zipEntry.name.endsWith('.log') || zipEntry.name.includes('btsnoop_hci.log')) {
                                promises.push(
                                    zipEntry.async('blob').then(blob => fileTasks.push({ blob, path: fullPath }))
                                );
                            }
                        });
                        await Promise.all(promises);
                    }

                    self.onmessage = async (event) => {
                        const { zipFile } = event.data;
                        const fileTasks = [];
                        try {
                            await processZip(zipFile, '', fileTasks); // Start with an empty path
                            self.postMessage({ status: 'success', fileTasks });
                        } catch (error) {
                            self.postMessage({ status: 'error', error: error.message });
                        }
                    };`;
                    const blob = new Blob([zipWorkerScriptText], { type: 'application/javascript' });
                    const zipWorkerURL = URL.createObjectURL(blob);
                    const zipWorker = new Worker(zipWorkerURL);
                    zipWorker.onmessage = (e) => {
                        if (e.data.status === 'success') {
                            fileTasks.push(...e.data.fileTasks);
                        } else {
                            console.error('[Main] Zip worker FAILED:', e.data.error);
                        }
                        zipWorker.terminate();
                        URL.revokeObjectURL(zipWorkerURL);
                        resolve();
                    };
                    zipWorker.onerror = (err) => {
                        console.error('[Main] Zip worker had an unhandled error:', err);
                        reject(err);
                    };
                    zipWorker.postMessage({ zipFile: file });
                });
            } else if (file.name.endsWith('.txt') || file.name.endsWith('.log') || file.name.startsWith('btsnoop_hci.log') || file.name.endsWith('hci.log')) {
                fileTasks.push({ file, path });
            }
        };

        // Process files in chunks to avoid blocking the main thread
        const fileList = Array.from(files);
        const CHUNK_SIZE = 50; // This should be a const
        for (let i = 0; i < fileList.length; i += CHUNK_SIZE) {
            const chunk = fileList.slice(i, i + CHUNK_SIZE);
            await Promise.all(chunk.map(file => processFileEntry(file)));
            // Yield to the main thread to keep the UI responsive
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        TimeTracker.stop('File Discovery & Decompression');
        progressText.textContent = 'Parsing files...';
        TimeTracker.start('Worker Parsing Pipeline');

        // Filter out binary btsnoop logs from the text-parsing pipeline.
        // They will be handled separately by processForBtsnoop().
        const tasksToParse = fileTasks.filter(task => !task.path.includes('btsnoop_hci.log'));
        // --- Simplified Worker Pool Logic ---
        // To bypass 'file://' CORS restrictions, the worker's code is embedded
        // directly as a string. A Blob is created from this string, and a URL
        // is generated for that Blob, which is a valid origin for the worker. The unmatched group is changed from .* to .+ to avoid matching empty lines.
        // FIX: Replaced the single template literal with string concatenation to avoid syntax errors and optimized the regex.
        // caused by nested template literals and improper escaping.
        const workerScriptText = 'self.onmessage = async (event) => {\n' +
            '    const { file, blob, path } = event.data;\n' +
            '    let fileContent = \'\';\n' +
            '\n' +
            '    async function streamToString(stream) {\n' +
            '        const reader = stream.getReader();\n' +
            '        const decoder = new TextDecoder();\n' +
            '        let result = \'\';\n' +
            '        while (true) {\n' +
            '            const { done, value } = await reader.read();\n' +
            '            if (done) break;\n' +
            '            result += decoder.decode(value, { stream: false });\n' +
            '        }\n' +
            '        return result;\n' +
            '    }\n' +
            '\n' +
            '    if (file) { fileContent = await streamToString(file.stream()); }\n' +
            '    else if (blob) { fileContent = await streamToString(blob.stream()); }\n' +
            '\n' +
            '    const logcatRegex = new RegExp(\n' +
            '        \'^\\\\s*(?:\' + // Allow optional leading whitespace\n' +
            '            \'(?<logcatDate>\\\\d{2}-\\\\d{2})\\\\s(?<logcatTime>\\\\d{2}:\\\\d{2}:\\\\d{2}\\\\.\\\\d{3,})\' + // MM-DD HH:mm:ss.SSS\n' +
            '            \'\\\\s+\' + // PID/TID/UID Separator\n' +
            '            \'(?:(?:\\\\s*(?<pid>[\\\\w-]+)\\\\s+(?<tid>\\\\d+)\\\\s+(?:(?<uid>\\\\d+)\\\\s+)?)(?<level>[A-Z])\\\\s+(?<tag>[^\\\\s:]+?)(?::\\\\s|\\\\s+)|(?<level2>[A-Z])\\\\/(?<tag2>[^\\\\(\\\\s]+)(?:\\\\(\\\\s*(?<pid2>\\\\d+)\\\\))?:\\\\s)\' + // Handle alphanumeric PID (like \'shell\')\n' +
            '            \'(?<message>(?!.*Date: \\\\d{4}).+)\' + // Standard logcat message, negative lookahead to prevent matching custom format, changed .* to .+\n' +
            '        \'|\' +\n' +
            '            \'Date:\\\\s(?<customFullDate>\\\\d{4}-\\\\d{2}-\\\\d{2})\\\\s(?<customTime>\\\\d{2}:\\\\d{2}:\\\\d{2})\' + // Date: YYYY-MM-DD HH:mm:ss\n' +
            '            \'(?<customMessage>\\\\|.*)\' + // The rest of the custom log line, must start with a pipe\n' +
            '        \'|\' +\n' +
            '            \'\\\\[(?<weaverDate>\\\\d{2}-\\\\d{2})\\\\s(?<weaverTime>\\\\d{2}:\\\\d{2}:\\\\d{2}\\\\.\\\\d+)\\\\]\' + // Weaver log format [MM-DD HH:mm:ss.SSSSSS]\n' +
            '            \'\\\\[(?<weaverPid>\\\\d+)\\\\]\\\\[(?<weaverTag>[^\\\\]]+)\\\\]\\\\s*(?<weaverMessage>.*)\' + // Weaver PID, Tag, and Message\n' +
            '        \')\',\n' +
            '        \'m\' // Use \'m\' (multiline) for ^, but NOT \'g\' (global) with exec() in a loop\n' +
            '    );\n' +
            '\n' +
            '    let parsedLines = [];\n' +
            '    const tagSet = new Set();\n' +
            '    let minTimestamp, maxTimestamp;\n' +
            '    const workerDebugLogs = [];\n' +
            '\n' +
            '    const stats = { total: 0, E: 0, W: 0, I: 0, D: 0, V: 0 };\n' +
            '    const services = {\n' +
            '        \'Bluetooth\': { on: /(bluetooth is on|Bluetooth.*Turning On)/i, off: /(bluetooth is off|Bluetooth.*Turning Off)/i, history: [] },\n' +
            '        \'Wi-Fi\': { on: /wifi is on/i, off: /wifi is off/i, history: [] },\n' +
            '        \'Airplane Mode\': { on: /(airplane mode is on|Airplane Mode: ON)/i, off: /(airplane mode is off|Airplane Mode: OFF)/i, history: [] },\n' +
            '        \'NFC\': { on: /NFC is on/i, off: /NFC is off/i, history: [] }\n' +
            '    };\n' +
            '    const highlights = { accounts: new Set(), deviceEvents: [], walletEvents: [] };\n' +
            '    const accountRegex = new RegExp(\'(?:account:)?Account {name=([^,]+), type=[^}]+}\', \'g\');\n' +
            '    const lockRegex = /KeyguardUpdateMonitor.*Device.*policy:\\\\s*1/;\n' +
            '    const unlockRegex = /KeyguardUpdateMonitor.*Device.*policy:\\\\s*2/;\n' +
            '    // Regex for BT connection events\n' +
            '    const btConnectRegex = /(?:onConnectionStateChange|CONNECT|connectionStateChange).*status=0.*?newState=(?:2|CONNECTED)/i;\n' +
            '    const btDisconnectRegex = /(?:onConnectionStateChange|DISCONNECT|connectionStateChange).*?newState=(?:0|DISCONNECTED)/i;\n' +
            '    const btAddressRegex = /([0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2})/i;\n' +
            '    \n' +
            '    const batteryRegex = /level: (\\\\d+).*scale: (\\\\d+)/;\n' +
            '    const batteryDataPoints = [];\n' +
            '    const cccMessages = [];\n' +
            '    const cccRegex = /(?:Sending|Received):\\s*\\[([0-9a-fA-F]+)\\]/;\n' +
            '    const versionRegex = new RegExp(\'Package\\\\s+\\\\[([^\\]]+)\\\\].*?versionName=([^\\\\s\\\\n,]+)\');\n' +
            '    const appVersions = new Map();\n' +
            '    const localAddressRegex = /Read BD_ADDR.*return: (([0-9A-F]{2}:){5}[0-9A-F]{2})/i;\n' +
            '    // Regex for multi-line dumpsys package format\n' +
            '    const dumpsysPackageRegex = /Package\\s+\\[([^\\]]+)\\][^:]*:[\\s\\S]*?^\\s+versionName=([^\\s\\n]+)/gm;\n' +
            '    let dumpsysMatch;\n' +
            '    while ((dumpsysMatch = dumpsysPackageRegex.exec(fileContent)) !== null) {\n' +
            '        if (dumpsysMatch[1] && dumpsysMatch[2]) {\n' +
            '            appVersions.set(dumpsysMatch[1], dumpsysMatch[2]);\n' +
            '        }\n' +
            '    }\n' +
            '    // Regex for the custom format: { component_name=... version=... label=... }\n' +
            '    const customVersionRegex = /component_name=([\\w.\\/]+).*?version=([\\d]+).*?label=([\\w]+)/;\n' +

            '\n' +
            '    const bleTagKeywords = [\'BluetoothManager\', \'BluetoothAdapter\', \'BtGatt\', \'GattService\', \'HciHal\', \'bt_hci\', \'bt_snoop\'];\n' +
            '    const bleTagRegex = new RegExp(`^(${bleTagKeywords.join(\'|\')})$`, \'i\');\n' +
            '    const bleMessageKeywords = [\'Bluetooth\', \'BLE\', \'GATT\', \'SMP\', \'L2CAP\', \'HCI\', \'NotificationService\'];\n' +
            '    const bleMessageRegex = new RegExp(`\\\\b(${bleMessageKeywords.join(\'|\')})\\\\b`, \'i\');\n' +
            '\n' +
            '    const nfcTagKeywords = [ \'NfcService\', \'NfcManager\', \'TagDispatcher\', \'NfcTag\', \'P2pLinkManager\', \'HostEmulationManager\', \'ApduServiceInfo\', \'NxpNci\', \'NxpExtns\', \'libnfc\', \'libnfc-nci\' ];\n' +
            '    const nfcTagRegex = new RegExp(`^(${nfcTagKeywords.join(\'|\')})$`, \'i\');\n' +
            '    const nfcMessageKeywords = [\'NFC\', \'contactless\', \'APDU\'];\n' +
            '    const nfcMessageRegex = new RegExp(`\\\\b(${nfcMessageKeywords.join(\'|\')})\\\\b`, \'i\');\n' +
            '\n' +
            '    const dckKeywords = [\'DigitalCarKey\', \'CarKey\', \'UwbTransport\', \'Dck\'];\n' +
            '    const CHUNK_SIZE = 10000; // Number of lines to send back at a time\n' +
            '    const dckRegex = new RegExp(`\\\\b(${dckKeywords.join(\'|\')})\\\\b`, \'i\');\n' +
            '    const kernelRegex = /^\\s*\\[\\s*\\d+\\.\\d+\\s*\\]/;\n' +
            '\n' +
            '    const yearMatch = path.match(/(\\d{4})-\\d{2}-\\d{2}/);\n' +
            '    const fileYear = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();\n' +
            '\n' +
            '    parsedLines.push({ isMeta: true, text: \'--- Log from \' + path + \' ---\', originalText: \'--- Log from \' + path + \' ---\', level: \'M\' });\n' +
            '\n' +
            '    const lines = fileContent.split(\'\\n\');\n' +
            '    for (let i = 0; i < lines.length; i++) {\n' +
            '        const lineText = lines[i];\n' +
            '        if (!lineText.trim()) continue;\n' +
            '        stats.total++;\n' +
            '\n' +
            '        let match = logcatRegex.exec(lineText);\n' +
            '        let parsedLine = { lineNumber: i + 1 }; // Add line number\n' +
            '        let lineDateObj = null;\n' +
            '\n' +
            '        if (match) {\n' +
            '            if (match.groups.logcatDate) { // Standard logcat format\n' +
            '                const { logcatDate, logcatTime, level, tag, level2, tag2, message, tid, uid } = match.groups;\n' +
            '                const pid = match.groups.pid || match.groups.pid2;\n' +
            '                const [month, day] = logcatDate.split(\'-\').map(Number);\n' + // This was line 209\n' +
            '                const [hours, minutes, seconds, milliseconds] = logcatTime.split(/[:.]/).map(Number);\n' +
            '                lineDateObj = new Date(fileYear, month - 1, day, hours, minutes, seconds, milliseconds || 0);\n' +
            '\n' +
            '                const fullTimestamp = logcatDate + \' \' + logcatTime;\n' +
            '                if (!minTimestamp || fullTimestamp < minTimestamp) minTimestamp = fullTimestamp;\n' +
            '                if (!maxTimestamp || fullTimestamp > maxTimestamp) maxTimestamp = fullTimestamp;\n' +
            '\n' +
            '                const finalTag = (tag || tag2 || \'\').trim();\n' +
            '                tagSet.add(finalTag);\n' +
            '                const finalLevel = (level || level2 || \'\').trim();\n' +
            '                parsedLine = { isMeta: false, dateObj: lineDateObj, date: logcatDate, time: logcatTime, timestamp: fullTimestamp, level: finalLevel, pid: pid, tid: tid, uid: uid, tag: finalTag, message: message.trim(), originalText: lineText };\n' +
            '                if (stats[finalLevel] !== undefined) stats[finalLevel]++;\n' +
            '            } else if (match.groups.customFullDate) { // Custom YYYY-MM-DD format\n' +
            '                const { customFullDate, customTime, customMessage } = match.groups;\n' +
            '                const [year, month, day] = customFullDate.split(\'-\').map(Number);\n' +
            '                const [hours, minutes, seconds] = customTime.split(\':\').map(Number);\n' +
            '                lineDateObj = new Date(year, month - 1, day, hours, minutes, seconds, 0);\n' +
            '\n' +
            '                const mmdd = customFullDate.substring(5);\n' +
            '                const timeWithMs = customTime + \'.000\';\n' +
            '                const fullTimestamp = mmdd + \' \' + timeWithMs;\n' +
            '                if (!minTimestamp || fullTimestamp < minTimestamp) minTimestamp = fullTimestamp;\n' +
            '                if (!maxTimestamp || fullTimestamp > maxTimestamp) maxTimestamp = fullTimestamp;\n' +
            '\n' +
            '                parsedLine = { isMeta: false, dateObj: lineDateObj, date: mmdd, time: timeWithMs, timestamp: fullTimestamp, level: \'I\', tag: \'CustomLog\', message: customMessage.trim(), originalText: lineText };\n' +
            '                stats.I++;\n' +
            '            }\n' +
            '            else if (match.groups.weaverDate) { // Weaver log format\n' +
            '                const { weaverDate, weaverTime, weaverPid, weaverTag, weaverMessage } = match.groups;\n' +
            '                const [month, day] = weaverDate.split(\'-\').map(Number);\n' +
            '                const [hours, minutes, seconds, milliseconds] = weaverTime.split(/[.:]/).map(Number);\n' +
            '                lineDateObj = new Date(fileYear, month - 1, day, hours, minutes, seconds, Math.floor(milliseconds / 1000)); // Convert microseconds to ms\n' +
            '\n' +
            '                const fullTimestamp = weaverDate + \' \' + weaverTime.slice(0, 12); // Trim to ms for consistency\n' +
            '                if (!minTimestamp || fullTimestamp < minTimestamp) minTimestamp = fullTimestamp;\n' +
            '                if (!maxTimestamp || fullTimestamp > maxTimestamp) maxTimestamp = fullTimestamp;\n' +
            '\n' +
            '                parsedLine = { isMeta: false, dateObj: lineDateObj, date: weaverDate, time: weaverTime, timestamp: fullTimestamp, level: \'D\', pid: weaverPid, tag: weaverTag.trim(), message: weaverMessage.trim(), originalText: lineText };\n' +
            '                stats.D++;\n' +
            '            }\n' +
            '        } else { // Unmatched line logic\n' +
            '            const levelMatch = lineText.match(/\\s([VDIWE])\\s/);\n' +
            '            const level = levelMatch ? levelMatch[1] : \'V\';\n' +
            '            parsedLine = { isMeta: false, dateObj: null, date: \'N/A\', time: \'N/A\', originalText: lineText, level: level, lineNumber: i + 1 };\n' +
            '            if (stats[level] !== undefined) {\n' +
            '                stats[level]++;\n' +
            '            } else {\n' +
            '                stats.V++;\n' +
            '            }\n' +
            '        }\n' +
            '\n' +
            '        if (parsedLine) parsedLine.lineNumber = i + 1;\n' +
            '        const textToSearchForHighlights = parsedLine.message || lineText;\n' +
            '        let accountMatch;\n' +
            '        while ((accountMatch = accountRegex.exec(textToSearchForHighlights)) !== null) {\n' +
            '            if (accountMatch[1]) highlights.accounts.add(accountMatch[1].trim());\n' +
            '        }\n' +
            '\n' +
            '        const localAddrMatch = lineText.match(localAddressRegex);\n' +
            '        if (localAddrMatch && localAddrMatch[1]) {\n' +
            '            highlights.localBtAddress = localAddrMatch[1];\n' +
            '        }\n' +
            '\n' +
            '        if (lockRegex.test(textToSearchForHighlights)) highlights.deviceEvents.push({ date: parsedLine.date, time: parsedLine.time, timestamp: parsedLine.timestamp, event: \'Device Locked\', detail: \'\', originalText: lineText });\n' +
            '        if (unlockRegex.test(textToSearchForHighlights)) highlights.deviceEvents.push({ date: parsedLine.date, time: parsedLine.time, timestamp: parsedLine.timestamp, event: \'Device Unlocked\', detail: \'\', originalText: lineText });\n' +
            '\n' +
            '        for (const serviceName in services) {\n' +
            '            const service = services[serviceName];\n' +
            '            if (service.on.test(lineText)) highlights.deviceEvents.push({ date: parsedLine.date, time: parsedLine.time, timestamp: parsedLine.timestamp, event: serviceName + \' Status\', detail: \'On\', originalText: lineText });\n' +
            '            if (service.off.test(lineText)) highlights.deviceEvents.push({ date: parsedLine.date, time: parsedLine.time, timestamp: parsedLine.timestamp, event: serviceName + \' Status\', detail: \'Off\', originalText: lineText });\n' +
            '        }\n' +
            '        \n' +
            '        if (btConnectRegex.test(textToSearchForHighlights)) {\n' +
            '            const addressMatch = textToSearchForHighlights.match(btAddressRegex);\n' +
            '            highlights.deviceEvents.push({ date: parsedLine.date, time: parsedLine.time, timestamp: parsedLine.timestamp, event: \'Bluetooth Connected\', detail: addressMatch ? addressMatch[1] : \'N/A\', originalText: lineText });\n' +
            '        }\n' +
            '        if (btDisconnectRegex.test(textToSearchForHighlights)) {\n' +
            '            const addressMatch = textToSearchForHighlights.match(btAddressRegex);\n' +
            '            highlights.deviceEvents.push({ date: parsedLine.date, time: parsedLine.time, timestamp: parsedLine.timestamp, event: \'Bluetooth Disconnected\', detail: addressMatch ? addressMatch[1] : \'N/A\', originalText: lineText });\n' +
            '        }\n' +
            '\n' +
            '        const versionMatch = lineText.match(versionRegex);\n' +
            '        if (versionMatch) {\n' +
            '            const packageName = versionMatch[1];\n' +
            '            const versionName = versionMatch[2];\n' +
            '            if (packageName && versionName) appVersions.set(packageName, versionName);\n' +
            '        }\n' +
            '        const customVersionMatch = lineText.match(customVersionRegex);\n' +
            '        if (customVersionMatch) {\n' +
            '            const componentName = customVersionMatch[1];\n' +
            '            const packageName = componentName.split(\'/\')[0]; // Extract package name from component\n' +
            '            const versionCode = customVersionMatch[2];\n' +
            '            if (packageName && versionCode) appVersions.set(packageName, versionCode);\n' +
            '        }\n' +
            '        \n' +
            '        const batteryMatch = lineText.match(batteryRegex);\n' +
            '        if (batteryMatch && lineDateObj) {\n' +
            '            const level = parseInt(batteryMatch[1]);\n' +
            '            batteryDataPoints.push({ ts: lineDateObj, level: level });\n' +
            '        }\n' +
            '\n' +
            '        // FIX: Extract CCC messages from text logs - ONLY from lines with [BleConnection/...]\n' +
            '        const cccMatch = lineText.match(cccRegex);\n' +
            '        if (cccMatch && parsedLine) {\n' +
            '            const hex = cccMatch[1];\n' +
            '            // Only process if this line has [BleConnection/...] to avoid duplicates\n' +
            '            const extractedAddress = (lineText.match(/BleConnection\\/([0-9A-Fa-f:]+)/i) || [])[1] || null;\n' +
            '            if (hex.length >= 4 && extractedAddress) {\n' +
            '                const type = parseInt(hex.substring(0, 2), 16);\n' +
            '                const subtype = parseInt(hex.substring(2, 4), 16);\n' +
            '                const payload = hex.substring(4);\n' +
            '                cccMessages.push({ \n' +
            '                    timestamp: parsedLine.timestamp, \n' +
            '                    direction: lineText.includes("Sending") ? "Host -> Controller" : "Controller -> Host", \n' +
            '                    type, \n' +
            '                    subtype, \n' +
            '                    payload, \n' +
            '                    fullHex: hex,\n' +
            '                    peerAddress: extractedAddress,\n' +
            '                    handle: null\n' +
            '                });\n' +
            '            }\n' +
            '        }\n' +
            '\n' +
            '\n' +
            '        if (parsedLine) { // Ensure parsedLine is not null\n' +
            '        if ((parsedLine.tag && bleTagRegex.test(parsedLine.tag)) || (parsedLine.message && bleMessageRegex.test(parsedLine.message))) {\n' +
            '            parsedLine.isBle = true;\n' +
            '        }\n' +
            '        if ((parsedLine.tag && nfcTagRegex.test(parsedLine.tag)) || (parsedLine.message && nfcMessageRegex.test(parsedLine.message))) {\n' +
            '            parsedLine.isNfc = true;\n' +
            '        }\n' +
            '        if (dckRegex.test(lineText)) {\n' +
            '            parsedLine.isDck = true;\n' +
            '        }\n' +
            '        }\n' +
            '\n' +
            '        // FIX: The kernel check must be independent of the logcat match and the if(parsedLine) block.\n' +
            '        if (parsedLine && kernelRegex.test(lineText)) {\n' +
            '            parsedLine.isKernel = true;\n' +
            '        }\n' +
            '\n' +
            '        if(parsedLine) parsedLines.push(parsedLine);\n' +
            '\n' +
            '        // If the chunk is full, send it back to the main thread\n' +
            '        if (parsedLines.length >= CHUNK_SIZE) {\n' +
            '            self.postMessage({ status: \'chunk\', parsedLines: parsedLines, filePath: path });\n' +
            '            parsedLines = []; // Reset for the next chunk\n' +
            '        }\n' +
            '    }\n' +
            '\n' +
            '    // Send any remaining lines in the last chunk\n' +
            '    if (parsedLines.length > 0) {\n' +
            '        self.postMessage({ status: \'chunk\', parsedLines: parsedLines, filePath: path });\n' +
            '    }\n' +
            '\n' +
            '    if (workerDebugLogs.length > 0) {\n' +
            '        self.postMessage({ status: \'debug\', logs: workerDebugLogs, filePath: path });\n' +
            '    }\n' +
            '    // Send a final success message with summary data, but without the huge parsedLines array\n' +
            '    self.postMessage({ status: \'success\', tags: Array.from(tagSet), minTimestamp, maxTimestamp, filePath: path, stats, highlights: { ...highlights, accounts: Array.from(highlights.accounts) }, appVersions: Array.from(appVersions), batteryDataPoints, cccMessages });\n' +
            '};';
        const blob = new Blob([workerScriptText], { type: 'application/javascript' });
        const workerScriptURL = URL.createObjectURL(blob);

        const allResults = await new Promise((resolve, reject) => {
            const maxWorkers = navigator.hardwareConcurrency || 4;
            const workers = [];
            const results = [];
            let tasksCompleted = 0;
            const totalTasks = tasksToParse.length; // Use the length of the selected tasks

            if (totalTasks === 0) {
                resolve([]);
                return;
            }

            const onWorkerMessage = (event) => {
                const data = event.data;
                // Find or create the result object for this file path
                let resultForFile = results.find(r => r.filePath === data.filePath);
                if (!resultForFile) {
                    resultForFile = { filePath: data.filePath, parsedLines: [], status: 'pending' };
                    results.push(resultForFile);
                }

                if (data.status === 'chunk') {
                    // Append the chunk of lines
                    resultForFile.parsedLines.push(...data.parsedLines);
                } else if (data.status === 'success') {
                    // This is the final message for this file. Merge summary data.
                    Object.assign(resultForFile, data);
                    resultForFile.status = 'success'; // Mark as complete
                    tasksCompleted++;

                    const progress = (tasksCompleted / totalTasks) * 100;
                    progressBar.style.width = `${progress}%`;
                    progressText.textContent = `Parsing ${tasksCompleted} of ${totalTasks}...`;

                    if (tasksToParse.length > 0) {
                        const task = tasksToParse.shift();
                        event.target.postMessage(task);
                    } else if (tasksCompleted === totalTasks) {
                        resolve(results);
                        workers.forEach(w => w.terminate());
                        URL.revokeObjectURL(workerScriptURL);
                    }
                }
            };

            for (let i = 0; i < maxWorkers; i++) {
                const worker = new Worker(workerScriptURL);
                worker.onmessage = onWorkerMessage;
                worker.onerror = (err) => {
                    console.error(`[Main] Worker error:`, err);
                    // Continue processing with other workers
                    if (++tasksCompleted === totalTasks) {
                        resolve(results);
                    }
                };
                workers.push(worker);
            }

            // Start processing
            workers.forEach(worker => {
                if (tasksToParse.length > 0) {
                    worker.postMessage(tasksToParse.shift());
                }
            });
        });

        TimeTracker.stop('Worker Parsing Pipeline');

        // Wait for all parsing workers to finish
        progressText.textContent = 'Finalizing...';

        // --- Consolidate Results ---
        // Reset global state before consolidating new results
        TimeTracker.start('Result Consolidation');

        originalLogLines = [];
        const consolidatedTagSet = new Set(); // Use a new set for consolidation
        let consolidatedMinTimestamp, consolidatedMaxTimestamp;
        const finalServices = {};
        const finalHighlights = { accounts: new Set(), deviceEvents: [], walletEvents: [] };
        const finalStats = { total: 0, E: 0, W: 0, I: 0, D: 0, V: 0 };
        const finalBleKeys = new Map();
        let finalLocalBtAddress = null;
        const consolidatedAppVersions = new Map();
        let consolidatedBatteryDataPoints = [];
        const finalCccMessages = [];

        let resultIndex = 0;
        for (const result of allResults) {
            if (result.status === 'success') {
                const lineCount = result.parsedLines.length;

                // FIX: Only add logs specifically marked for each category, not the whole file.
                const fileHeader = result.parsedLines.find(l => l.isMeta);

                const fileBleLogs = result.parsedLines.filter(l => l.isBle);
                if (fileBleLogs.length > 0) {
                    if (fileHeader) bleLogLines.push(fileHeader);
                    for (const line of fileBleLogs) bleLogLines.push(line);
                }

                const fileNfcLogs = result.parsedLines.filter(l => l.isNfc);
                if (fileNfcLogs.length > 0) {
                    if (fileHeader) nfcLogLines.push(fileHeader);
                    for (const line of fileNfcLogs) nfcLogLines.push(line);
                }

                const fileDckLogs = result.parsedLines.filter(l => l.isDck);
                if (fileDckLogs.length > 0) {
                    if (fileHeader) dckLogLines.push(fileHeader);
                    for (const line of fileDckLogs) dckLogLines.push(line);
                }

                const fileKernelLogs = result.parsedLines.filter(l => l.isKernel);
                if (fileKernelLogs.length > 0) {
                    if (fileHeader) kernelLogLines.push(fileHeader);
                    for (const line of fileKernelLogs) kernelLogLines.push(line);
                }

                for (const line of result.parsedLines) {
                    originalLogLines.push(line);
                }
                result.tags.forEach(tag => consolidatedTagSet.add(tag));
                if (result.minTimestamp && (!consolidatedMinTimestamp || result.minTimestamp < consolidatedMinTimestamp)) {
                    consolidatedMinTimestamp = result.minTimestamp;
                }
                if (result.maxTimestamp && (!consolidatedMaxTimestamp || result.maxTimestamp > consolidatedMaxTimestamp)) {
                    consolidatedMaxTimestamp = result.maxTimestamp;
                }
                // Consolidate stats from worker
                if (result.stats) {
                    for (const key in finalStats) {
                        finalStats[key] += result.stats[key] || 0;
                    }
                }
                // Consolidate highlights from worker
                if (result.highlights) {
                    finalHighlights.deviceEvents.push(...result.highlights.deviceEvents);
                    finalHighlights.walletEvents.push(...result.highlights.walletEvents);
                    // Consolidate local address from worker
                    if (result.highlights.localBtAddress) {
                        finalLocalBtAddress = result.highlights.localBtAddress;
                    }
                    result.highlights.accounts.forEach(acc => finalHighlights.accounts.add(acc));
                }
                // Consolidate app versions from worker
                if (result.appVersions) {
                    result.appVersions.forEach(([pkg, version]) => {
                        consolidatedAppVersions.set(pkg, version);
                    });
                }
                // Consolidate BLE keys from worker
                if (result.bleKeys) {
                    result.bleKeys.forEach(([addr, keyInfo]) => {
                        finalBleKeys.set(addr, keyInfo);
                    });
                }
                // Consolidate CCC messages from worker
                if (result.cccMessages) {
                    cccStatsData.push(...result.cccMessages);
                }
                // Consolidate battery data from worker
                if (result.batteryDataPoints) {
                    // FIX: Use push with spread syntax to avoid creating new large arrays.
                    for (const point of result.batteryDataPoints) {
                        consolidatedBatteryDataPoints.push(point);
                    }
                }
                // Consolidate CCC messages from worker
                if (result.cccMessages) {
                    finalCccMessages.push(...result.cccMessages);
                }
            }
        }
        allAppVersions = Array.from(consolidatedAppVersions).sort((a, b) => a[0].localeCompare(b[0]));

        // Set the global local address if it was found
        if (finalLocalBtAddress) {
            localBtAddress = finalLocalBtAddress;
        }

        TimeTracker.stop('Result Consolidation');

        // --- Persist Data ---
        TimeTracker.start('Persisting & UI Render');

        // Assign indices to originalLogLines
        for (let i = 0; i < originalLogLines.length; i++) {
            originalLogLines[i].index = i;
        }

        // OPTIMIZATION Phase 3: Sync data to filter worker
        syncDataToWorker(originalLogLines);

        // OPTIMIZATION: Use debounced save to prevent blocking UI
        debouncedSave('logData', originalLogLines);
        debouncedSave('fileName', currentZipFileName);

        // --- Finalize UI ---
        minLogDate = consolidatedMinTimestamp ? logcatToDate(consolidatedMinTimestamp) : null;
        maxLogDate = consolidatedMaxTimestamp ? logcatToDate(consolidatedMaxTimestamp) : null;
        logTags = Array.from(consolidatedTagSet).sort();
        initializeTimeFilter(consolidatedMinTimestamp, consolidatedMaxTimestamp);

        // Render the stats and highlights that were calculated by the workers
        renderStats(finalStats);
        storedHighlights = finalHighlights; // Store highlights
        renderHighlights(finalHighlights);

        // Process and render secondary dashboard stats like CPU, Temp, and App Versions
        const dashboardStats = processForDashboardStats();
        renderDashboardStats(dashboardStats);
        renderAppVersions(allAppVersions);
        renderTemperaturePlot(dashboardStats.temperatureDataPoints);
        renderCpuPlot(dashboardStats.cpuDataPoints);
        renderBatteryPlot(consolidatedBatteryDataPoints);
        renderCccStats(finalCccMessages);

        // The initial render is now handled by a direct call to applyFilters,
        // which is the correct way to populate the log view for the first time.
        applyFilters(true);

        // Auto-collapse left panel to maximize log viewing space
        if (leftPanel && panelToggleBtn && !leftPanel.classList.contains('collapsed')) {
            leftPanel.classList.add('collapsed');
            panelToggleBtn.innerHTML = '&raquo;';
            console.log('[UI] Auto-collapsed left panel after file loading');
        }

        // Reset the processing flag now that everything is complete
        progressText.textContent = 'Complete!';
        isProcessing = false;
    }

    /**
     * OPTIMIZATION: Master refresh function with intelligent caching and lazy loading.
     * Only re-filters when filter state actually changes.
     * Lazy loads tab data on first visit.
     */
    async function refreshActiveTab() {
        const activeTabId = document.querySelector('.tab-btn.active')?.dataset.tab;

        // OPTIMIZATION Phase 2: Lazy load tab data on first visit
        await lazyLoadTab(activeTabId);

        // OPTIMIZATION Phase 1: Check if filtering is needed
        const shouldRefilter = needsRefiltering(activeTabId);

        if (!shouldRefilter) {
            console.log(`[Perf] Using cached results for ${activeTabId} tab - no filtering needed`);
            return;
        }

        console.log(`[Perf] Filter state changed - re-filtering ${activeTabId} tab`);

        switch (activeTabId) {
            case 'logs':
                applyFilters();
                cacheFilteredResults('logs', filteredLogLines);
                break;
            case 'connectivity':
                if (!connectivityScrollListenerAttached) setupConnectivityTab(); else applyConnectivityFilters();
                cacheFilteredResults('connectivity', filteredConnectivityLogLines);
                break;
            case 'btsnoop':
                await setupBtsnoopTab();
                cacheFilteredResults('btsnoop', btsnoopPackets);
                break;
            case 'ccc':
                setupCccTab();
                break;
            case 'stats':
                cacheFilteredResults('stats', null);
                break;
        }
    }

    /**
     * A generic filtering function that applies the main filters (keyword, level, time)
     * to a given set of log lines. This is the new core of the filtering system.
     * OPTIMIZATION: Only shows file headers if they have matching log lines
     * @param {Array} linesToFilter The array of log line objects to filter.
     * @returns {Array} A new array containing only the lines that pass the filters.
     */
    function applyMainFilters(linesToFilter, collapseState) {
        const activeKeywords = filterKeywords.filter(kw => kw.active).map(kw => kw.text);
        const keywordRegexes = activeKeywords.length > 0 ? activeKeywords.map(wildcardToRegex) : null;
        const liveSearchRegex = liveSearchQuery ? wildcardToRegex(liveSearchQuery) : null;
        const startTime = startTimeInput.value ? new Date(startTimeInput.value) : null;
        const endTime = endTimeInput.value ? new Date(endTimeInput.value) : null;

        const state = collapseState || { isInside: false };
        const results = [];
        let currentHeader = null;
        let headerHasMatches = false;

        for (const line of linesToFilter) {
            if (line.isMeta) {
                // Save previous header if it had matches
                if (currentHeader && headerHasMatches) {
                    results.push(currentHeader);
                }

                // Store new header, don't add yet
                currentHeader = line;
                headerHasMatches = false;
                state.isInside = collapsedFileHeaders.has(line.originalText);
                continue;
            }

            if (state.isInside) continue;

            // Apply filters
            if (keywordRegexes) {
                const matches = isAndLogic
                    ? keywordRegexes.every(regex => regex.test(line.originalText))
                    : keywordRegexes.some(regex => regex.test(line.originalText));
                if (!matches) continue;
            }
            if (liveSearchRegex && !liveSearchRegex.test(line.originalText)) continue;

            if (isTimeFilterActive && (startTime || endTime)) {
                if (line.dateObj) {
                    if ((startTime && line.dateObj < startTime) || (endTime && line.dateObj > endTime)) continue;
                }
            }

            if (line.level && !activeLogLevels.has(line.level)) continue;

            // Line passed all filters - mark header as having matches
            if (!headerHasMatches && currentHeader) {
                results.push(currentHeader);
                headerHasMatches = true;
            }

            results.push(line);
        }

        return results;
    }
    // --- Clear & Reset Logic ---
    clearStateBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to clear all loaded logs and reset the application? This cannot be undone.')) {
            await clearPreviousState(true); // true to clear persisted data in IndexedDB
            await applyFilters(); // Re-render the empty state
        }
    });

    // =================================================================================
    // --- Filtering and Rendering ---
    // =================================================================================

    // Slower, async filter function that yields to the UI. Used for interactive filtering for the MAIN LOGS TAB.
    async function applyFilters(force = false, isInitialLoad = false) {
        // A "cancellation token" for async filtering.
        // Each call to applyFilters gets a unique version number.
        // The async filtering loop will check if its version is still the latest.
        // If not, it means a new filter operation has started, and the old one should stop.
        // Increment the version to invalidate any previous, slower filter calls.
        const currentVersion = ++filterVersion;

        // If we are in the middle of processing new files, abort the filter operation.
        if (isProcessing && !force) return;

        // --- Scroll Restoration Logic ---
        // 1. Find the first visible line in the current viewport to use as an anchor.
        // Prioritize the user-clicked anchor. Fallback to the top visible line.
        let anchorLine = userAnchorLine;
        if (!anchorLine && filteredLogLines.length > 0) {
            const topVisibleIndex = Math.floor(logContainer.scrollTop / LINE_HEIGHT);
            anchorLine = filteredLogLines[topVisibleIndex];
        }
        // --- End Scroll Restoration ---

        TimeTracker.start('Async Filtering');

        // Clear the current view immediately for responsiveness
        filteredLogLines = [];
        logViewport.innerHTML = '';
        logSizer.style.height = '0px';

        // Yield to the browser to render the cleared view
        await new Promise(resolve => setTimeout(resolve, 0));

        const CHUNK_SIZE = 50000; // Process 50,000 lines at a time
        const tempFiltered = [];

        // FIX: Maintain collapse state across chunks.
        // This object is passed by reference to the filter function.
        const collapseState = { isInside: false };

        for (let i = 0; i < originalLogLines.length; i += CHUNK_SIZE) {
            // If a new filter operation has started, abort this one.
            if (filterVersion !== currentVersion) {
                TimeTracker.stop('Async Filtering');
                return;
            }

            const chunk = originalLogLines.slice(i, i + CHUNK_SIZE);
            const filteredChunk = applyMainFilters(chunk, collapseState);
            tempFiltered.push(...filteredChunk);

            // Yield to the main thread to prevent UI freezing
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        // Final check after the loop
        if (filterVersion !== currentVersion) {
            TimeTracker.stop('Async Filtering');
            return;
        }

        filteredLogLines = tempFiltered;

        // --- Scroll Restoration & Final Render ---
        // This logic runs only once after all chunks are processed.
        if (isInitialLoad) {
            logContainer.scrollTop = 0;
        } else {
            let newScrollTop = 0;
            if (userAnchorLine && !filteredLogLines.includes(userAnchorLine)) {
                userAnchorLine = null; // Clear anchor if it was filtered out
            }

            if (anchorLine) {
                const newAnchorIndex = filteredLogLines.findIndex(line => line === anchorLine);
                if (newAnchorIndex !== -1) {
                    newScrollTop = newAnchorIndex * LINE_HEIGHT;
                }
            }

            // Force layout reflow before setting scroll position
            logSizer.style.height = `${filteredLogLines.length * LINE_HEIGHT}px`;
            logSizer.offsetHeight; // This forces the browser to recalculate layout

            logContainer.scrollTop = newScrollTop;
        }

        // Final render call
        handleMainLogScroll(); // Use the throttled function for the final render

        TimeTracker.stop('Async Filtering');

    }

    /**
     * NEW: A generic, asynchronous, chunked filter function for ALL log views.
     * This replaces the synchronous filtering in specialized tabs, preventing UI freezes.
     * @param {Array} sourceLines - The array of lines to be filtered (e.g., bleLogLines).
     * @param {Array} targetLines - The array where filtered results will be stored (e.g., filteredBleLogLines).
     * @param {HTMLElement} container - The scroll container for the tab.
     * @param {Function} renderFn - The virtual scroll rendering function for the tab.
     * @param {Function} [preFilterFn=null] - An optional function to apply specialized filters (like BLE layers) first.
     */
    async function applyFiltersAsync(sourceLines, targetLines, container, renderFn, preFilterFn = null) {
        const currentVersion = ++filterVersion; // Invalidate previous filter runs

        // 1. Find the first visible line in the current viewport to use as an anchor.
        let anchorLine = null;
        if (targetLines.length > 0 && container.scrollTop > 0) {
            const topVisibleIndex = Math.floor(container.scrollTop / LINE_HEIGHT);
            anchorLine = targetLines[topVisibleIndex];
        }

        // OPTIMIZATION Phase 3: Web Worker Path for Main Logs
        if (sourceLines === originalLogLines && !preFilterFn) {
            const config = {
                activeKeywords: filterKeywords.filter(kw => kw.active).map(kw => kw.text),
                isAndLogic,
                liveSearchQuery,
                activeLogLevels: Array.from(activeLogLevels),
                timeRange: {
                    start: startTimeInput.value || null,
                    end: endTimeInput.value || null
                },
                collapsedFileHeaders: Array.from(collapsedFileHeaders),
                isTimeFilterActive
            };

            try {
                // Don't clear immediately -> smoother experience
                const indices = await requestWorkerFilter(config);

                if (filterVersion !== currentVersion) return;

                // Reconstruct results logic
                // Using a temp array first is safer
                const newResults = [];
                for (let i = 0; i < indices.length; i++) {
                    newResults.push(originalLogLines[indices[i]]);
                }

                targetLines.length = 0;
                Array.prototype.push.apply(targetLines, newResults);

                // Restore Scroll
                let newScrollTop = 0;
                if (anchorLine) {
                    const newAnchorIndex = targetLines.findIndex(line => line === anchorLine);
                    if (newAnchorIndex !== -1) {
                        newScrollTop = newAnchorIndex * LINE_HEIGHT;
                    } else {
                        // Anchor lost (filtered out), stick to top or relative? 
                        // Keep 0 or logic below.
                    }
                }
                container.scrollTop = newScrollTop;
                renderFn();
                return;

            } catch (err) {
                console.error("Worker filter failed, falling back", err);
                // Fall through to standard logic
            }
        }


        // Fallback / Specialized Logic (Standard Chunked)
        // 2. Apply pre-filters if they exist (e.g., for BLE/NFC layers)
        const preFilteredLines = preFilterFn ? preFilterFn(sourceLines) : sourceLines;

        // 3. Clear the current view immediately for responsiveness
        targetLines.length = 0;
        renderFn(); // Render the empty state

        // 4. Process the main filters in non-blocking chunks
        const CHUNK_SIZE = 50000;
        const tempFiltered = [];
        const collapseState = { isInside: false };

        for (let i = 0; i < preFilteredLines.length; i += CHUNK_SIZE) {
            if (filterVersion !== currentVersion) return; // A new filter operation has started, so abort.

            const chunk = preFilteredLines.slice(i, i + CHUNK_SIZE);
            const filteredChunk = applyMainFilters(chunk, collapseState);
            tempFiltered.push(...filteredChunk);

            await new Promise(resolve => setTimeout(resolve, 0)); // Yield to the main thread
        }

        if (filterVersion !== currentVersion) return;

        // 5. Update the target array with the final filtered results
        Array.prototype.push.apply(targetLines, tempFiltered);

        // 6. Restore scroll position
        let newScrollTop = 0;
        if (anchorLine) {
            const newAnchorIndex = targetLines.findIndex(line => line === anchorLine);
            if (newAnchorIndex !== -1) {
                newScrollTop = newAnchorIndex * LINE_HEIGHT;
            }
        }
        container.scrollTop = newScrollTop;

        // 7. Final render
        renderFn();
    }
    async function saveFilterState() {
        const filterConfig = {
            keywords: filterKeywords,
            isAndLogic: isAndLogic,
            logLevels: Array.from(activeLogLevels)
        };
        await saveData('filterConfig', filterConfig);
        alert('Filter configuration saved!');
        loadFiltersBtn.style.display = 'inline-block'; // Show the load button
    }

    async function loadFilterState() {
        const persistedFilters = await loadData('filterConfig');
        if (persistedFilters && persistedFilters.value) {
            const config = persistedFilters.value;
            filterKeywords = config.keywords || [];
            isAndLogic = config.isAndLogic || false;
            activeLogLevels = new Set(config.logLevels || ['V', 'D', 'I', 'W', 'E']);

            // Update UI to reflect loaded state
            logicOrBtn.classList.toggle('active', !isAndLogic);
            logicAndBtn.classList.toggle('active', isAndLogic);
            logLevelButtons.forEach(btn => {
                btn.classList.toggle('active', activeLogLevels.has(btn.dataset.level));
            });

            await renderUI(); // Re-render chips and apply filters
        } else {
            alert('No saved filter configuration found.');
        }
    }
    function wildcardToRegex(pattern) {
        const escapedPattern = pattern.replace(/([.+?^${}()|\[\]\/\\])/g, "\\$1");
        // Revert to the faster, whole-word search by default.
        // The user can use asterisks for a "contains" search (e.g., *NFC*).
        if (!pattern.includes('*')) {
            return new RegExp(`\\b${escapedPattern}\\b`, 'i');
        }
        const regexPattern = escapedPattern.replace(/\*/g, '.*');
        return new RegExp(regexPattern, 'i');
    }

    function initializeTimeFilterFromLines() {
        let minTimestamp, maxTimestamp;
        for (const line of originalLogLines) {
            if (line.timestamp) {
                if (!minTimestamp || line.timestamp < minTimestamp) minTimestamp = line.timestamp;
                if (!maxTimestamp || line.timestamp > maxTimestamp) maxTimestamp = line.timestamp;
            }
        }
        if (minTimestamp && maxTimestamp) {
            initializeTimeFilter(minTimestamp, maxTimestamp);
        }
    }

    function initializeTimeFilter(minTimestamp, maxTimestamp) {
        // This flag must be declared before the slider is created.
        let isUpdatingFromInput = false;

        // Destroy existing slider if it exists
        if (timeRangeSlider && timeRangeSlider.noUiSlider) {
            timeRangeSlider.noUiSlider.destroy();
        }

        if (!minLogDate || !maxLogDate) {
            startTimeInput.value = '';
            endTimeInput.value = '';
            document.getElementById('timeRangeSliderContainer').style.display = 'none';
            return;
        }

        document.getElementById('timeRangeSliderContainer').style.display = 'block';

        const minTime = minLogDate.getTime();
        const maxTime = maxLogDate.getTime();

        // Set input fields
        startTimeInput.value = logcatToISO(minTimestamp);
        endTimeInput.value = logcatToISO(maxTimestamp);

        noUiSlider.create(timeRangeSlider, {
            start: [minTime, maxTime],
            connect: true,
            range: {
                'min': minTime,
                'max': maxTime
            },
            tooltips: false // Disable the tooltips
        });

        // When the slider is moved, update the input fields and filter
        timeRangeSlider.noUiSlider.on('update', (values) => {
            const [start, end] = values.map(v => new Date(Number(v)));

            // Use a flag to prevent an infinite loop between slider and input updates
            if (!isUpdatingFromInput) {
                startTimeInput.value = dateToISO(start);
                endTimeInput.value = dateToISO(end);
            }
        });

        timeRangeSlider.noUiSlider.on('end', () => {
            isTimeFilterActive = true;
            refreshActiveTab(); // Apply filters only when the user finishes sliding
        });

        // When input fields are changed, update the slider
        [startTimeInput, endTimeInput].forEach(input => {
            input.addEventListener('change', () => {
                isUpdatingFromInput = true;
                isTimeFilterActive = true;
                const startVal = startTimeInput.value ? new Date(startTimeInput.value).getTime() : minTime;
                const endVal = endTimeInput.value ? new Date(endTimeInput.value).getTime() : maxTime;
                timeRangeSlider.noUiSlider.set([startVal, endVal]);
                isUpdatingFromInput = false;
            });
        });
    }

    function dateToISO(date) {
        return date.toISOString().substring(0, 16);
    }

    function logcatToISO(logcatTimestamp) {
        const year = new Date().getFullYear(); // Assume current year
        const [datePart, timePart] = logcatTimestamp.split(' '); // "10-26", "15:04:01.123"
        // The input requires YYYY-MM-DDTHH:mm format.
        // We can take the first 5 characters of the time part (HH:mm).
        return `${year}-${datePart}T${timePart.substring(0, 5)}`;
    }

    function logcatToDate(logcatTimestamp) {
        // logcatTimestamp is in "MM-DD HH:mm:ss.SSS" format, e.g., "07-02 09:33:33.365"
        if (!logcatTimestamp || logcatTimestamp.length < 18) {
            return null; // Invalid format
        }
        const year = new Date().getFullYear();
        // To avoid ambiguity in date parsing across browsers, we explicitly set the components.
        // new Date(year, monthIndex, day, hours, minutes, seconds, milliseconds)
        // month is 0-indexed, so we subtract 1.
        const month = parseInt(logcatTimestamp.substring(0, 2), 10) - 1;
        const day = parseInt(logcatTimestamp.substring(3, 5), 10);
        const hours = parseInt(logcatTimestamp.substring(6, 8), 10);
        const minutes = parseInt(logcatTimestamp.substring(9, 11), 10);
        const seconds = parseInt(logcatTimestamp.substring(12, 14), 10);
        const milliseconds = parseInt(logcatTimestamp.substring(15, 18), 10);
        const date = new Date(year, month, day, hours, minutes, seconds, milliseconds);
        return isNaN(date) ? null : date;
    }

    function escapeHtml(unsafe = '') {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // --- PID Color Hashing ---
    const pidColorCache = new Map();
    const pidColors = ['#4CAF50', '#2196F3', '#9C27B0', '#FF9800', '#F44336', '#009688', '#673AB7', '#E91E63', '#03A9F4', '#8BC34A'];
    function getColorForPid(pid) {
        if (!pid) return '#E0E0E0'; // Default color for lines without a PID
        if (pidColorCache.has(pid)) {
            return pidColorCache.get(pid);
        }
        // Simple hash function to pick a color
        const colorIndex = parseInt(pid, 10) % pidColors.length;
        const color = pidColors[colorIndex];
        pidColorCache.set(pid, color);
        return color;
    }
    function renderVirtualLogs(container, sizer, viewport, lines) {
        if (!container || !sizer || !viewport || !lines) return;

        const scrollTop = container.scrollTop;
        const containerHeight = container.clientHeight;

        // Get active keyword regexes for highlighting
        const activeKeywords = filterKeywords.filter(kw => kw.active).map(kw => kw.text);
        const keywordRegexes = activeKeywords.length > 0 ? activeKeywords.map(wildcardToRegex) : null;
        const liveSearchRegex = liveSearchQuery ? wildcardToRegex(liveSearchQuery) : null;

        // Set the total height of the scrollable area
        // FIX: This line was missing. It's critical for creating the scrollbar and preventing overlap.
        sizer.style.height = `${lines.length * LINE_HEIGHT}px`;

        // Calculate the range of lines to render
        let startIndex = Math.floor(scrollTop / LINE_HEIGHT) - BUFFER_LINES;
        startIndex = Math.max(0, startIndex); // Don't go below 0
        let endIndex = Math.ceil((scrollTop + containerHeight) / LINE_HEIGHT) + BUFFER_LINES;
        endIndex = Math.min(lines.length, endIndex); // Don't go past the end
        // Create the HTML for the visible lines
        let visibleHtml = '';

        for (let i = startIndex; i < endIndex; i++) {
            const line = lines[i];
            if (!line) continue; // Safety check

            let lineContent;
            let lineClass = 'log-line';

            if (line.isMeta) {
                lineClass += ' log-line-meta';
                const indicator = collapsedFileHeaders.has(line.originalText) ? '[+] ' : '[-] ';
                lineContent = indicator + escapeHtml(line.text);
            } else {
                // --- New Android Studio Style Rendering ---
                const levelHtml = `<span class="log-level-box log-level-${line.level}">${line.level}</span>`;
                const pidColor = getColorForPid(line.pid);

                let messageText = escapeHtml(line.message || line.originalText);
                let tagText = escapeHtml(line.tag || '');

                // Apply keyword highlighting to tag and message
                if (keywordRegexes) {
                    keywordRegexes.forEach(regex => {
                        messageText = messageText.replace(regex, (match) => `<mark>${match}</mark>`);
                        tagText = tagText.replace(regex, (match) => `<mark>${match}</mark>`);
                    });
                }
                if (liveSearchRegex) {
                    messageText = messageText.replace(liveSearchRegex, (match) => `<mark class="live-search">${match}</mark>`);
                    tagText = tagText.replace(liveSearchRegex, (match) => `<mark class="live-search">${match}</mark>`);
                }

                lineContent = `
                    <div class="log-line-content">
                        <span class="log-meta">${line.timestamp || (line.date + ' ' + line.time)}</span>
                        <span class="log-pid-tid" style="color: ${pidColor};">${line.pid || ''}${line.tid ? '-' + line.tid : ''}${line.uid ? ' ' + line.uid : ''}</span>
                        ${levelHtml}
                        <span class="log-tag" title="${escapeHtml(line.tag || '')}">${tagText}</span>
                        <span class="log-message" title="${escapeHtml(line.message || line.originalText)}">${messageText}</span>
                    </div>
                `;
            }
            const copyButtonHtml = line.isMeta ? '' : `<button class="copy-log-btn" data-log-text="${escapeHtml(line.originalText || line.text)}">📋</button>`;
            if (userAnchorLine === line) {
                lineClass += ' selected-anchor';
            }

            let lineNumberHtml = '';
            if (!line.isMeta && line.lineNumber) {
                lineNumberHtml = `<span class="line-number">${line.lineNumber}</span>`;
            }
            visibleHtml += `<div class="${lineClass}" data-line-index="${i}">${lineNumberHtml}${lineContent}${copyButtonHtml}</div>`;
        }

        viewport.innerHTML = visibleHtml;
        viewport.style.transform = `translateY(${startIndex * LINE_HEIGHT}px)`;
    }

    function renderFilterChips() {
        keywordChipsContainer.innerHTML = '';
        filterKeywords.forEach((keywordObj, index) => {
            const chip = document.createElement('div');
            chip.className = 'keyword-chip'; // Main class for styling
            chip.dataset.index = index; // Store index for toggling

            if (keywordObj.active) {
                chip.classList.add('active');
            }
            chip.textContent = keywordObj.text;

            const closeBtn = document.createElement('span');
            closeBtn.className = 'remove-chip';
            closeBtn.dataset.index = index; // Store index for removal
            closeBtn.textContent = 'x';

            chip.appendChild(closeBtn);
            keywordChipsContainer.appendChild(chip);
        });
    }

    function handleChipClick(event) {
        const target = event.target;
        const index = parseInt(target.dataset.index, 10);

        if (isNaN(index)) return;

        if (target.classList.contains('remove-chip')) {
            filterKeywords.splice(index, 1);
        } else if (target.classList.contains('keyword-chip')) {
            filterKeywords[index].active = !filterKeywords[index].active;
        }

        renderUI();
    }

    function renderUI(isInitialLoad = false) {
        renderFilterChips();
        // This function's primary role is to re-apply filters when a UI control
        // (like a keyword chip) changes the filter state. The initial render is
        // handled at the end of processFiles.
        refreshActiveTab();
    }

    function handleExport(logLines, filename) {
        if (!logLines || logLines.length === 0) {
            alert('No logs to export.');
            return;
        }

        // Prepend the zip file name if it exists
        const finalFilename = currentZipFileName
            ? `${currentZipFileName.replace('.zip', '')}_${filename}`
            : filename;

        const content = logLines.map(line => line.originalText || line.text).join('\n');
        const blob = new Blob([content], { type: 'text/plain;charset=utf-u8' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = finalFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    // --- Event Listener for Virtual Scroll ---
    // Moved to initializeDynamicElements to ensure elements exist

    function attachLayerFilterListeners(buttons, activeSet, applyFn) {
        buttons.forEach(button => {
            // This is the key fix: The previous logic was flawed. This correctly finds the data attribute
            // and ensures the initial state is set correctly.
            const filterKey = Object.keys(button.dataset).find(key => key.endsWith('Filter'));
            if (!filterKey) return; // Skip if no valid data-* attribute is found

            const layer = button.dataset[filterKey];

            // Set the initial visual state of the button based on the activeSet
            if (activeSet.has(layer)) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }

            button.addEventListener('mousedown', (e) => {
                // Auto-enable master toggle if off
                const techSection = button.closest('.tech-section');
                if (techSection) {
                    const masterToggle = techSection.querySelector('.tech-master-toggle input[type="checkbox"]');
                    if (masterToggle && !masterToggle.checked) {
                        masterToggle.click(); // Enable master
                        // The button click should now enable this specific filter if it wasn't already
                        // Note: If the button was "visually" active but disabled by master, we might want to keep it active.
                        // Standard toggle logic below flip-flops state. 
                        // If I click a grayed-out "active" button, do I want to turn it OFF (toggle) or just wake it up?
                        // "clicking any sub filter which is off" -> implies we care about turning ON.
                        // If it's ON (gray), let's assume standard toggle behavior applies (turning it OFF). 
                        // The user can re-click if they just wanted to wake up.
                    }
                }

                // 1. Determine the new state & provide IMMEDIATE visual feedback
                const wasActive = activeSet.has(layer);
                const newActiveState = !wasActive;
                button.classList.toggle('active', newActiveState);

                // 2. Update the data model
                if (wasActive) {
                    activeSet.delete(layer);
                } else {
                    activeSet.add(layer);
                }

                // 3. Schedule the heavy processing (filtering & rendering) for the next event loop cycle.
                // This allows the browser to repaint the button color change immediately.
                setTimeout(() => {
                    applyFn();
                }, 0);
            });
        });
    }
    // --- Event Listeners for Time Filters ---
    if (startTimeInput) {
        startTimeInput.addEventListener('change', () => timeRangeSlider.noUiSlider.set([new Date(startTimeInput.value).getTime(), null]));
    }

    if (endTimeInput) {
        endTimeInput.addEventListener('change', () => timeRangeSlider.noUiSlider.set([null, new Date(endTimeInput.value).getTime()]));
        logLevelToggleBtn.addEventListener('click', () => {
            if (logLevelToggleBtn.textContent === 'None') {
                // Deselect all
                logLevelButtons.forEach(button => button.classList.remove('active'));
                activeLogLevels.clear();
                logLevelToggleBtn.textContent = 'All';
            } else {
                // Select all
                logLevelButtons.forEach(button => {
                    button.classList.add('active');
                    activeLogLevels.add(button.dataset.level);
                });
                logLevelToggleBtn.textContent = 'None';
            }
            refreshActiveTab();
        });
    }
    // --- Connectivity Tab Initialization ---
    bindMasterToggle('masterToggleBle', 'ble', 'bleFiltersPanel');
    bindMasterToggle('masterToggleNfc', 'nfc', 'nfcFiltersPanel');
    bindMasterToggle('masterToggleDck', 'dck', 'dckFiltersPanel');

    ['bleFiltersPanel', 'nfcFiltersPanel', 'dckFiltersPanel'].forEach(panelId => {
        const panel = document.getElementById(panelId);
        if (panel) {
            panel.querySelectorAll('.filter-icon').forEach(btn => {
                btn.addEventListener('click', () => {
                    btn.classList.toggle('active');
                    applyConnectivityFilters();
                });
            });
        }
    });

    // --- Event Listener for Individual Log Level Filters ---
    logLevelButtons.forEach(button => {
        button.addEventListener('click', () => {
            const level = button.dataset.level;
            button.classList.toggle('active');

            if (activeLogLevels.has(level)) {
                activeLogLevels.delete(level);
            } else {
                activeLogLevels.add(level);
            }
            refreshActiveTab(); // Re-apply all filters
        });
    });

    if (searchInput) {
        searchInput.addEventListener('keyup', (event) => {
            if (event.key === 'Enter') {
                clearTimeout(debounceTimer); // Cancel any pending debounce
                addKeyword(searchInput.value);
            }
        });

        searchInput.addEventListener('input', () => {
            // Debounce the live search filtering
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                liveSearchQuery = searchInput.value;
                refreshActiveTab(); // Worker handles it without freezing
            }, 200); // OPTIMIZATION Phase 3: Reduced to 200ms thanks to Web Worker

            // Autocomplete can still be instant
            const query = searchInput.value.toLowerCase(); // Use the immediate value for suggestions
            if (!query || !autocompleteSuggestions) {
                if (autocompleteSuggestions) autocompleteSuggestions.style.display = 'none';
                return;
            }

            const suggestions = logTags
                .filter(tag => tag.toLowerCase().startsWith(query))
                .slice(0, 10); // Max 10 suggestions

            if (suggestions.length > 0) {
                autocompleteSuggestions.innerHTML = '';
                suggestions.forEach(suggestion => {
                    const item = document.createElement('div');
                    item.className = 'suggestion-item';
                    item.textContent = suggestion;
                    item.onclick = () => {
                        addKeyword(suggestion);
                    };
                    autocompleteSuggestions.appendChild(item);
                });
                autocompleteSuggestions.style.display = 'block';
            } else {
                autocompleteSuggestions.style.display = 'none';
            }
        });
    } else {
        console.warn('HTML element with ID "searchInput" not found.');
    }

    // Hide suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (autocompleteSuggestions && searchInput && !searchInput.contains(e.target)) {
            autocompleteSuggestions.style.display = 'none';
        }
    });

    function addKeyword(keywordText) {
        const keyword = keywordText.trim();
        if (keyword && !filterKeywords.some(kw => kw.text.toLowerCase() === keyword.toLowerCase())) {
            filterKeywords.push({ text: keyword, active: true });
            liveSearchQuery = ''; // Clear live search when committing to a chip
            clearTimeout(debounceTimer); // Clear any pending live search
            searchInput.value = '';
            renderUI();
        }
    }
    // startTimeInput.addEventListener('change', renderUI);
    // endTimeInput.addEventListener('change', renderUI);


    // =================================================================================
    // --- Statistics ---
    // =================================================================================
    // --- Statistics Rendering (data is now pre-calculated by the worker) ---
    function renderStats(stats) {
        if (!stats) return;
        const total = stats.total || 0;
        const errorRate = total > 0 ? ((stats.E / total) * 100).toFixed(2) : 0;

        let html = `
            <div class="stat-item"><strong>Total Lines:</strong> ${total.toLocaleString()}</div>
            <div class="stat-item"><strong>Error Rate:</strong> ${errorRate}%</div>
            <div class="stat-item"><span class="log-level-E">Errors:</span> ${stats.E.toLocaleString()}</div>
            <div class="stat-item"><span class="log-level-W">Warnings:</span> ${stats.W.toLocaleString()}</div>
            <div class="stat-item"><span class="log-level-I">Info:</span> ${stats.I.toLocaleString()}</div>
            <div class="stat-item"><span class="log-level-D">Debug:</span> ${stats.D.toLocaleString()}</div>
            <div class="stat-item"><span class="log-level-V">Verbose:</span> ${stats.V.toLocaleString()}</div>
        `;
        document.getElementById('logCounts').innerHTML = html;

        // Error distribution chart
        const errorDistData = [
            { label: 'Errors', value: stats.E, color: '#D32F2F' },
            { label: 'Warnings', value: stats.W, color: '#FBC02D' },
            { label: 'Info', value: stats.I, color: '#388E3C' },
            { label: 'Debug', value: stats.D, color: '#1976D2' },
            { label: 'Verbose', value: stats.V, color: '#9E9E9E' }
        ];

        // Simple bar chart for error distribution
        const maxVal = Math.max(...errorDistData.map(d => d.value));

        if (maxVal === 0) {
            document.getElementById('errorDistribution').innerHTML = '<p style="text-align: center; color: #666;">No log data available</p>';
        } else {
            let distHtml = '<div style="margin-top: 1rem; display: flex; height: 100px; align-items: flex-end; gap: 5px; width: 100%;">';
            errorDistData.forEach(d => {
                const height = (d.value / maxVal) * 100;
                distHtml += `
                    <div style="flex: 1; display: flex; flex-direction: column; align-items: center;">
                        <div style="width: 80%; background-color: ${d.color}; height: ${height}%; min-height: 1px; border-radius: 2px 2px 0 0;" title="${d.label}: ${d.value.toLocaleString()}"></div>
                        <span style="font-size: 0.7rem; margin-top: 4px; color: #555;">${d.label[0]}</span>
                    </div>
                `;
            });
            distHtml += '</div>';
            document.getElementById('errorDistribution').innerHTML = distHtml;
        }
    }

    const CONTROL_FLOW_P1_MAP = {
        '00': 'Finished with Failure',
        '01': 'Finished with Success',
        '10': 'Continue',
        '12': 'Abort',
        '40': 'Application Specific'
    };

    const CONTROL_FLOW_P2_MAP = {
        '00': 'Success / No Info',
        '01': 'Public Key Not Found / No Matching SPAKE2+',
        '02': 'Public Key Expired / Cert Chain Received',
        '03': 'Public Key Not Trusted / User Confirm',
        '04': 'Invalid Signature',
        '05': 'Invalid Channel',
        '06': 'Invalid Data Format',
        '07': 'Invalid Data Content',
        '08': 'Preconditions Not Fulfilled',
        '0B': 'Cert Verify Failed',
        '0F': 'Time Extension',
        '11': 'Key Creation/Verification Success',
        '7F': 'Data/Format Error',
        'A0': 'Key deleted / Not known',
        'B0': 'Doors/Trunk not closed',
        'B1': 'Vehicle not in parking state'
    };

    const AUTH_P1_MAP = {
        '00': 'Standard Authentication',
        '01': 'Fast Authentication',
        '02': 'Transaction Authentication',
        '03': 'Reserved',
        '04': 'Reserved'
    };

    const AUTH_P2_MAP = {
        '00': 'No specific info',
        '01': 'First message',
        '02': 'Subsequent message',
        '03': 'Last message',
        '04': 'Single message',
        '05': 'Chaining',
        '06': 'Reserved',
        '07': 'Reserved'
    };

    const formatParam = (key, value) => `<span class="ccc-pair"><span class="ccc-param">${key}:</span><span class="ccc-value">${value}</span></span>`;

    const COMMON_TAGS = {
        '30': 'Sequence',
        'A0': 'Status_Object',
        '83': 'Status'
    };

    const APDU_TAGS = {
        ...COMMON_TAGS,
        '86': 'Endpoint_ePK',
        '87': 'Vehicle_ePK',
        '4D': 'Vehicle_Identifier',
        '4C': 'Transaction_Identifier',
        '9E': 'Signature',
        '5C': 'Protocol_Version',
        '4E': 'Key_Slot',
        '57': 'Counter_Value',
        '4A': 'Confidential_Mailbox',
        '4B': 'Private_Mailbox',
        '93': 'Usage'
    };

    const RKE_TAGS = {
        ...COMMON_TAGS,
        '7F70': 'Request_RKE_Action',
        '7F72': 'Function_Status_Response',
        '7F73': 'Subscribe_Vehicle_Function',
        '7F74': 'Get_Function_Status',
        '7F76': 'Continue_RKE_Action',
        '7F77': 'Stop_RKE_Action',
        '80': 'Function_ID',
        '81': 'Action_ID',
        '84': 'From_Function_ID',
        '85': 'To_Function_ID',
        '86': 'Full_Update_Flag', // Context specific: in RKE it's a flag
        '88': 'Arbitrary_Data'
    };

    const FUNCTION_IDS = {
        '0001': 'Central_Locking',
        '0010': 'Driving_Readiness'
    };

    const APDU_COMMANDS = {
        '00A4': 'SELECT',
        '8080': 'AUTH0',
        '8081': 'AUTH1',
        '803C': 'CONTROL_FLOW',
        '8071': 'CREATE_RANGING_KEY',
        '8072': 'TERMINATE_RANGING_SESSION',
        '8073': 'EXCHANGE_RANGING_DATA'
    };

    const RKE_STATUS_MAP = {
        '0001': { '00': 'Unlocked', '01': 'Locked', '02': 'Selective Unlocked', '03': 'Locked Safe' },
        '0002': { '00': 'Closed', '01': 'Open', '02': 'Intermediate' }, // Window
        '0010': { '00': 'Not Ready', '01': 'Ready', '02': 'Engine Running', '03': 'Engine Cranking' },
        '0012': { '00': 'Off', '01': 'On' },
        'default': { '00': 'Ok/Inactive', '01': 'Fail/Active' }
    };

    const UWB_TAGS = {
        // Placeholder for UWB specific tags
    };

    // Simple BER-TLV Parser with Context and Formatting
    const parseTLV = (hex, tagMap = COMMON_TAGS) => {
        let result = "";
        let i = 0;
        let maxIter = 100;
        let currentFunctionId = null; // Track Function ID in current context

        while (i < hex.length && maxIter-- > 0) {
            // Skip padding/invalid tags
            let nextByte = hex.substring(i, i + 2).toUpperCase();
            if (nextByte === '00' || nextByte === 'FF') {
                i += 2;
                continue;
            }

            // Parse Tag
            let tag = nextByte;
            if (!/^[0-9A-F]{2}$/.test(tag)) break;

            i += 2;
            if ((parseInt(tag, 16) & 0x1F) === 0x1F) {
                tag += hex.substring(i, i + 2).toUpperCase();
                i += 2;
            }

            // Parse Length
            if (i + 2 > hex.length) break;
            let lenHex = hex.substring(i, i + 2);
            let len = parseInt(lenHex, 16);
            i += 2;

            if (len > 127) {
                if (len === 0x81) {
                    if (i + 2 > hex.length) break;
                    len = parseInt(hex.substring(i, i + 2), 16);
                    i += 2;
                } else if (len === 0x82) {
                    if (i + 4 > hex.length) break;
                    len = parseInt(hex.substring(i, i + 4), 16);
                    i += 4;
                }
            }

            if (i + (len * 2) > hex.length) {
                result += `<div class="tlv-block">${formatParam(`Tag_${tag}`, '[Truncated]')}</div>`;
                break;
            }

            let val = hex.substring(i, i + (len * 2));
            i += (len * 2);

            const tagName = tagMap[tag] || `Tag_${tag}`;

            if (tag.startsWith('7F') || tag === '30' || tag === 'A0') {
                // Container: Render as block with indentation
                const nested = parseTLV(val, tagMap);
                result += `<div class="tlv-block"><span class="ccc-param">${tagName}:</span><div class="tlv-indent">${nested}</div></div>`;
            } else {
                // Leaf: Render as block param-value pair
                let displayVal = val;

                if (tagMap === RKE_TAGS) {
                    // Capture Function ID
                    if (tag === '80') {
                        currentFunctionId = val;
                        if (FUNCTION_IDS[val]) {
                            displayVal = `${val} (${FUNCTION_IDS[val]})`;
                        }
                    }
                    // Interpret Status based on Function ID
                    if (tag === '83') {
                        const map = RKE_STATUS_MAP[currentFunctionId] || RKE_STATUS_MAP['default'];
                        const statusText = map[val] || map['default'];
                        if (statusText) {
                            displayVal = `${val} (${statusText})`;
                        }
                    }
                    // True flag
                    if (tag === '86' && len === 0) {
                        displayVal = "True";
                    }
                }

                result += `<div class="tlv-block">${formatParam(tagName, displayVal)}</div>`;
            }
        }
        return result;
    };

    // Helper to decode payload based on message type
    const decodePayload = (type, subtype, payload) => {
        let innerMsg = "-";
        let params = "";

        if (!payload) return { innerMsg, params: "" };

        // Framework Decoding
        if (type === 0x00) {
            if (subtype === 0x04) {
                innerMsg = "Data PDU";
                params = formatParam('Data', payload.match(/.{1,2}/g).join(' '));
                return { innerMsg, params };
            }
            if (subtype === 0x18) {
                innerMsg = "Encrypted PDU";
                let info = "";
                if (payload.includes('a0')) info = formatParam('Info', '[Contains TLV Data]') + " ";
                params = info + formatParam('Data', payload.match(/.{1,2}/g).join(' '));
                return { innerMsg, params };
            }
        }

        // SE (Secure Element) Decoding
        if (type === 0x01) {
            // DK_APDU_RQ (0x0B)
            if (subtype === 0x0B) {
                if (payload.length >= 4) {
                    let apdu = payload.substring(4);
                    const cla = apdu.substring(0, 2).toUpperCase();
                    const ins = apdu.substring(2, 4).toUpperCase();
                    const claIns = cla + ins;

                    // Check for C9 (Exchange) CLA first as it overrides specific command mapping
                    if (cla === 'C9') {
                        innerMsg = "EXCHANGE_APDU"; // Generic name for C9 class
                        // Treat the whole body (minus header) as data/TLV?
                        // Usually C9 indicates secure/exchange context. 
                        // We will assume standard APDU structure: CLA INS P1 P2 Lc Data
                        if (apdu.length >= 10) {
                            const dataStart = 10;
                            const data = apdu.substring(dataStart);
                            params = parseTLV(data, APDU_TAGS);
                        } else {
                            params = formatParam('Data', apdu.match(/.{1,2}/g).join(' '));
                        }
                    } else if (APDU_COMMANDS[claIns]) {
                        const cmdName = APDU_COMMANDS[claIns];
                        const p1 = apdu.substring(4, 6);
                        const p2 = apdu.substring(6, 8);
                        const dataStart = 10;
                        const data = apdu.substring(dataStart); // Rest of APDU

                        innerMsg = cmdName;
                        let p1Text = p1;
                        let p2Text = p2;

                        if (cmdName === 'SELECT') {
                            if (p1 === '04' && data.length > 0) {
                                if (data.toLowerCase().includes('a000000809434343444b417631')) {
                                    params = formatParam('Applet', 'Digital Key') + formatParam('AID', data);
                                } else {
                                    params = formatParam('AID', data);
                                }
                            } else {
                                params = formatParam('Data', data);
                            }
                            // Return immediately for SELECT to avoid adding P1/P2 or parsing TLV
                            return { innerMsg, params };

                        } else if (cmdName === 'CONTROL_FLOW') {
                            p1Text = CONTROL_FLOW_P1_MAP[p1] || p1;
                            p2Text = CONTROL_FLOW_P2_MAP[p2] || p2;
                        } else if (cmdName === 'AUTH0' || cmdName === 'AUTH1') {
                            p1Text = AUTH_P1_MAP[p1] || p1;
                            p2Text = AUTH_P2_MAP[p2] || p2;
                        }

                        // Generic Parameter formatting
                        const commonParams = formatParam('P1', `${p1Text} (0x${p1})`) +
                            formatParam('P2', `${p2Text} (0x${p2})`);

                        if (!params) params = "";
                        params = commonParams + params;

                        if (data.length > 0) {
                            const tlv = parseTLV(data, APDU_TAGS);
                            if (tlv) {
                                params += formatParam('Data (TLV)', tlv);
                            } else {
                                params += formatParam('Data', data.match(/.{1,2}/g).join(' '));
                            }
                        }
                    } else if (apdu.startsWith('8080')) {
                        // Fallback legacy check
                        innerMsg = "AUTH0";
                        params = parseTLV(apdu.substring(10), APDU_TAGS);
                    } else {
                        innerMsg = "APDU";
                        if (claIns === '8071') {
                            innerMsg = "CREATE_RANGING_KEY";
                            const data = apdu.substring(10);
                            params = parseTLV(data, APDU_TAGS);
                        } else if (claIns === '8072') {
                            innerMsg = "TERMINATE_RANGING_SESSION";
                            const data = apdu.substring(10);
                            params = parseTLV(data, APDU_TAGS);
                        } else if (claIns === '8073') {
                            innerMsg = "EXCHANGE_RANGING_DATA";
                            const data = apdu.substring(10);
                            params = parseTLV(data, APDU_TAGS);
                        } else {
                            params = formatParam('Data', apdu.match(/.{1,2}/g).join(' '));
                        }
                    }
                    return { innerMsg, params };
                }
            }
            // DK_APDU_RS (0x0C)
            if (subtype === 0x0C) {
                // FIX: Support case where payload starts with length (00xx)
                if (payload.length >= 4) {
                    // Check if the first 2 bytes are a length field logic check
                    // If payload is "006a..." (from text log which strips type/subtype 010c)
                    // The code below assumes payload starts with LENGTH (4 hex chars).
                    // This matches the DK_APDU_RQ structure logic.
                    // We assume payload = Length(2B) + APDU(var)

                    const lenVal = parseInt(payload.substring(0, 4), 16); // e.g. 006a = 106
                    // Validate length to ensure it's not garbage
                    // If lenVal + 4 (header) == payload.length, it's definitely a length field.
                    // User log: 010c006a... -> payload passed is 006a... (212 chars + 4 = 216?)
                    // If 106 bytes -> 212 hex chars.
                    // payload.length should be roughly 216 chars (4 chars len + 212 chars data).

                    // Proceed with parsing
                    const apdu = payload.substring(4);
                    // Standard APDU response: Data + SW(2B)
                    if (apdu.length >= 4) {
                        const sw = apdu.substring(apdu.length - 4);
                        const data = apdu.substring(0, apdu.length - 4);
                        let statusText = sw;
                        if (sw === '9000') statusText = 'Success (9000)';

                        innerMsg = "Response"; // Cannot infer request type context-free

                        const swHtml = formatParam('SW', statusText);
                        let tlvHtml = "";

                        // Heuristic: If data starts with '7F' or '6F' etc it might be TLV.
                        // But standard processing is safe enough.
                        if (data.length > 0) {
                            const tlv = parseTLV(data, APDU_TAGS);
                            // FIX: improved check to show TLV if valid, else raw
                            if (tlv && !tlv.includes('[Truncated') && !data.startsWith('04')) {
                                tlvHtml = formatParam('Data', tlv);
                            } else {
                                tlvHtml = formatParam('Data', data.match(/.{1,2}/g).join(' '));
                            }
                        }
                        return { innerMsg, params: tlvHtml + swHtml };
                    }
                }
            }
        }

        // UWB Ranging Service Decoding
        if (type === 0x02) {
            innerMsg = "-";

            // Ranging_Session_RQ (0x03)
            if (subtype === 0x03) {
                if (payload.length >= 24) { // Length(2) + 10 bytes = 12 bytes total (24 hex chars)
                    const len = parseInt(payload.substring(0, 4), 16);
                    params = formatParam('Length', '0x' + payload.substring(0, 4)) +
                        formatParam('Protocol', '0x' + payload.substring(4, 8)) +
                        formatParam('ConfigID', '0x' + payload.substring(8, 12)) +
                        formatParam('SessionID', '0x' + payload.substring(12, 20)) +
                        formatParam('PulseShape', '0x' + payload.substring(20, 22)) +
                        formatParam('Channel', '0x' + payload.substring(22, 24));

                    if (payload.length > 24) {
                        params += formatParam('Data (Remaining)', payload.substring(24).match(/.{1,2}/g).join(' '));
                    }
                } else {
                    // Fallback if short, might be legacy or error
                    params = formatParam('Data', payload.match(/.{1,2}/g).join(' '));
                }
            }
            // Ranging_Session_RS (0x04)
            if (subtype === 0x04) {
                if (payload.length >= 4) {
                    const len = parseInt(payload.substring(0, 4), 16);
                    params = formatParam('Length', '0x' + payload.substring(0, 4));

                    const content = payload.substring(4);
                    // Data: RAN_Multiplier (1B) + Slot_BitMask (1B) + SYNC_Code_Index_BitMask (4B) + Selected_UWB_Channel (1B) + Hopping_Config_Bitmask (1B)
                    if (content.length >= 16) { // 8 bytes minimum
                        const ranMult = parseInt(content.substring(0, 2), 16);
                        const slotMask = content.substring(2, 4);
                        const syncMask = content.substring(4, 12);

                        // Corrected Swapped Fields
                        const channelHex = content.substring(12, 14);
                        const hoppingHex = content.substring(14, 16);

                        const channelVal = parseInt(channelHex, 16);
                        let channelText = `Channel ${channelVal}`;
                        if (channelVal === 5) channelText = "Channel 5";
                        if (channelVal === 9) channelText = "Channel 9";

                        params += formatParam('RAN_Multiplier', ranMult) +
                            formatParam('Slot_BitMask', '0x' + slotMask) +
                            formatParam('SYNC_Code_Index_BitMask', '0x' + syncMask) +
                            formatParam('Selected_UWB_Channel', `${channelText} (0x${channelHex})`) +
                            formatParam('Hopping_Config_Bitmask', `0x${hoppingHex}`);

                        if (content.length > 16) {
                            params += formatParam('Data (Remaining)', content.substring(16).match(/.{1,2}/g).join(' '));
                        }
                    } else {
                        // Fallback to TLV or raw if short
                        const tlv = parseTLV(content, UWB_TAGS);
                        if (tlv) params += tlv;
                        else params += formatParam('Data', content.match(/.{1,2}/g)?.join(' ') || '');
                    }
                }
            }
            // Ranging_Session_Setup_RQ (0x05)
            if (subtype === 0x05) {
                if (payload.length >= 4) {
                    const len = parseInt(payload.substring(0, 4), 16);
                    params = formatParam('Length', '0x' + payload.substring(0, 4));
                    const content = payload.substring(4);

                    // User Specified Parameters:
                    // 1. Session_RAN_Multiplier (1B)
                    // 2. Number_Chaps_per_Slot (1B)
                    // 3. Number_Responders_Nodes (1B)
                    // 4. Number_Slots_per_Round (1B)
                    // 5. SYNC_Code_Index (4B)
                    // 6. Selected_Hopping_Config_Bitmask (1B)
                    if (content.length >= 18) { // 9 bytes minimum
                        params += formatParam('Session_RAN_Multiplier', parseInt(content.substring(0, 2), 16)) +
                            formatParam('Number_Chaps_per_Slot', parseInt(content.substring(2, 4), 16)) +
                            formatParam('Number_Responders_Nodes', parseInt(content.substring(4, 6), 16)) +
                            formatParam('Number_Slots_per_Round', parseInt(content.substring(6, 8), 16)) +
                            formatParam('SYNC_Code_Index', parseInt(content.substring(8, 16), 16)) +
                            formatParam('Selected_Hopping_Config_Bitmask', '0x' + content.substring(16, 18));

                        if (content.length > 18) {
                            params += formatParam('Data (Remaining)', content.substring(18).match(/.{1,2}/g).join(' '));
                        }
                    } else {
                        params += formatParam('Data', content.match(/.{1,2}/g)?.join(' ') || '');
                    }
                }
            }
            // Ranging_Session_Setup_RS (0x06)
            if (subtype === 0x06) {
                if (payload.length >= 4) {
                    const len = parseInt(payload.substring(0, 4), 16);
                    params = formatParam('Length', '0x' + payload.substring(0, 4));
                    const content = payload.substring(4);

                    if (content.length >= 34) {
                        params += formatParam('STS_Index0', '0x' + content.substring(0, 8)) +
                            formatParam('UWB_Time0', '0x' + content.substring(8, 24)) +
                            formatParam('HOP_Key', '0x' + content.substring(24, 32)) +
                            formatParam('SYNC_Index', parseInt(content.substring(32, 34), 16));

                        if (content.length > 34) {
                            params += formatParam('Data (Remaining)', content.substring(34).match(/.{1,2}/g).join(' '));
                        }
                    } else {
                        params += formatParam('Data', content.match(/.{1,2}/g)?.join(' ') || '');
                    }
                }
            }
            // Ranging_Suspend_RQ (0x07)
            if (subtype === 0x07) {
                if (payload.startsWith('0004') && payload.length >= 12) {
                    params = formatParam('UWB Session ID', '0x' + payload.substring(4, 12));
                    if (payload.length > 12) {
                        params += formatParam('Data (Remaining)', payload.substring(12).match(/.{1,2}/g).join(' '));
                    }
                }
            }
            // Ranging_Suspend_RS (0x08)
            if (subtype === 0x08) {
                const status = payload.length >= 2 ? payload.substring(payload.length - 2) : payload;
                const statusText = status === '00' ? 'Accepted' : status === '01' ? 'Delayed' : 'Unknown (0x' + status + ')';
                params = formatParam('Suspend Response', statusText);
            }
            // Ranging_Recovery_RQ (0x09)
            if (subtype === 0x09) {
                if (payload.startsWith('0004') && payload.length >= 12) {
                    params = formatParam('UWB Session ID', '0x' + payload.substring(4, 12));
                    if (payload.length > 12) {
                        params += formatParam('Data (Remaining)', payload.substring(12).match(/.{1,2}/g).join(' '));
                    }
                }
            }
            // Ranging_Recovery_RS (0x0A)
            if (subtype === 0x0A) {
                if (payload.length >= 24) {
                    params = formatParam('STS_Index0', '0x' + payload.substring(0, 8)) +
                        formatParam('UWB_Time0', '0x' + payload.substring(8, 24));

                    if (payload.length > 24) {
                        params += formatParam('Data (Remaining)', payload.substring(24).match(/.{1,2}/g).join(' '));
                    }
                }
            }

            // If we decoded specific params, return them.
            if (params && params !== "") return { innerMsg, params };
        }

        // DK Event Notification Decoding
        if (type === 0x03) {
            if (subtype === 0x11) {
                if (payload.length > 4) {
                    const actualPayload = payload.substring(4);
                    const category = actualPayload.substring(0, 2);
                    const data = actualPayload.substring(2);

                    const CATEGORIES = {
                        '01': 'Command Complete',
                        '02': 'Ranging Session Status',
                        '03': 'Device Ranging Intent',
                        '04': 'Vehicle Status',
                        '05': 'RKE Request',
                        '06': 'RKE Acknowledge'
                    };

                    innerMsg = CATEGORIES[category] || `Category_0x${category}`;

                    // Default
                    params = formatParam('Data', data);

                    // Category 01: Command Complete
                    if (category === '01') {
                        const code = data.length >= 2 ? data.substring(0, 2) : '';
                        let codeDesc = 'Unknown';
                        if (code === '80') codeDesc = 'General Error';
                        if (code === '00') codeDesc = 'Deselect_SE';
                        params = formatParam('Status', codeDesc) + formatParam('Code', '0x' + code);
                    }

                    // Category 02: Ranging Session Status
                    if (category === '02') {
                        const code = data.length >= 2 ? data.substring(0, 2) : '';
                        const statusMap = {
                            '00': 'URSK Refresh',
                            '01': 'URSK Not Found',
                            '02': 'Not Required',
                            '03': 'Secure Ranging Failed',
                            '04': 'Terminated',
                            '06': 'Recovery Failed', // Typo fix
                            '07': 'Suspended'
                        };
                        params = formatParam('Status', statusMap[code] || '0x' + code);
                    }

                    // Category 03: Device Ranging Intent
                    if (category === '03') {
                        const code = data.length >= 2 ? data.substring(0, 2) : '';
                        const levelMap = {
                            '00': 'Low Confidence',
                            '01': 'Medium Confidence',
                            '02': 'High Confidence'
                        };
                        params = formatParam('Level', levelMap[code] || '0x' + code);
                    }

                    // Category 04: Vehicle Status & 05: RKE Request
                    if (category === '04' || category === '05') {
                        params = parseTLV(data, RKE_TAGS);
                    }

                    // Default logic fallback using TLV check
                    const upperData = data.toUpperCase();
                    if ((category !== '04' && category !== '05') && (upperData.startsWith('7F') || upperData.startsWith('30'))) {
                        params = parseTLV(data, RKE_TAGS);
                    }
                    return { innerMsg, params };
                }
            }
            if (subtype === 0x03) return { innerMsg: "Legacy Intent", params: formatParam('Data', payload) };
        }

        if (type === 0x05) {
            // Supplementary
            if (subtype === 0x0D) {
                innerMsg = "Time_Sync";
                if (payload.length >= 46) {
                    const eventCount = BigInt('0x' + payload.substring(0, 16));
                    const uwbTime = BigInt('0x' + payload.substring(16, 32));
                    // ... decodes ...
                    const uncertainty = parseInt(payload.substring(32, 34), 16);
                    const skewAvail = parseInt(payload.substring(34, 36), 16);
                    const ppm = parseInt(payload.substring(36, 40), 16);
                    const success = parseInt(payload.substring(40, 42), 16);

                    params = formatParam('EventCount', eventCount) +
                        formatParam('UWB Time', uwbTime) +
                        formatParam('Uncertainty', '0x' + uncertainty.toString(16)) +
                        formatParam('Skew', skewAvail) +
                        formatParam('PPM', ppm) +
                        formatParam('Success', success);
                    return { innerMsg, params };
                }
            }
        }
        return { innerMsg, params: formatParam('Payload', payload.match(/.{1,2}/g).join(' ')) };
    };


    function renderCccStats(messages) {
        const CCC_CONSTANTS = {
            MESSAGE_TYPES: {
                0x00: "Framework",
                0x01: "SE",
                0x02: "UWB Ranging Service",
                0x03: "DK Event Notification",
                0x04: "Vehicle OEM App",
                0x05: "Supplementary Service",
                0x06: "Head Unit Pairing"
            },
            UWB_RANGING_MSGS: {
                0x01: "Ranging_Capability_RQ",
                0x02: "Ranging_Capability_RS",
                0x03: "Ranging_Session_RQ",
                0x04: "Ranging_Session_RS",
                0x05: "Ranging_Session_Setup_RQ",
                0x06: "Ranging_Session_Setup_RS",
                0x07: "Ranging_Suspend_RQ",
                0x08: "Ranging_Suspend_RS",
                0x09: "Ranging_Recovery_RQ",
                0x0A: "Ranging_Recovery_RS",
                0x0B: "Configurable_Ranging_Recovery_RQ",
                0x0C: "Configurable_Ranging_Recovery_RS"
            },
            DK_EVENT_CATEGORIES: {
                0x01: "Command Complete",
                0x02: "Ranging Session Status Changed",
                0x03: "Device Ranging Intent",
                0x04: "Vehicle Status Change",
                0x05: "RKE Request",
                0x11: "DK Event Notification"
            },
            SUPPLEMENTARY_MSGS: {
                0x0D: "Time_Sync"
            },
            FRAMEWORK_MSGS: {
                0x04: "OP_CONTROL_FLOW",
                0x18: "Proprietary / Unknown"
            },
            SE_MSGS: {
                0x0B: "DK_APDU_RQ",
                0x0C: "DK_APDU_RS"
            }
        };

        let cccStatsData = messages || [];
        let cccColumnFilters = new Map();

        const container = document.getElementById('cccStatsContainer');
        if (!container) return;

        // Setup Static Header
        if (!container.querySelector('table')) {
            container.innerHTML = `
            <div class="table-container" style="overflow-x: auto;">
                <table class="log-table ccc-table" id="cccStatsTable">
                    <thead>
                        <tr id="cccHeaderRow">
                            <th style="width: 140px;">Time</th>
                            <th style="width: 150px;">BLE Address</th>
                            <th style="width: 60px;">Dir</th>
                            <th style="width: 150px;">Message Category</th>
                            <th style="width: 125px;">Message Type</th>
                            <th style="width: 90px;">Message</th>
                            <th style="width: 400px;">Parameters</th>
                            <th style="width: 200px;">Raw Data</th>
                        </tr>
                        <tr class="filter-row">
                            <th><input type="text" placeholder="Filter..." data-col="0"></th>
                            <th><input type="text" placeholder="Filter..." data-col="1"></th>
                            <th><input type="text" placeholder="Filter..." data-col="2"></th>
                            <th><input type="text" placeholder="Filter..." data-col="3"></th>
                            <th><input type="text" placeholder="Filter..." data-col="4"></th>
                            <th><input type="text" placeholder="Filter..." data-col="5"></th>
                            <th><input type="text" placeholder="Filter..." data-col="6"></th>
                            <th><input type="text" placeholder="Filter..." data-col="7"></th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>`;

            // Attach filter listeners
            const inputs = container.querySelectorAll('.filter-row input');
            inputs.forEach(input => {
                input.addEventListener('input', (e) => {
                    const colIndex = parseInt(e.target.dataset.col, 10);
                    const value = e.target.value.toLowerCase();
                    if (value) {
                        cccColumnFilters.set(colIndex, value);
                    } else {
                        cccColumnFilters.delete(colIndex);
                    }
                    updateCccTableBody();
                });
            });


            // Add column resize functionality using the utility
            if (typeof makeTableResizable === 'function') {
                makeTableResizable('cccStatsTable');
            }


            // Add Excel export functionality
            const exportCccBtn = document.getElementById('exportCccBtn');
            if (exportCccBtn) {
                exportCccBtn.addEventListener('click', () => {
                    if (!cccStatsData || cccStatsData.length === 0) {
                        alert('No CCC data to export.');
                        return;
                    }

                    // Prepare data for export
                    const exportData = cccStatsData.map(msg => {
                        const categoryName = CCC_CONSTANTS.MESSAGE_TYPES[msg.type] || `Unknown (0x${msg.type.toString(16).padStart(2, '0').toUpperCase()})`;
                        let typeName = `Unknown`;
                        if (msg.type === 0x02) typeName = CCC_CONSTANTS.UWB_RANGING_MSGS[msg.subtype] || typeName;
                        else if (msg.type === 0x03) typeName = CCC_CONSTANTS.DK_EVENT_CATEGORIES[msg.subtype] || typeName;
                        else if (msg.type === 0x01 && CCC_CONSTANTS.SE_MSGS && CCC_CONSTANTS.SE_MSGS[msg.subtype]) typeName = CCC_CONSTANTS.SE_MSGS[msg.subtype];
                        else if (msg.type === 0x05) typeName = CCC_CONSTANTS.SUPPLEMENTARY_MSGS[msg.subtype] || typeName;
                        else if (msg.type === 0x00 && CCC_CONSTANTS.FRAMEWORK_MSGS && CCC_CONSTANTS.FRAMEWORK_MSGS[msg.subtype]) typeName = CCC_CONSTANTS.FRAMEWORK_MSGS[msg.subtype];

                        const innerMessage = msg._decoded ? (msg._decoded.innerMsg || "-") : "-";
                        const params = msg._decoded ? (msg._decoded.params || "") : "";
                        const paramsText = params.replace(/<[^>]*>/g, '');

                        // FIX: Use robust address resolution
                        let handleNumber = -1;
                        if (msg.handle !== undefined && msg.handle !== null) {
                            if (typeof msg.handle === 'string' && msg.handle.startsWith('0x')) {
                                handleNumber = parseInt(msg.handle, 16);
                            } else {
                                handleNumber = Number(msg.handle);
                            }
                        }
                        const peerAddress = msg.peerAddress || btsnoopConnectionMap.get(handleNumber)?.address || 'N/A';

                        return {
                            Time: msg.timestamp,
                            'BLE Address': peerAddress,
                            Dir: msg.direction,
                            'Category': categoryName,
                            'Type': typeName,
                            'Message': innerMessage,
                            'Parameters': paramsText,
                            'Raw Data': msg.fullHex
                        };
                    });

                    const ws = XLSX.utils.json_to_sheet(exportData);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, "CCC_Analysis");
                    XLSX.writeFile(wb, "ccc_analysis.xlsx");
                });
            }
        }

        // --- Helper: Update Table Body ---
        function updateCccTableBody() {
            const tbody = container.querySelector('tbody');
            if (!tbody) return;

            const filtered = cccStatsData.filter(msg => {
                if (cccColumnFilters.size === 0) return true;

                const categoryName = CCC_CONSTANTS.MESSAGE_TYPES[msg.type] || `Unknown (0x${msg.type.toString(16).padStart(2, '0').toUpperCase()})`;
                let typeName = `Unknown`;
                if (msg.type === 0x02) typeName = CCC_CONSTANTS.UWB_RANGING_MSGS[msg.subtype] || typeName;
                else if (msg.type === 0x03) typeName = CCC_CONSTANTS.DK_EVENT_CATEGORIES[msg.subtype] || typeName;
                else if (msg.type === 0x01 && CCC_CONSTANTS.SE_MSGS && CCC_CONSTANTS.SE_MSGS[msg.subtype]) typeName = CCC_CONSTANTS.SE_MSGS[msg.subtype];
                else if (msg.type === 0x05) typeName = CCC_CONSTANTS.SUPPLEMENTARY_MSGS[msg.subtype] || typeName;
                else if (msg.type === 0x00 && CCC_CONSTANTS.FRAMEWORK_MSGS && CCC_CONSTANTS.FRAMEWORK_MSGS[msg.subtype]) typeName = CCC_CONSTANTS.FRAMEWORK_MSGS[msg.subtype];

                const subtypeHex = `0x${msg.subtype.toString(16).padStart(2, '0').toUpperCase()}`;
                let displayType = typeName;
                if (typeName === 'Unknown') displayType = subtypeHex;
                else displayType = `${typeName} (${subtypeHex})`; // Plain text for filtering

                if (!msg._decoded) {
                    msg._decoded = decodePayload(msg.type, msg.subtype, msg.payload);
                }
                const innerMessage = msg._decoded.innerMsg || "-";
                const params = msg._decoded.params || "";
                const paramsText = params.replace(/<[^>]*>/g, '');

                // FIX: Resolve address for filtering
                let handleNumber = -1;
                if (msg.handle !== undefined && msg.handle !== null) {
                    if (typeof msg.handle === 'string' && msg.handle.startsWith('0x')) {
                        handleNumber = parseInt(msg.handle, 16);
                    } else {
                        handleNumber = Number(msg.handle);
                    }
                }
                const peerAddress = msg.peerAddress || btsnoopConnectionMap.get(handleNumber)?.address || 'N/A';

                const columns = [
                    msg.timestamp,
                    peerAddress,
                    msg.direction,
                    categoryName,
                    displayType,
                    innerMessage,
                    paramsText,
                    msg.fullHex
                ];

                return Array.from(cccColumnFilters.entries()).every(([colIndex, filterValue]) => {
                    const cellValue = String(columns[colIndex]).toLowerCase();
                    return cellValue.includes(filterValue);
                });
            });

            let html = '';
            filtered.forEach(msg => {
                const categoryName = CCC_CONSTANTS.MESSAGE_TYPES[msg.type] || `Unknown (0x${msg.type.toString(16).padStart(2, '0').toUpperCase()})`;
                let typeName = `Unknown`;
                if (msg.type === 0x02) typeName = CCC_CONSTANTS.UWB_RANGING_MSGS[msg.subtype] || typeName;
                else if (msg.type === 0x03) typeName = CCC_CONSTANTS.DK_EVENT_CATEGORIES[msg.subtype] || typeName;
                else if (msg.type === 0x01 && CCC_CONSTANTS.SE_MSGS && CCC_CONSTANTS.SE_MSGS[msg.subtype]) typeName = CCC_CONSTANTS.SE_MSGS[msg.subtype];
                else if (msg.type === 0x05) typeName = CCC_CONSTANTS.SUPPLEMENTARY_MSGS[msg.subtype] || typeName;
                else if (msg.type === 0x00 && CCC_CONSTANTS.FRAMEWORK_MSGS && CCC_CONSTANTS.FRAMEWORK_MSGS[msg.subtype]) typeName = CCC_CONSTANTS.FRAMEWORK_MSGS[msg.subtype];

                const subtypeHex = `0x${msg.subtype.toString(16).padStart(2, '0').toUpperCase()}`;
                let displayType = typeName;
                if (typeName === 'Unknown') displayType = subtypeHex;
                else displayType = `${typeName} <span style="font-size: 0.85em; color: #888;">(${subtypeHex})</span>`;

                if (!msg._decoded) msg._decoded = decodePayload(msg.type, msg.subtype, msg.payload);
                const innerMessage = msg._decoded.innerMsg || "-";
                const params = msg._decoded.params || "";

                // FIX: Resolve address for display
                let handleNumber = -1;
                if (msg.handle !== undefined && msg.handle !== null) {
                    if (typeof msg.handle === 'string' && msg.handle.startsWith('0x')) {
                        handleNumber = parseInt(msg.handle, 16);
                    } else {
                        handleNumber = Number(msg.handle);
                    }
                }
                const peerAddress = msg.peerAddress || btsnoopConnectionMap.get(handleNumber)?.address || 'N/A';

                html += `<tr>
                    <td>${msg.timestamp}</td>
                    <td>${peerAddress}</td>
                    <td><span class="badge ${msg.direction === 'Sending' ? 'badge-out' : 'badge-in'}">${msg.direction}</span></td>
                    <td>${categoryName}</td>
                    <td>${displayType}</td>
                    <td>${innerMessage}</td>
                    <td style="overflow-wrap: anywhere; word-break: break-all;">${params}</td>
                    <td style="color: #999;">${msg.fullHex}</td>
                </tr>`;
            });

            if (filtered.length === 0) {
                html = '<tr><td colspan="8">No matching messages found.</td></tr>';
            }
            tbody.innerHTML = html;
        }

        updateCccTableBody();
    }

    // --- Highlights Processing ---
    function renderHighlights(highlights) {
        if (!highlights || !accountsList || !deviceEventsTable) return;

        const bleKeysTable = document.getElementById('bleKeysTable');
        const bleKeysTbody = bleKeysTable ? bleKeysTable.querySelector('tbody') : null;

        accountsList.innerHTML = '';

        // Render Accounts
        if (highlights.accounts && highlights.accounts.size > 0) {
            highlights.accounts.forEach(acc => {
                const li = document.createElement('li');
                li.textContent = acc;
                accountsList.appendChild(li);
            });
        } else {
            accountsList.innerHTML = '<li>No accounts found in logs.</li>';
        }

        // FIX: Correctly render BLE Security Keys (IRK/LTK)
        if (bleKeysTbody) {
            bleKeysTbody.innerHTML = ''; // Clear previous content
            const keyEvents = btsnoopConnectionEvents.filter(e => e.keyType); // Filter for key events

            if (keyEvents.length === 0) {
                bleKeysTbody.innerHTML = '<tr><td colspan="3">No BLE security keys found.</td></tr>';
            } else {
                let keyTableHtml = '';
                const seenKeys = new Set(); // Deduplicate keys

                for (const event of keyEvents) {
                    // Deduplication check
                    if (seenKeys.has(event.keyValue)) continue;
                    seenKeys.add(event.keyValue);

                    // Resolve peer address from connection map if handle is available
                    // FIX: Handle both hex string (0x...) and raw number formats from worker
                    let handleNumber = -1;
                    if (event.handle !== undefined && event.handle !== null) {
                        if (typeof event.handle === 'string' && event.handle.startsWith('0x')) {
                            handleNumber = parseInt(event.handle, 16);
                        } else {
                            handleNumber = Number(event.handle);
                        }
                    }

                    const peerAddress = event.peerAddress || btsnoopConnectionMap.get(handleNumber)?.address || 'N/A';

                    keyTableHtml += `<tr>
                        <td>${peerAddress}</td>
                        <td>${event.keyType}</td>
                        <td><span style="font-family: monospace; font-size: 0.9em;">${event.keyValue}</span></td>
                    </tr>`;
                }
                bleKeysTbody.innerHTML = keyTableHtml;
            }
        }

        // Render Device Events
        deviceEventsTable.innerHTML = '';
        if (highlights.deviceEvents && highlights.deviceEvents.length > 0) {
            // Sort events by timestamp to process them in chronological order
            highlights.deviceEvents.sort((a, b) => {
                if (!a.timestamp || !b.timestamp) return 0;
                return a.timestamp.localeCompare(b.timestamp);
            });

            const lastState = new Map(); // Tracks the last value for each event type
            let tableHtml = '';

            highlights.deviceEvents.forEach(event => {
                const lastValue = lastState.get(event.event);
                // Add to table if it's the first time we see this event, or if its value has changed.
                if (lastValue === undefined || lastValue.value !== event.detail) {
                    const previousValue = lastValue ? lastValue.value : 'N/A';
                    tableHtml += `<tr>
                            <td>${event.date || 'N/A'}</td>
                            <td>${event.time || 'N/A'}</td>
                            <td>${escapeHtml(event.event)}</td>
                            <td>${escapeHtml(event.detail)}</td>
                            <td>${escapeHtml(previousValue)}</td>
                            <td class="log-line-cell">${escapeHtml(event.originalText)}</td>
                        </tr>`;
                    lastState.set(event.event, { value: event.detail });
                }
            });
            deviceEventsTable.innerHTML = tableHtml;
        } else {
            deviceEventsTable.innerHTML = '<tr><td colspan="6">No specific device or setting events found.</td></tr>';
        }

        // Setup filters for all highlight tables
        setupTableFilters('deviceEventsTable');
        setupTableFilters('bleKeysTable');
        setupTableFilters('btsnoopConnectionEventsTable');

        // Make tables resizable
        if (typeof makeTableResizable === 'function') {
            makeTableResizable('deviceEventsTable');
            makeTableResizable('bleKeysTable');
            makeTableResizable('btsnoopConnectionEventsTable');
        }
    }

    // Helper to generic table filtering
    function setupTableFilters(tableId) {
        const table = document.getElementById(tableId);
        if (!table) return;

        const inputs = table.querySelectorAll('.filter-row input');
        // Debounce map for this table
        if (!table._filterState) table._filterState = {};

        inputs.forEach(input => {
            // Remove old listeners to avoid duplicates if re-run (simplified approach)
            // A better way is to attach once, but renderHighlights runs multiple times.
            // We'll replace the element to clear listeners or check a flag.
            if (input._hasListener) return;
            input._hasListener = true;

            input.addEventListener('input', (e) => {
                const colIndex = parseInt(e.target.dataset.col, 10);
                const value = e.target.value.toLowerCase();
                table._filterState[colIndex] = value;

                // Apply filters
                const tbody = table.querySelector('tbody');
                const rows = Array.from(tbody.querySelectorAll('tr'));

                rows.forEach(row => {
                    let visible = true;
                    // Check all active filters
                    for (const [cIdx, filterTerm] of Object.entries(table._filterState)) {
                        if (!filterTerm) continue;
                        const cell = row.children[cIdx];
                        if (!cell || !cell.textContent.toLowerCase().includes(filterTerm)) {
                            visible = false;
                            break;
                        }
                    }
                    row.style.display = visible ? '' : 'none';
                });
            });
        });
    }

    function processForDashboardStats() {
        const cpuRegex = /(\d+)% user \+ (\d+)% kernel|Load: ([\d.]+)/i;
        const tempRegex = /(?:temp(?:erature)?|tsens_tz_sensor\d+):?\s*[:=]\s*(\d+)/i;

        const cpuDataPoints = [];
        const allCpuLoads = [];
        const temperatureDataPoints = [];
        const batteryDataPoints = []; // This will now be empty, as it's processed by workers.
        // This loop is necessary to calculate CPU and Temperature, which are not done by the workers.
        for (const line of originalLogLines) {
            if (line.isMeta) continue;

            // C
            const cpuMatch = line.originalText.match(cpuRegex);
            if (cpuMatch) {
                const totalLoad = cpuMatch[3]
                    ? parseFloat(cpuMatch[3]) * 10 // Approximate percentage for "Load: x.xx" format
                    : parseInt(cpuMatch[1]) + parseInt(cpuMatch[2]);

                allCpuLoads.push(totalLoad);
                if (line.timestamp) {
                    cpuDataPoints.push({ ts: logcatToDate(line.timestamp), load: totalLoad });
                }
            }

            // Temperature Parsing
            const tempMatch = line.originalText.match(tempRegex);
            if (tempMatch) {
                let temp = parseInt(tempMatch[1]);
                if (temp > 1000) temp /= 1000; // Normalize from milli-Celsius (e.g., 45000)
                else if (temp > 100) temp /= 10;  // Normalize from tenths of a degree (e.g., 350 for 35.0)
                if (temp > 0 && temp < 100) { // Sanity check
                    if (line.timestamp) {
                        temperatureDataPoints.push({ ts: logcatToDate(line.timestamp), temp: temp });
                    }
                }
            }
        }

        const tempsOnly = temperatureDataPoints.map(d => d.temp);
        const avgCpu = allCpuLoads.length > 0 ? (allCpuLoads.reduce((a, b) => a + b, 0) / allCpuLoads.length).toFixed(1) : 'N/A';
        const maxCpu = allCpuLoads.length > 0 ? Math.max(...allCpuLoads) : 'N/A';
        const minCpu = allCpuLoads.length > 0 ? Math.min(...allCpuLoads) : 'N/A';

        const avgTemp = tempsOnly.length > 0 ? (tempsOnly.reduce((a, b) => a + b, 0) / tempsOnly.length).toFixed(1) : 'N/A';
        const maxTemp = tempsOnly.length > 0 ? Math.max(...tempsOnly).toFixed(1) : 'N/A';
        const minTemp = tempsOnly.length > 0 ? Math.min(...tempsOnly).toFixed(1) : 'N/A';

        // This part of the logic is no longer needed here, as the data comes from workers.
        // It's kept for the return object structure but will be populated by worker results.
        const batteryLevels = batteryDataPoints.map(d => d.level);
        const avgBattery = batteryLevels.length > 0 ? (batteryLevels.reduce((a, b) => a + b, 0) / batteryLevels.length).toFixed(1) : 'N/A';
        const maxBattery = batteryLevels.length > 0 ? Math.max(...batteryLevels) : 'N/A';
        const minBattery = batteryLevels.length > 0 ? Math.min(...batteryLevels) : 'N/A';


        return { avgCpu, maxCpu, minCpu, avgTemp, maxTemp, minTemp, avgBattery, maxBattery, minBattery, cpuDataPoints, temperatureDataPoints };
    }

    function renderDashboardStats(stats) {
        if (cpuLoadStats) {
            cpuLoadStats.innerHTML = `<p>Average Total Load: <span class="stat-value">${stats.avgCpu}%</span></p><p>Max Total Load: <span class="stat-value">${stats.maxCpu}%</span></p>`;
        }
        if (temperatureStats) {
            temperatureStats.innerHTML = `<p>Avg: <span class="stat-value">${stats.avgTemp}°C</span></p><p>Min: <span class="stat-value">${stats.minTemp}°C</span></p><p>Max: <span class="stat-value">${stats.maxTemp}°C</span></p>`;
        }
        if (batteryStats) {
            batteryStats.innerHTML = `<p>Avg: <span class="stat-value">${stats.avgBattery}%</span></p><p>Min: <span class="stat-value">${stats.minBattery}%</span></p><p>Max: <span class="stat-value">${stats.maxBattery}%</span></p>`;
        }
    }

    function renderAppVersions(versions) {
        if (!appVersionsTable) return;
        appVersionsTable.innerHTML = '';

        const searchTerm = appSearchInput.value.toLowerCase();
        const filteredVersions = searchTerm
            ? versions.filter(([pkg]) => pkg.toLowerCase().includes(searchTerm))
            : versions;

        if (filteredVersions.length === 0) {
            appVersionsTable.innerHTML = '<tr><td colspan="2">No application versions found in logs.</td></tr>';
            return;
        }
        let html = '';
        filteredVersions.forEach(([pkg, version]) => {
            const highlightedPkg = searchTerm
                ? pkg.replace(new RegExp(searchTerm, 'gi'), (match) => `<mark>${match}</mark>`)
                : pkg;
            html += `<tr><td>${highlightedPkg}</td><td>${version}</td></tr>`;
        });
        appVersionsTable.innerHTML = html;
    }

    function renderCpuPlot(dataPoints) {
        if (!cpuLoadPlotContainer) return;
        if (!dataPoints || dataPoints.length < 2) {
            cpuLoadPlotContainer.innerHTML = '<p style="text-align: center; color: #5f6368;">Not enough data to plot CPU load.</p>';
            return;
        }

        const width = cpuLoadPlotContainer.clientWidth;
        const height = 100;
        const padding = 5;

        const minTs = dataPoints[0].ts.getTime();
        const maxTs = dataPoints[dataPoints.length - 1].ts.getTime();
        const timeRange = maxTs - minTs;

        // Y-axis is from 0 to 100%
        const maxLoad = 100;

        const points = dataPoints.map(d => {
            const x = timeRange > 0 ? ((d.ts.getTime() - minTs) / timeRange) * (width - padding * 2) + padding : width / 2;
            const y = height - ((d.load / maxLoad) * (height - padding * 2) + padding);
            return `${x},${y}`;
        }).join(' ');

        const svg = `
            <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
                <polyline
                    class="sparkline"
                    points="${points}"
                />
            </svg>
        `;
        cpuLoadPlotContainer.innerHTML = svg;
    }

    function renderTemperaturePlot(dataPoints) {
        const container = document.getElementById('temperaturePlotContainer');
        if (!container) return;
        if (!dataPoints || dataPoints.length < 2) {
            container.innerHTML = '<p style="text-align: center; color: #5f6368;">Not enough data to plot temperature.</p>';
            return;
        }

        const width = container.clientWidth;
        const height = 100;
        const padding = 5;

        const minTs = dataPoints[0].ts.getTime();
        const maxTs = dataPoints[dataPoints.length - 1].ts.getTime();
        const timeRange = maxTs - minTs;

        const temps = dataPoints.map(d => d.temp);
        const minTemp = Math.min(...temps);
        const maxTemp = Math.max(...temps);
        const tempRange = maxTemp - minTemp > 0 ? maxTemp - minTemp : 1;

        const points = dataPoints.map(d => {
            const x = timeRange > 0 ? ((d.ts.getTime() - minTs) / timeRange) * (width - padding * 2) + padding : width / 2;
            const y = height - (((d.temp - minTemp) / tempRange) * (height - padding * 2) + padding);
            return `${x},${y}`;
        }).join(' ');

        const svg = `
            <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
                <polyline
                    class="sparkline"
                    points="${points}"
                />
            </svg>
        `;
        container.innerHTML = svg;
    }

    function renderBatteryPlot(dataPoints) {
        if (!batteryPlotContainer) return;
        if (!dataPoints || dataPoints.length < 2) {
            batteryPlotContainer.innerHTML = '<p style="text-align: center; color: #5f6368;">Not enough data to plot battery level.</p>';
            return;
        }

        const width = batteryPlotContainer.clientWidth;
        const height = 100;
        const padding = 5;

        const minTs = dataPoints[0].ts.getTime();
        const maxTs = dataPoints[dataPoints.length - 1].ts.getTime();
        const timeRange = maxTs - minTs;

        // Y-axis is from 0 to 100%
        const minLevel = 0;
        const maxLevel = 100;
        const levelRange = maxLevel - minLevel;

        const points = dataPoints.map(d => {
            const x = timeRange > 0 ? ((d.ts.getTime() - minTs) / timeRange) * (width - padding * 2) + padding : width / 2;
            const y = height - (((d.level - minLevel) / levelRange) * (height - padding * 2) + padding);
            return `${x},${y}`;
        }).join(' ');

        const svg = `
            <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
                <polyline
                    class="sparkline"
                    points="${points}"
                    style="stroke: #34a853;"
                />
            </svg>
        `;
        batteryPlotContainer.innerHTML = svg;
    }



    // --- Connectivity Tab Logic ---
    let connectivityScrollListenerAttached = false;

    async function setupConnectivityTab() {
        const container = document.getElementById('connectivityLogContainer');
        if (!connectivityScrollListenerAttached && container) {
            container.addEventListener('scroll', renderConnectivityVirtualLogs);
            connectivityScrollListenerAttached = true;
        }
        await applyConnectivityFilters();
    }

    function renderConnectivityVirtualLogs() {
        // Re-use the generic virtual logger but targeting the connectivity container
        renderVirtualLogs(
            document.getElementById('connectivityLogContainer'),
            document.getElementById('connectivityLogSizer'),
            document.getElementById('connectivityLogViewport'),
            filteredConnectivityLogLines
        );
    }

    async function applyConnectivityFilters() {
        // 1. Gather filtered lines from each active tech
        let candidates = [];
        const usedIds = new Set();
        const addLine = (line) => {
            // Use line index as unique identifier to prevent duplicates
            if (!usedIds.has(line.index)) {
                candidates.push(line);
                usedIds.add(line.index);
            }
        };

        // BLE Logic
        if (activeTechs.ble) {
            const bleKeywords = {
                manager: /BluetoothManager|BluetoothAdapter/i,
                gatt: /GATT|BtGatt/i,
                smp: /SMP/i,
                hci: /HCI/i
            };
            const activeLayers = new Set();
            document.querySelectorAll('#bleFiltersPanel .filter-icon.active').forEach(b => activeLayers.add(b.dataset.bleFilter));

            bleLogLines.forEach(line => {
                if (line.isMeta) { addLine(line); return; }
                // If activeLayers is empty, it means no specific layer selected. 
                // If the USER wants "ALL" when none selected, we change logic.
                // But existing behavior suggests checking what is active.
                // If nothing active, show nothing for this tech?
                // Let's assume if master is ON, at least one filter should be ON or we show nothing?
                // The user said "individual filter laid out so user can add which ever is relavent".
                // We'll stick to: if no granulr filter active, show nothing (except headers).
                if (activeLayers.size === 0) return;

                const hit = Array.from(activeLayers).some(layer => bleKeywords[layer]?.test(line.originalText));
                if (hit) addLine(line);
            });
        }

        // NFC Logic
        if (activeTechs.nfc) {
            const nfcKeywords = {
                framework: /NfcManager|NfcService|TagDispatcher|NfcTag/i,
                hce: /HostEmulationManager|ApduServiceInfo/i,
                p2p: /P2pLinkManager/i,
                hal: /NxpNci|NxpExtns|libnfc|libnfc-nci/i
            };
            const activeLayers = new Set();
            document.querySelectorAll('#nfcFiltersPanel .filter-icon.active').forEach(b => activeLayers.add(b.dataset.nfcFilter));

            nfcLogLines.forEach(line => {
                if (line.isMeta) { addLine(line); return; }
                if (activeLayers.size === 0) return;
                const hit = Array.from(activeLayers).some(layer => nfcKeywords[layer]?.test(line.originalText));
                if (hit) addLine(line);
            });
        }

        // DCK Logic
        if (activeTechs.dck) {
            dckLogLines.forEach(line => {
                addLine(line);
            });
        }

        // Sort by index to maintain chronological order
        candidates.sort((a, b) => a.index - b.index);

        // Update global source
        connectivityLogLines = candidates;

        // Apply main filters (Search, Level, Time)
        return applyFiltersAsync(
            connectivityLogLines,
            filteredConnectivityLogLines,
            document.getElementById('connectivityLogContainer'),
            renderConnectivityVirtualLogs
        );
    }

    // Master Toggle Handler Helper
    function bindMasterToggle(id, techKey, filterPanelId, activeSet) { // Added activeSet
        const toggle = document.getElementById(id);
        const panel = filterPanelId ? document.getElementById(filterPanelId) : null;

        if (toggle) {
            // Find parent tech-section for styling. If panel exists use it, else use toggle's parent.
            const techSection = panel ? panel.closest('.tech-section') : toggle.closest('.tech-section');

            // Init state
            toggle.checked = activeTechs[techKey];

            const updatePanelState = () => {
                if (!activeTechs[techKey]) {
                    if (techSection) techSection.classList.add('disabled');
                    // Visually disable but allow interaction to auto-enable
                } else {
                    if (techSection) techSection.classList.remove('disabled');
                }
            };

            updatePanelState();

            toggle.addEventListener('change', () => {
                activeTechs[techKey] = toggle.checked;
                updatePanelState();

                // Trigger refresh
                refreshActiveTab();
            });
        }
    }

    async function setupCccTab() {
        // Ensure BTSnoop processing is done, as CCC stats depend on it
        if (!isBtsnoopProcessed && fileTasks.length > 0) {
            await processForBtsnoop();
        }

        // Populate cccStatsData if empty
        // Populate cccStatsData if empty
        if ((!cccStatsData || cccStatsData.length === 0) && btsnoopPackets && btsnoopPackets.length > 0) {
            // Filter for packets that have numeric 'type' (indicating decoded CCC message)
            cccStatsData = btsnoopPackets.filter(p => typeof p.type === 'number');
        } else if (btsnoopPackets && btsnoopPackets.length > 0) {
            // Merge strategy: Append unique btsnoop packets if not already present
            const btsnoopCcc = btsnoopPackets.filter(p => typeof p.type === 'number');
            // Simple append for now to ensure visibility
            // cccStatsData.push(...btsnoopCcc); 
            // Logic: If text logs exist, we might have exact duplicates if we assume logs cover same events. 
            // But usually they are disjoint (text vs binary). 
            // Safest: Don't overwrite. Append if needed.
            // For now, I'll assume users want to see everything.
            const existingCount = cccStatsData.length;
            // Check if we already merged? 
        }

        // Render the CCC stats to the new container
        renderCccStats(cccStatsData);
    }

    async function setupBtsnoopTab() {
        console.log('[BTSnoop Debug] 1. setupBtsnoopTab called.');
        if (!btsnoopScrollListenerAttached && btsnoopLogContainer instanceof HTMLElement) {
            // FIX: Attach the correct virtual scroll listener.
            btsnoopLogContainer.addEventListener('scroll', () => {
                if (!window.btsnoopScrollFrame) {
                    window.btsnoopScrollFrame = requestAnimationFrame(() => {
                        renderBtsnoopVirtualLogs();
                        window.btsnoopScrollFrame = null;

                        // Sync horizontal scroll
                        const header = document.getElementById('btsnoopHeader');
                        if (header && header.firstChild) {
                            header.scrollLeft = btsnoopLogContainer.scrollLeft;
                        }
                    });
                }
            });
            btsnoopScrollListenerAttached = true;
        }
        // FIX: Trigger the initial render after setting up the tab.
        console.log('[BTSnoop Debug] 2. Attaching btsnoop layer filters and calling renderBtsnoopPackets.');
        createBtsnoopFilterHeader(); // Ensure header and filters are created
        attachBtsnoopFilterListeners(); // Attach listeners to the filter buttons (CMD, EVT, etc.)
        renderBtsnoopPackets();
    }

    function attachBtsnoopFilterListeners() {
        const container = document.getElementById('btsnoopFilterContainer');
        if (!container) return;

        const buttons = container.querySelectorAll('.filter-icon');
        buttons.forEach(btn => {
            // Remove old listeners to avoid duplicates (safeguard)
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);

            newBtn.addEventListener('click', () => {
                const type = newBtn.dataset.btsnoopFilter;
                newBtn.classList.toggle('active');

                if (newBtn.classList.contains('active')) {
                    activeBtsnoopFilters.add(type);
                } else {
                    activeBtsnoopFilters.delete(type);
                }

                // Trigger re-filter and re-render
                renderBtsnoopPackets();
            });

            // Sync initial state
            if (activeBtsnoopFilters.has(newBtn.dataset.btsnoopFilter)) {
                newBtn.classList.add('active');
            } else {
                newBtn.classList.remove('active'); // Should be active by default if set matches
            }
        });
    }

    // --- BTSnoop Log Processing ---
    async function processForBtsnoop() {
        return new Promise(async (resolve, reject) => {
            const exportXlsxBtn = document.getElementById('exportBtsnoopXlsxBtn');

            // FIX: Ensure the database is open before proceeding.
            if (!db) {
                return reject('DB not open');
            }

            if (!btsnoopInitialView || !btsnoopContentView || !btsnoopFilterContainer) return reject('BTSnoop UI elements not found');

            // Check if worker code has changed and invalidate cache
            const workerVersion = '2025-12-07-00:09';
            const storedVersion = localStorage.getItem('btsnoopWorkerVersion');
            if (storedVersion !== workerVersion) {
                console.log('[BTSnoop] Worker code changed (v' + workerVersion + '), clearing ALL cache...');
                // Clear IndexedDB btsnoopStore
                if (db) {
                    const tx = db.transaction([BTSNOOP_STORE_NAME], 'readwrite');
                    await tx.objectStore(BTSNOOP_STORE_NAME).clear();
                    await new Promise((resolve, reject) => {
                        tx.oncomplete = resolve;
                        tx.onerror = reject;
                    });
                }
                // Clear btsnoopPackets from logStore too!
                await saveData('btsnoopPackets', null);
                // Clear in-memory cache
                btsnoopPackets = [];
                btsnoopConnectionEvents = [];
                isBtsnoopProcessed = false; // Force re-processing
                localStorage.setItem('btsnoopWorkerVersion', workerVersion);
                console.log('[BTSnoop] All cache cleared (including logStore), will force re-process');
            }

            TimeTracker.start('BTSnoop Processing');

            const btsnoopTasks = fileTasks.filter(task =>
                /btsnoop_hci\.log.*/.test(task.path)
            );

            if (btsnoopTasks.length === 0) {
                btsnoopInitialView.innerHTML = '<p>No btsnoop_hci.log files found.</p>';
                TimeTracker.stop('BTSnoop Processing');
                isBtsnoopProcessed = true; // Mark as "processed" even if no files, to prevent re-running.
                return resolve();
            }

            // FIX: Clear previous connection events to prevent duplication
            btsnoopConnectionEvents = [];

            // Clear previous data from IndexedDB
            // OPTIMIZATION Phase 3: We now use single blob storage (logStore) so explicit clear isn't needed (overwrite).
            // btsnoopPackets accumulator reset
            btsnoopPackets = [];

            btsnoopInitialView.innerHTML = `<p>Found ${btsnoopTasks.length} btsnoop file(s). Parsing and storing packets...</p><div id="btsnoop-progress"></div>`;
            const progressDiv = document.getElementById('btsnoop-progress');

            try {
                const bufferPromises = btsnoopTasks.map(task => (task.file || task.blob).arrayBuffer());
                const fileBuffers = await Promise.all(bufferPromises);

                // FIX: Embed the worker script to avoid file:// origin security errors.
                const btsnoopWorkerScript = `
                // --- Dictionaries for HCI Parsing ---
                const HCI_COMMANDS = { 0x200C: 'LE Set Scan Enable', 0x200B: 'LE Set Scan Parameters', 0x2006: 'LE Set Advertising Parameters', 0x200A: 'LE Set Advertising Enable', 0x200D: 'LE Create Connection' };
                const HCI_EVENTS = { 0x0E: 'Command Complete', 0x0F: 'Command Status', 0x3E: 'LE Meta Event' };
                const LE_META_EVENTS = { 0x01: 'LE Connection Complete', 0x02: 'LE Advertising Report', 0x0A: 'LE Enhanced Connection Complete', 0x0B: 'LE Connection Update Complete' };
                const L2CAP_CIDS = { 0x0004: 'ATT', 0x0005: 'LE Signaling', 0x0006: 'SMP' };
                const ATT_OPCODES = { 0x01: 'Error Rsp', 0x02: 'Exchange MTU Req', 0x03: 'Exchange MTU Rsp', 0x04: 'Find Info Req', 0x05: 'Find Info Rsp', 0x08: 'Read By Type Req', 0x09: 'Read By Type Rsp', 0x0A: 'Read Req', 0x0B: 'Read Rsp', 0x0C: 'Read Blob Req', 0x0D: 'Read Blob Rsp', 0x10: 'Read By Group Type Req', 0x11: 'Read By Group Type Rsp', 0x12: 'Write Req', 0x13: 'Write Rsp', 0x52: 'Write Cmd', 0x1B: 'Notification', 0x1D: 'Indication', 0x1E: 'Confirmation' };
                const SMP_CODES = { 0x01: 'Pairing Req', 0x02: 'Pairing Rsp', 0x03: 'Pairing Confirm', 0x04: 'Pairing Random', 0x05: 'Pairing Failed', 0x06: 'Encryption Info (LTK)', 0x07: 'Master Identification', 0x08: 'Identity Info (IRK)' };

                // --- Main Worker Logic ---
                self.onmessage = async (event) => {
                    const { fileBuffers, localBtAddress } = event.data; // Receive local address
                    if (!fileBuffers || fileBuffers.length === 0) {
                        self.postMessage({ type: 'error', message: 'No file buffers received.' });
                        return;
                    }

                    try {
                        const finalBuffer = concatenateBtsnoopBuffers(fileBuffers);
                        const dataView = new DataView(finalBuffer);

                        const magic = new TextDecoder().decode(finalBuffer.slice(0, 8));
                        if (magic !== 'btsnoop\\0') {
                            throw new Error('Invalid btsnoop file format.');
                        }

                        let offset = 16;
                        let packetNumber = 1;
                        const BTSNOOP_EPOCH_DELTA = 0x00dcddb30f2f8000n;
                        const connectionMap = new Map();
                        const packets = [];
                        const CHUNK_SIZE = 1000;

                        while (offset < finalBuffer.byteLength) {
                            if (offset + 24 > finalBuffer.byteLength) break;

                            const includedLength = dataView.getUint32(offset + 4, false);
                            const flags = dataView.getUint32(offset + 8, false); // FIX: Flags are at offset 8, not 12.
                            const timestampMicro = dataView.getBigUint64(offset + 16, false);

                            const timestampMs = Number(timestampMicro - BTSNOOP_EPOCH_DELTA) / 1000;
                            const date = new Date(timestampMs);
                            const timestampStr = \`\${(date.getMonth()+1).toString().padStart(2, '0')}-\${date.getDate().toString().padStart(2, '0')} \${date.getHours().toString().padStart(2, '0')}:\${date.getMinutes().toString().padStart(2, '0')}:\${date.getSeconds().toString().padStart(2, '0')}.\${date.getMilliseconds().toString().padStart(3, '0')}\`;

                            offset += 24;
                            if (offset + includedLength > finalBuffer.byteLength) break;

                            const packetData = new Uint8Array(finalBuffer, offset, includedLength);
                            const direction = (flags & 1) === 0 ? 'Host -> Controller' : 'Controller -> Host';

                            const interpretation = interpretHciPacket(packetData, connectionMap, packetNumber, direction, timestampStr, localBtAddress);

                            const packet = { ...interpretation, number: packetNumber, timestamp: timestampStr, direction };
                            packets.push(packet);

                            if (packets.length >= CHUNK_SIZE) {
                                self.postMessage({ type: 'chunk', packets: packets });
                                packets.length = 0;
                            }

                            packetNumber++;
                            offset += includedLength;
                        }

                        if (packets.length > 0) {
                            self.postMessage({ type: 'chunk', packets: packets });
                        }

                        self.postMessage({ type: 'complete', connectionMap: Object.fromEntries(connectionMap) });

                    } catch (error) {
                        self.postMessage({ type: 'error', message: error.message, stack: error.stack });
                    }
                };

                // --- Helper Functions for Worker ---
                function concatenateBtsnoopBuffers(buffers) {
                    if (buffers.length === 1) return buffers[0];
                    let totalSize = buffers[0].byteLength;
                    for (let i = 1; i < buffers.length; i++) {
                        totalSize += (buffers[i].byteLength - 16);
                    }
                    const finalArray = new Uint8Array(totalSize);
                    let offset = 0;
                    finalArray.set(new Uint8Array(buffers[0]), offset);
                    offset += buffers[0].byteLength;
                    for (let i = 1; i < buffers.length; i++) {
                        const dataPart = new Uint8Array(buffers[i], 16);
                        finalArray.set(dataPart, offset);
                        offset += dataPart.byteLength;
                    }
                    return finalArray.buffer;
                }

                function interpretHciPacket(data, connectionMap, packetNum, direction, timestampStr, localBtAddress) {
                    if (data.length === 0) return { type: 'Empty', summary: 'Empty Packet', tags: [], data: '' };
                    const packetType = data[0];
                    const tags = [];
                    const hexData = Array.from(data, byte => byte.toString(16).padStart(2, '0')).join(' ');
                    let source, destination;

                    switch (packetType) {
                        case 1: // HCI Command - ALWAYS Host -> Controller
                            tags.push('cmd');
                            source = 'Host';
                            destination = 'Controller';
                            if (data.length < 4) return { type: 'HCI Cmd', summary: 'Malformed', tags, source, destination, data: hexData };
                            const ocf = data[1] | ((data[2] & 0x03) << 8);
                            const ogf = (data[2] >> 2) & 0x3F;
                            const opcode = (ogf << 10) | ocf;
                            const paramLength = data[3];
                            const opName = HCI_COMMANDS[opcode] || \`Unknown OpCode: 0x\${opcode.toString(16).padStart(4, '0')}\`;
                            return { type: 'HCI Cmd', summary: \`\${opName}, Len: \${paramLength}\`, tags, source, destination, data: hexData };
                        case 2: // ACL Data - Direction from flags, use connection map for address
                            tags.push('acl');
                            if (data.length < 5) return { type: 'ACL Data', summary: 'Malformed', tags, source: 'Host', destination: 'Controller', data: hexData };
                            const handle = ((data[2] & 0x0F) << 8) | data[1];
                            const dataLength = (data[4] << 8) | data[3];
                            const connInfo = connectionMap.get(handle);
                            const remoteAddr = connInfo ? connInfo.address : \`Handle 0x\${handle.toString(16)}\`;
                            // Direction determines who is source and who is destination
                            if (direction === 'Host -> Controller') {
                                source = localBtAddress;
                                destination = remoteAddr;
                            } else {
                                source = remoteAddr;
                                destination = localBtAddress;
                            }
                            let aclSummary = \`Len: \${dataLength}\`;
                            if (data.length >= 9) {
                                tags.push('l2cap');
                                const l2capLength = (data[6] << 8) | data[5];
                                const cid = (data[8] << 8) | data[7];
                                aclSummary += \`, L2CAP Len: \${l2capLength}, CID: \${L2CAP_CIDS[cid] || '0x' + cid.toString(16)}\`;
                                if (cid === 4 && data.length >= 10) {
                                    tags.push('att');
                                    const attOpcode = data[9]; 
                                    aclSummary += \` > ATT: \${ATT_OPCODES[attOpcode] || 'Op ' + attOpcode.toString(16)}\`; 
                                }
                                else if (cid === 6 && data.length >= 10) { 
                                    tags.push('smp'); 
                                    const smpCode = data[9]; 
                                    aclSummary += \` > SMP: \${SMP_CODES[smpCode] || 'Code ' + smpCode.toString(16)}\`;
                                    
                                    // Extract IRK and LTK keys from SMP packets
                                    if (smpCode === 0x06 && data.length >= 26) { // Encryption Info (LTK) - 16 bytes
                                        const ltk = Array.from(data.slice(10, 26)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
                                        aclSummary += ' [LTK Found]';
                                        // FIX: Use source address to identify who sent the key (Owner)
                                        const peerAddr = source;
                                        self.postMessage({ type: 'connectionEvent', event: { packetNum, handle, keyType: 'LTK', keyValue: ltk, timestamp: timestampStr, peerAddress: peerAddr } });
                                    }
                                    else if (smpCode === 0x08 && data.length >= 26) { // Identity Info (IRK) - 16 bytes
                                        const irk = Array.from(data.slice(10, 26)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
                                        // FIX: Use source address to identify who sent the key (Owner)
                                        const peerAddr = source;
                                        self.postMessage({ type: 'connectionEvent', event: { packetNum, handle, keyType: 'IRK', keyValue: irk, timestamp: timestampStr, peerAddress: peerAddr } });
                                        aclSummary += \` [IRK Found]\`;
                                    }
                                }
                            }
                            return { type: 'ACL Data', summary: aclSummary, tags, source, destination, data: hexData, handle };
                        case 4: // HCI Event - ALWAYS Controller -> Host (destination is localBtAddress)
                            tags.push('evt');
                            source = 'Controller';
                            destination = localBtAddress;
                            if (data.length < 3) return { type: 'HCI Evt', summary: 'Malformed', tags, source, destination, data: hexData};
                            const eventCode = data[1];
                            const eventLength = data[2];
                            let summary = \`\${HCI_EVENTS[eventCode] || 'Unknown Event'}, Len: \${eventLength}\`;
                            if (eventCode === 0x0E && data.length >= 7) { const cmdOpcode = (data[5] << 8) | data[4]; summary += \` (for \${HCI_COMMANDS[cmdOpcode] || '0x' + cmdOpcode.toString(16)})\`; }
                            else if (eventCode === 0x3E && data.length >= 4) {
                                const subEventCode = data[3];
                                summary += \` > \${LE_META_EVENTS[subEventCode] || 'Unknown Sub-event'}\`;
                                const isEnhanced = subEventCode === 0x0A;
                                const isLegacy = subEventCode === 0x01;
                                if ((isLegacy || isEnhanced) && data.length >= 15) {
                                    const connectionHandle = (data[6] << 8) | data[5];
                                    const peerAddressSlice = isEnhanced ? data.slice(10, 16) : data.slice(9, 15);
                                    const peerAddress = Array.from(peerAddressSlice).reverse().map(b => b.toString(16).padStart(2, '0')).join(':').toUpperCase();
                                    if (connectionHandle) { connectionMap.set(connectionHandle, { address: peerAddress, packetNum: packetNum }); }
                                    // Destination is always the host for an event. The peer is the remote device.
                                    summary += \` (Handle: 0x\${connectionHandle.toString(16)}, Peer: \${peerAddress})\`;
                                    // Send connection event with timestamp
                                    self.postMessage({ type: 'connectionEvent', event: { packetNum: packetNum, timestamp: timestampStr, handle: \`0x\${connectionHandle.toString(16).padStart(4, '0')}\`, address: peerAddress, rawData: hexData } });
                                }
                            }
                            return { type: 'HCI Evt', summary, tags, source, destination, data: hexData };
                        default:
                            source = 'Unknown';
                            destination = 'Unknown';
                            return { type: \`Unknown (0x\${packetType.toString(16)})\`, summary: 'Unknown packet type', tags, source, destination, data: hexData };
                    }
                }
            `;
                // Cache bust: 2025-12-07-11:55 - Fixed ReferenceError for localBtAddress in worker.
                const blob = new Blob([btsnoopWorkerScript], { type: 'application/javascript' });
                const workerURL = URL.createObjectURL(blob);
                const worker = new Worker(workerURL);
                let totalPacketsStored = 0;

                worker.onmessage = async (event) => {
                    const { type, packets, message, stack, connectionMap } = event.data;

                    if (type === 'chunk') {
                        // OPTIMIZATION Phase 3: Accumulate in memory, save once at end
                        for (const packet of packets) {
                            btsnoopPackets.push(packet);
                        }
                        totalPacketsStored += packets.length;
                        progressDiv.textContent = `Parsed ${totalPacketsStored.toLocaleString()} packets...`;
                    } else if (type === 'connectionEvent') {
                        // The worker sends the complete event object with the correct timestamp. Simply push it.
                        btsnoopConnectionEvents.push(event.data.event);
                    } else if (type === 'complete') {
                        btsnoopConnectionMap = new Map(Object.entries(connectionMap));
                        progressDiv.textContent = `Parsed ${totalPacketsStored.toLocaleString()} packets. finalizing...`;

                        // Post-processing to resolve handles (in memory now)
                        await resolveBtsnoopHandles(btsnoopConnectionMap);

                        // OPTIMIZATION: Save all packets as a single blob (fast)
                        progressDiv.textContent = `Saving ${totalPacketsStored.toLocaleString()} packets...`;
                        await saveData('btsnoopPackets', btsnoopPackets);

                        // Show the content view and hide the initial parsing view.
                        const btsnoopToolbar = document.getElementById('btsnoopToolbar');
                        btsnoopContentView.style.display = 'flex';
                        btsnoopFilterContainer.style.display = 'block';
                        btsnoopInitialView.style.display = 'none';
                        if (btsnoopToolbar) btsnoopToolbar.style.display = 'block'; // Show toolbar with export button

                        TimeTracker.stop('BTSnoop Processing');

                        isBtsnoopProcessed = true; // Set the flag to true

                        // Preserve existing highlights data instead of creating empty arrays
                        if (storedHighlights) {
                            renderHighlights(storedHighlights);
                        }
                        renderBtsnoopConnectionEvents();
                        // The setupBtsnoopTab function will now handle the initial render correctly.
                        setupBtsnoopTab();
                        worker.terminate();
                        URL.revokeObjectURL(workerURL); // Clean up the blob URL
                    } else if (type === 'error') {
                        reject(new Error(`BTSnoop Worker Error: ${message}\n${stack}`));
                    }
                };

                worker.onerror = (err) => {
                    console.error('Error from btsnoop-worker:', err);
                    btsnoopInitialView.innerHTML = `<p>An unexpected error occurred during parsing: ${err.message}</p>`;
                    URL.revokeObjectURL(workerURL);
                    TimeTracker.stop('BTSnoop Processing');
                };

                worker.postMessage({ fileBuffers, localBtAddress: localBtAddress }, fileBuffers);

            } catch (error) {
                console.error('Error processing btsnoop log:', error);
                btsnoopInitialView.innerHTML = `<p>Error: ${error.message}</p>`;
                // FIX: Resolve the promise on error
                if (window.resolveBtsnoopProcessing) {
                    window.resolveBtsnoopProcessing();
                    btsnoopProcessingPromise = null;
                }
                TimeTracker.stop('BTSnoop Processing');
            }
        });
    }

    async function resolveBtsnoopHandles(connectionMap) {
        // OPTIMIZATION Phase 3: Process in memory (Array) instead of DB Cursor
        console.log('[Perf] Resolving btsnoop handles in memory...');
        const start = performance.now();
        let updates = 0;

        for (let i = 0; i < btsnoopPackets.length; i++) {
            const packet = btsnoopPackets[i];

            if (packet.handle !== undefined && connectionMap.has(packet.handle)) {
                const connInfo = connectionMap.get(packet.handle);
                if (packet.direction === 'Controller -> Host' && String(packet.source).startsWith('Handle')) {
                    packet.source = connInfo.address;
                    updates++;
                } else if (packet.direction === 'Host -> Controller' && String(packet.destination).startsWith('Handle')) {
                    packet.destination = connInfo.address;
                    updates++;
                }
            }

            // Yield every 20k items to keep UI responsive
            if (i % 20000 === 0 && i > 0) await new Promise(r => setTimeout(r, 0));
        }

        console.log(`[Perf] Resolved handles for ${updates} packets in ${(performance.now() - start).toFixed(2)}ms`);
    }

    function renderBtsnoopConnectionEvents() {
        const tbody = document.getElementById('btsnoopConnectionEventsTable')?.querySelector('tbody');
        if (!tbody) return;

        // FIX: Filter out key events, as they are now shown in their own table.
        const connectionEventsOnly = btsnoopConnectionEvents.filter(e => !e.keyType);

        if (connectionEventsOnly.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">No LE Connection Complete events found.</td></tr>';
        } else {
            const tableHtml = connectionEventsOnly.map(event => `
                <tr>
                    <td>${event.packetNum}</td>
                    <td>${event.timestamp || 'N/A'}</td>
                    <td>${event.address || 'N/A'}</td>
                    <td>${event.address || 'N/A'}</td>
                    <td>${escapeHtml(event.rawData)}</td>
                </tr>`).join('');
            tbody.innerHTML = tableHtml;
        }
    }

    function exportBtsnoopToXlsx() {
        if (filteredBtsnoopPackets.length === 0) {
            alert("No filtered BTSnoop packets to export.");
            return;
        }

        // Convert packet objects to an array of arrays for the worksheet
        const dataForSheet = filteredBtsnoopPackets.map(p => [
            p.number,
            p.timestamp,
            p.source || (p.direction === 'Controller -> Host' ? 'Controller' : 'Host'),
            p.destination || (p.direction === 'Host -> Controller' ? 'Controller' : 'Host'),
            p.type,
            p.summary,
            p.data
        ]);

        const ws = XLSX.utils.aoa_to_sheet([
            ['No.', 'Timestamp', 'Source', 'Destination', 'Type', 'Summary', 'Data'], // Header row
            ...dataForSheet
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'BTSnoop Packets');
        XLSX.writeFile(wb, 'btsnoop_packets.xlsx');
    }

    let currentBtsnoopRequest = null; // To manage batched loading

    // This is the new, correct rendering function for btsnoop.
    async function renderBtsnoopPackets() {
        console.log('[BTSnoop Debug] 3. Rendering btsnoop packets (virtual scroll).');
        TimeTracker.start('BTSnoop Filtering');

        // --- Scroll Restoration Logic ---
        // 1. Find the anchor packet. Prioritize the selected packet.
        let anchorPacket = selectedBtsnoopPacket;
        // If no selected packet, or it's not in the current view, fall back to the top visible packet.
        if (!anchorPacket && filteredBtsnoopPackets.length > 0 && btsnoopLogContainer.scrollTop > 0) {
            const topVisibleIndex = Math.floor(btsnoopLogContainer.scrollTop / LINE_HEIGHT);
            anchorPacket = filteredBtsnoopPackets[topVisibleIndex];
        }
        // --- End Scroll Restoration ---

        const columnFilters = Array.from(btsnoopColumnFilters)
            .map(input => ({
                index: parseInt(input.dataset.column, 10),
                value: input.value.toLowerCase()
            }))
            .filter(f => f.value);

        // OPTIMIZATION Phase 3: Load from single blob
        const stored = await loadData('btsnoopPackets');
        const allPackets = stored && stored.value ? stored.value : [];

        filteredBtsnoopPackets = allPackets.filter(packet => {
            // FIX: If no filters are active, SHOW ALL. Previously it might have been restrictive.
            // Check if ANY filter tag matches the packet's tags.
            // Packet tags are an array (e.g. ['cmd', 'hci']).
            // If activeBtsnoopFilters has entries, at least one must match.
            const passesTags = activeBtsnoopFilters.size === 0 || packet.tags.some(tag => activeBtsnoopFilters.has(tag));
            if (!passesTags) return false;

            return columnFilters.every(filter => {
                const columnData = [packet.number, packet.timestamp, packet.source || '', packet.destination || '', packet.type, packet.summary, packet.data];
                return columnData[filter.index].toString().toLowerCase().includes(filter.value);
            });
        });

        // --- Scroll Restoration Logic ---
        // 2. Find the new index of the anchor and set the scroll position.
        let newScrollTop = 0;
        if (anchorPacket) {
            const newAnchorIndex = filteredBtsnoopPackets.findIndex(p => p.number === anchorPacket.number);
            if (newAnchorIndex !== -1) {
                // FIX: Center the selected packet in the viewport
                const containerHeight = btsnoopLogContainer.clientHeight;
                // Scroll to selected packet (approximate position for variable heights)
                const avgRowHeight = 40; // Estimate: 20px base + some wrapping
                const centerOffset = Math.floor(containerHeight / 2);
                newScrollTop = Math.max(0, (newAnchorIndex * avgRowHeight) - centerOffset);
            } else if (selectedBtsnoopPacket) {
                // If anchor not found but we have a selected packet, clear selection
                selectedBtsnoopPacket = null;
            }
        }
        // Store scroll position for later (after render)
        // --- End Scroll Restoration ---

        // OPTIMIZATION Phase 3: Pre-calculate row positions for virtual scrolling
        // This moves O(N) calculation from scroll event (16ms) to filter event (once).
        btsnoopRowPositions = new Float32Array(filteredBtsnoopPackets.length); // Use TypedArray for memory efficiency
        btsnoopTotalHeight = 0;

        for (let i = 0; i < filteredBtsnoopPackets.length; i++) {
            btsnoopRowPositions[i] = btsnoopTotalHeight;
            const packet = filteredBtsnoopPackets[i];
            const dataLength = packet.data?.length || 0;
            const estimatedLines = Math.max(1, Math.ceil(dataLength / 100));
            const height = 20 * estimatedLines;
            btsnoopTotalHeight += height;
        }

        TimeTracker.stop('BTSnoop Filtering');
        renderBtsnoopVirtualLogs(); // Render the filtered results - scroll will happen inside
    }

    function createBtsnoopFilterHeader() {
        const header = document.getElementById('btsnoopHeader');
        if (!header || header.hasChildNodes()) return;

        // Use a single grid container for both titles and filters to ensure alignment
        const headerGrid = document.createElement('div');
        headerGrid.className = 'btsnoop-header-grid';

        const columns = ['No.', 'Timestamp', 'Source', 'Destination', 'Type', 'Summary', 'Data'];

        // 1. Create Title Cells
        columns.forEach((text, i) => {
            const cell = document.createElement('div');
            cell.className = 'btsnoop-header-cell';
            cell.innerHTML = `
                ${text}
                <div class="resize-handle-col"></div>
            `;
            headerGrid.appendChild(cell);
        });

        // 2. Create Filter Cells
        columns.forEach((text, i) => {
            const cell = document.createElement('div');
            cell.className = 'btsnoop-filter-cell';
            const input = document.createElement('input');
            input.type = 'text';
            input.dataset.column = i;
            input.id = `btsnoop-filter-col-${i}`;
            input.name = `btsnoop-filter-col-${i}`;
            input.placeholder = `Filter ${text}...`;
            cell.appendChild(input);
            headerGrid.appendChild(cell);
        });

        header.appendChild(headerGrid);

        btsnoopColumnFilters = document.querySelectorAll('.btsnoop-filter-cell input');
        // FIX: Attach all filter listeners here, after the elements have been created.
        btsnoopColumnFilters.forEach(input => {
            input.addEventListener('input', handleBtsnoopFilterInput);
        });
        attachLayerFilterListeners(btsnoopFilterButtons, activeBtsnoopFilters, () => renderBtsnoopPackets());

        // --- Column Resize Logic (Simplified for Grid) ---
        // Note: Resizing grid columns dynamically requires updating the grid-template-columns style.
        // For now, we'll rely on the CSS Grid's minmax/fr units, but basic resizing support can be added
        // by updating the style on the container.
        let thBeingResized = null;
        let startX, startWidths;

        headerGrid.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('resize-handle-col')) {
                thBeingResized = e.target.parentElement; // The .btsnoop-header-cell
                startX = e.pageX;

                // Get current computed widths of all columns
                const computedStyle = window.getComputedStyle(headerGrid);
                const gridTemplateColumns = computedStyle.gridTemplateColumns.split(' ');
                startWidths = gridTemplateColumns.map(w => parseFloat(w));

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
                e.preventDefault();
            }
        });

        function onMouseMove(e) {
            if (thBeingResized) {
                const diffX = e.pageX - startX;
                // Find the index of the column being resized
                const cells = Array.from(headerGrid.children);
                const cellIndex = cells.indexOf(thBeingResized);
                // The index matches the column index directly for the first row
                if (cellIndex >= 0 && cellIndex < startWidths.length) {
                    const newWidth = Math.max(50, startWidths[cellIndex] + diffX); // Min 50px

                    // Update the grid-template-columns for BOTH header and body
                    const newTemplate = startWidths.map((w, i) => i === cellIndex ? `${newWidth}px` : `${w}px`).join(' ');

                    headerGrid.style.gridTemplateColumns = newTemplate;
                    currentBtsnoopGridTemplate = newTemplate; // Persist for new rows

                    // Update body rows by updating a shared style or iterating (less efficient)
                    // Better: Update a CSS variable or a specific style rule.
                    // For simplicity, we'll update the body rows directly if they exist.
                    const bodyRows = document.querySelectorAll('.btsnoop-row');
                    bodyRows.forEach(row => row.style.gridTemplateColumns = newTemplate);

                    // Also update the stylesheet rule if possible to persist for new rows
                    // (Skipped for now, direct style update works for visible rows)
                }
            }
        }

        function onMouseUp() {
            thBeingResized = null;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }
    }

    function renderBtsnoopVirtualLogs() {
        const sizer = document.getElementById('btsnoopLogSizer');
        const viewport = document.getElementById('btsnoopLogViewport');
        const container = document.getElementById('btsnoopLogContainer');

        if (viewport) viewport.style.position = 'relative'; // Ensure relative positioning logic

        if (!container || !sizer || !viewport) return;

        // Use cached total height
        sizer.style.height = `${btsnoopTotalHeight}px`;

        const scrollTop = container.scrollTop;
        const containerHeight = container.clientHeight;
        const viewportBottom = scrollTop + containerHeight;

        // 1. Binary Search for Start Index (O(log N))
        let startIndex = 0;
        let low = 0, high = btsnoopRowPositions.length - 1;

        while (low <= high) {
            const mid = (low + high) >>> 1;
            if (btsnoopRowPositions[mid] < scrollTop) {
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }
        startIndex = Math.max(0, high);

        // Adjust start index with buffer
        startIndex = Math.max(0, startIndex - BUFFER_LINES);

        // 2. Find End Index (Linear scan from start, O(viewport_items))
        let endIndex = startIndex;
        for (let i = startIndex; i < filteredBtsnoopPackets.length; i++) {
            if (btsnoopRowPositions[i] > viewportBottom) {
                endIndex = i;
                break;
            }
            endIndex = i + 1; // Include this item
        }
        endIndex = Math.min(filteredBtsnoopPackets.length, endIndex + BUFFER_LINES);

        // Ensure we always render at least some rows
        if (endIndex <= startIndex) {
            endIndex = Math.min(filteredBtsnoopPackets.length, startIndex + 50);
        }

        // Scroll to selected packet if needed
        if (selectedBtsnoopPacket) {
            const selectedIndex = filteredBtsnoopPackets.findIndex(p => p.number === selectedBtsnoopPacket.number);
            if (selectedIndex !== -1 && btsnoopRowPositions[selectedIndex] !== undefined) {
                const selectedPosition = btsnoopRowPositions[selectedIndex];
                // Estimate height again or use cached? We didn't cache heights individually, just positions.
                // Height = next pos - current pos (or estimate).
                const nextPos = btsnoopRowPositions[selectedIndex + 1];
                const selectedHeight = nextPos ? (nextPos - selectedPosition) : 20;

                const centerOffset = Math.floor(containerHeight / 2) - (selectedHeight / 2);
                const targetScroll = Math.max(0, selectedPosition - centerOffset);
                // Only scroll if selected packet is not in view
                if (selectedPosition < scrollTop || selectedPosition > scrollTop + containerHeight) {
                    console.log('[BTSnoop Scroll] Scrolling to selected packet', selectedBtsnoopPacket.number, 'at position', selectedPosition);
                    container.scrollTop = targetScroll;
                }
            }
        }



        // Recycle or create DOM elements for the rows
        const visibleRows = [];
        for (let i = startIndex; i < endIndex; i++) {
            const packet = filteredBtsnoopPackets[i];
            if (!packet) continue;

            // Recycle or create a row element
            let row = btsnoopRowPool.pop();
            if (!row) { // Create a new row if the pool is empty
                row = document.createElement('div');
                row.className = 'btsnoop-row'; // Match CSS class
                // Create cells
                for (let j = 0; j < 7; j++) {
                    const cell = document.createElement('div');
                    cell.className = 'btsnoop-cell';
                    cell.style.color = '#e0e0e0'; // Explicit text color
                    cell.style.fontFamily = "'JetBrains Mono', 'Consolas', 'Menlo', 'Courier New', monospace";
                    cell.style.fontSize = '13px';
                    // Special styling for Data column (last column) - allow wrapping
                    if (j === 6) {
                        cell.style.whiteSpace = 'pre-wrap';
                        cell.style.wordBreak = 'break-all';
                        cell.style.minHeight = '20px';
                        cell.style.height = 'auto';
                    }
                    row.appendChild(cell);
                }
            }

            // Populate the row with data
            row.style.position = 'absolute';
            row.style.top = `${btsnoopRowPositions[i]}px`;
            row.style.width = '100%';

            const cells = row.children; // Get all div cells
            const cellData = [
                packet.number, packet.timestamp,
                packet.source || (packet.direction === 'Controller -> Host' ? 'Controller' : 'Host'),
                packet.destination || (packet.direction === 'Host -> Controller' ? 'Controller' : localBtAddress),
                packet.type, packet.summary, packet.data
            ];

            // Apply selection style
            if (selectedBtsnoopPacket && selectedBtsnoopPacket.number === packet.number) {
                row.classList.add('selected');
            } else {
                row.classList.remove('selected');
            }
            // Apply alternating row background
            if (packet.number % 2 === 0) {
                row.classList.add('even-row');
                row.classList.remove('odd-row');
            } else {
                row.classList.add('odd-row');
                row.classList.remove('even-row');
            }
            // Store packet data for click handling
            row.dataset.packetNumber = packet.number;

            for (let j = 0; j < 7; j++) {
                // FIX: Ensure data is converted to string and handle undefined/null
                const dataStr = (cellData[j] !== undefined && cellData[j] !== null) ? String(cellData[j]) : '';
                cells[j].textContent = dataStr;
                cells[j].title = dataStr + " (Ctrl+Click to copy)"; // Full text on hover
                cells[j].dataset.logText = dataStr; // Store raw text for copying
                cells[j].style.color = '#e0e0e0'; // Ensure visibility
                cells[j].style.fontFamily = "'JetBrains Mono', 'Consolas', 'Menlo', 'Courier New', monospace";
                cells[j].style.fontSize = '13px';
                // Special styling for Data column (last column) - allow wrapping
                if (j === 6) {
                    cells[j].style.whiteSpace = 'pre-wrap';
                    cells[j].style.wordBreak = 'break-all';
                    cells[j].style.minHeight = '20px';
                    cells[j].style.height = 'auto';
                } else {
                    cells[j].style.whiteSpace = 'nowrap';
                }
                // Ensure the class is added (not duplicated if recycling)
                if (!cells[j].classList.contains('btsnoop-copy-cell')) {
                    cells[j].classList.add('btsnoop-copy-cell');
                }
            }

            // Position the row correctly in the viewport using cumulative position
            row.style.position = 'absolute';
            row.style.top = '0';
            row.style.left = '0';
            row.style.width = '100%';
            row.style.transform = `translateY(${btsnoopRowPositions[i]}px)`;
            row.style.minHeight = '20px';
            row.style.height = 'auto';
            row.style.display = 'grid';

            // FIX: Apply the current column widths if they have been resized
            if (currentBtsnoopGridTemplate) {
                row.style.gridTemplateColumns = currentBtsnoopGridTemplate;
            }
            else {
                row.style.gridTemplateColumns = '60px 120px 160px 160px 80px minmax(200px, 2fr) minmax(200px, 3fr)';
            }
            visibleRows.push(row);
        }

        console.log('[BTSnoop Debug] 6. Created', visibleRows.length, 'visible rows');

        // Return unused rows to the pool and update the viewport
        while (viewport.firstChild) {
            btsnoopRowPool.push(viewport.removeChild(viewport.firstChild));
        }
        visibleRows.forEach(row => viewport.appendChild(row));

        console.log('[BTSnoop Debug] 7. Viewport now has', viewport.children.length, 'children');
    }

    function handleBtsnoopFilterInput(e) {
        clearTimeout(btsnoopColumnFilterDebounceTimer);
        btsnoopColumnFilterDebounceTimer = setTimeout(() => {
            renderBtsnoopPackets();
        }, 300); // 300ms debounce delay
    }

    function handleViewportInteraction(event) {
        const target = event.target;
        if (target.classList.contains('copy-log-btn')) {
            const logText = target.dataset.logText;
            if (logText) {
                navigator.clipboard.writeText(logText).then(() => {
                    // Success feedback
                    const originalText = target.textContent;
                    target.textContent = 'Copied!';
                    target.style.background = '#34a853'; // Green for success
                    setTimeout(() => {
                        target.textContent = originalText;
                        target.style.background = ''; // Revert background
                    }, 1200);
                }).catch(err => {
                    console.error('Failed to copy log line:', err);
                });
            }
        } else if (target.closest('.btsnoop-copy-cell')) {
            // Handle clicking on a BTSnoop cell
            const cell = target.closest('.btsnoop-copy-cell');
            const row = target.closest('.btsnoop-row');

            console.log('[BTSnoop Click] Cell clicked, row:', row?.dataset.packetNumber, 'ctrl:', event.ctrlKey, 'meta:', event.metaKey);

            // 1. Handle Selection (single click without modifiers)
            if (row && row.dataset.packetNumber && !event.ctrlKey && !event.metaKey) {
                const packetNum = parseInt(row.dataset.packetNumber, 10);
                const packet = filteredBtsnoopPackets.find(p => p.number === packetNum);

                if (packet) {
                    if (selectedBtsnoopPacket === packet) {
                        selectedBtsnoopPacket = null; // Deselect
                        console.log('[BTSnoop] Deselected packet', packetNum);
                    } else {
                        selectedBtsnoopPacket = packet; // Select
                        console.log('[BTSnoop] Selected packet', packetNum);
                    }
                    // Fast re-render to show selection state
                    renderBtsnoopVirtualLogs();
                }
            }

            // 2. Handle Copy (Ctrl+Click or Cmd+Click)
            if ((event.ctrlKey || event.metaKey) && cell) {
                console.log('[BTSnoop Copy] Attempting to copy:', cell.dataset.logText?.substring(0, 50));
                const logText = cell.dataset.logText;
                if (logText) {
                    navigator.clipboard.writeText(logText).then(() => {
                        console.log('[BTSnoop Copy] Successfully copied:', logText.length, 'characters');
                        // Visual feedback
                        const originalBg = cell.style.backgroundColor;
                        const originalColor = cell.style.color;
                        cell.style.backgroundColor = '#34a853';
                        cell.style.color = '#fff';
                        setTimeout(() => {
                            cell.style.backgroundColor = originalBg;
                            cell.style.color = originalColor;
                        }, 300);
                    }).catch(err => {
                        console.error('[BTSnoop Copy] Failed to copy:', err);
                    });
                }
                event.preventDefault();
                event.stopPropagation();
            }
        }
        else if (target.closest('.log-line-meta')) {
            // Handle collapsing/expanding file logs in ANY viewport
            const lineDiv = target.closest('.log-line-meta');
            const lineIndex = parseInt(lineDiv.dataset.lineIndex, 10);
            const activeViewport = target.closest('.log-viewport');
            let sourceArray = filteredLogLines; // Default to main logs

            if (activeViewport.id === 'connectivityLogViewport') sourceArray = filteredConnectivityLogLines;
            else if (activeViewport === kernelLogViewport) sourceArray = filteredKernelLogLines;

            if (!isNaN(lineIndex) && sourceArray[lineIndex]) {
                const clickedLine = sourceArray[lineIndex];
                if (collapsedFileHeaders.has(clickedLine.originalText)) {
                    collapsedFileHeaders.delete(clickedLine.originalText);
                } else {
                    collapsedFileHeaders.add(clickedLine.originalText);
                }
                // Re-apply the correct filter function for the active tab
                if (activeViewport.id === 'connectivityLogViewport') applyConnectivityFilters();
                else if (activeViewport === kernelLogViewport) processForKernel(); // Kernel has no sub-filters
                else applyFilters(); // Main log view

            }
        } else if (target.closest('.log-line')) {
            // Prevent text selection from being cleared by the highlight re-render
            // if the user is dragging to select.
            if (event.detail > 1 || (event.buttons === 1 && window.getSelection().toString().length > 0)) {
                return;
            }

            // Handle clicking on the line itself to set it as an anchor
            const lineDiv = target.closest('.log-line');
            const lineIndex = parseInt(lineDiv.dataset.lineIndex, 10);

            if (!isNaN(lineIndex) && filteredLogLines[lineIndex]) {
                const clickedLine = filteredLogLines[lineIndex];

                // Toggle anchor: if clicking the same line, deselect it. Otherwise, select the new one.
                if (userAnchorLine === clickedLine) {
                    userAnchorLine = null;
                } else {
                    userAnchorLine = clickedLine;
                }

                // Re-render the currently visible lines to show/hide the highlight.
                // This is much faster than a full applyFilters() call.
                handleMainLogScroll();
            }
        } else {
            // Clear BTSnoop selection if clicking outside BTSnoop cells
            if (selectedBtsnoopPacket && !target.closest('.btsnoop-copy-cell') && !target.closest('.btsnoop-header-cell')) {
                console.log('[BTSnoop] Clearing selection - clicked outside');
                selectedBtsnoopPacket = null;
                renderBtsnoopVirtualLogs();
            }
        }
    }

    // --- Memory Cleanup on Exit ---
    // Ensure all data, including persisted data in IndexedDB, is cleared when the user leaves.
    window.addEventListener('beforeunload', async (event) => {
        await clearPreviousState(true); // true to clear persisted data
    });

    // --- Application Initialization ---
    async function initializeApp() {
        const skeletonLoader = document.getElementById('skeletonLoader');

        try {
            await openDb(); // Ensure the database is open before any other operations.

            // Attach file input listeners. The state is cleared inside processFiles.
            if (zipInput) {
                zipInput.addEventListener('change', (event) => processFiles(event.target.files));
            }
            if (logFilesInput) {
                logFilesInput.addEventListener('change', (event) => processFiles(event.target.files));
            }

            initializeDynamicElements();
            injectLogLevelStyles();

            await checkForPersistedFilters();

            // OPTIMIZATION Phase 2: Check if we have persisted data
            const persistedFileName = await loadData('fileName');
            const hasPersistedData = persistedFileName && persistedFileName.value;

            if (hasPersistedData) {
                // Show skeleton while loading persisted data
                if (skeletonLoader) {
                    skeletonLoader.style.display = 'flex';
                    console.log('[Perf Phase2] Showing skeleton loader - loading persisted data...');
                }
            } else {
                if (skeletonLoader) skeletonLoader.style.display = 'none';
            }

            // Load persisted data in background
            const sessionRestored = await checkForPersistedLogs();

            if (!sessionRestored) {
                await applyFilters();
            }

            // Hide skeleton with fade out
            if (skeletonLoader && skeletonLoader.style.display !== 'none') {
                console.log('[Perf Phase2] Data loaded - hiding skeleton');
                skeletonLoader.classList.add('fade-out');
                setTimeout(() => {
                    skeletonLoader.style.display = 'none';
                    skeletonLoader.classList.remove('fade-out');
                }, 300);
            }

        } catch (error) {
            console.error("Fatal Error during app initialization:", error);
            // Hide skeleton on error
            if (skeletonLoader) {
                skeletonLoader.style.display = 'none';
            }
            alert("Could not initialize the application. Please try clearing your browser cache and reloading.");
        }
    }

    initializeApp();
});