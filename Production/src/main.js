// Import dependencies
import { escapeHtml } from './utils/html.js';
import { getColorForPid } from './ui/colors.js';
import { wildcardToRegex } from './utils/regex.js';
import { renderVirtualList } from './ui/components/VirtualList.js';
import './styles.css';
import noUiSlider from 'nouislider';
import 'nouislider/dist/nouislider.css';
// import * as XLSX from 'xlsx'; // REMOVED: Using global XLSX from xlsx-js-style CDN for styling support
import JSZip from 'jszip';
import { Chart, registerables } from 'chart.js';
import { makeTableResizable } from './table-resize.js';
import * as BtsnoopTab from './ui/tabs/BtsnoopTab.js';
import * as StatsTab from './ui/tabs/StatsTab.js';
import * as CccTab from './ui/tabs/CccTab.js';
import { setupDeviceEventsTab, renderDeviceEvents } from './ui/tabs/DeviceEventsTab.js';
import { setupBleKeysTab, renderBleKeys } from './ui/tabs/BleKeysTab.js';
import { filterConnectivityLogs } from './ui/tabs/ConnectivityTab.js';
import { makeSortable } from './table-sort.js';
import { formatParam } from './utils/html.js';
import * as FilterManager from './filters/FilterManager.js';
import * as ExportManager from './export/ExportManager.js';
import LogParserWorker from './infra/workers/logParser.worker.js?worker&inline'; // Inline for file:// support
import FilterWorker from './infra/workers/filter.worker.js?worker&inline'; // Inline for file:// support

// Register Chart.js components
Chart.register(...registerables);

// Expose globals for compatibility with existing code
window.noUiSlider = noUiSlider;
window.XLSX = XLSX;
window.JSZip = JSZip;
window.Chart = Chart;
window.CccTab = CccTab; // Expose for testing

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
    // --- Worker Setup ---
    // Initialize the filter worker (using inline class)
    const filterWorker = new FilterWorker();
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
    let bleKeysTable;
    let btsnoopFilterButtons;
    let appSearchInput;
    let btsnoopColumnFilters;
    let btsnoopLogContainer, btsnoopLogViewport;
    let btsnoopLogSizer;
    let btsnoopConnectionEventsTable;
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
    let cccMessages = []; // CCC messages extracted from log lines by filter workerfiles, with metadata
    // FIX: Promote finalBleKeys to global for access in render
    window.finalBleKeys = new Map();
    window.finalDashboardStats = null; // Store stats for re-rendering

    let consolidatedBatteryDataPoints = []; // Battery data points from all workers
    let consolidatedThermalDataPoints = []; // Thermal data points from all workers
    let filterKeywords = []; // Array of {text: string, active: boolean}
    let liveSearchQuery = ''; // For live filtering as the user types
    let currentZipFileName = ''; // To store the name of the loaded ZIP
    let isAndLogic = false; // Default to OR logic
    let activeLogLevels = new Set(['V', 'D', 'I', 'W', 'E', 'F', 'A', 'S']); // Default to all levels active
    let bleLogLines = []; // Holds all BLE-related log lines
    let filteredBleLogLines = []; // The currently filtered set of BLE lines
    let nfcLogLines = []; // Holds all NFC-related log lines
    let dckLogLines = []; // Holds all DCK-related log lines
    let btsnoopPackets = []; // Holds parsed btsnoop packets
    let btsnoopSortColumn = 1; // Revert to Timestamp column (Index 1)
    let btsnoopSortOrder = 'desc'; // Default: Descending (newest first)
    let btsnoopCollapsedFiles = new Set(); // Track collapsed files
    let tableSortState = {}; // Track sort state for all tables

    // --- Worker Setup ---
    // Increment this version when worker logic changes to force updates
    const workerVersion = 6;
    let worker;

    // NEW: Connectivity Tab Globals
    let connectivityLogLines = []; // Mapped/Merged lines for the connectivity view
    let filteredConnectivityLogLines = []; // The currently filtered set derived from connectivityLogLines
    let activeTechs = { ble: true, nfc: true, dck: true, uwb: true, wallet: true }; // Master Toggles State
    let uwbLogLines = []; // Holds all UWB-related log lines
    let walletLogLines = [];
    let filteredWalletLogLines = [];
    let filteredDckLogLines = [];
    let filteredNfcLogLines = [];

    let filteredBtsnoopPackets = []; // Holds the filtered set of btsnoop packets
    let btsnoopConnectionEvents = []; // Holds LE Connection Complete events
    let btsnoopConnectionMap = new Map(); // Maps connection handle to BT address

    let allAppVersions = []; // Holds all found app versions
    let filteredLogLines = []; // The currently filtered set of lines
    // Global state for standard table selection persistence (Table ID -> Selected Row ID)
    const selectedTableRows = new Map();
    window.selectedTableRows = selectedTableRows; // Expose for CccTab scroll restoration

    // OPTIMIZATION Phase 3: Cache BTSnoop row positions
    let btsnoopRowPositions = [];
    let btsnoopTotalHeight = 0;
    let fileTasks = []; // Holds all discovered file tasks for later processing (e.g., btsnoop)
    let logTags = []; // Unique list of tags for autocomplete
    let zipEntriesToProcess = []; // Temp storage for entries from a zip
    let lastCheckedIndex = -1; // For shift-click selection
    let activeBleLayers = new Set(['manager', 'gatt', 'smp', 'hci']); // Default to all layers active
    let activeNfcLayers = new Set(['framework', 'hce', 'p2p', 'hal']); // Default to all layers active
    let activeBtsnoopFilters = new Set(['cmd', 'evt', 'acl', 'l2cap', 'smp', 'att']); // Holds active btsnoop filter types (e.g. 'cmd', 'evt') - Default ALL active
    let filterVersion = 0; // "Cancellation token" for async filtering
    let isProcessing = false; // Flag to prevent race conditions during filtering
    let btsnoopColumnFilterDebounceTimer = null;
    let userAnchorLine = null; // The log line object the user has clicked to anchor
    let mainScrollThrottleTimer = null; // For throttling main log scroll events
    let bleScrollListenerAttached = false;
    let logViewCollapseState = new Set(); // For main logs tab
    let connectivityViewCollapseState = new Set(); // For CCC_Focus tab
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
    let btsnoopAnchorPacketNumber = null; // Track the packet number to restore scroll position
    let isProgrammaticBtsnoopScroll = false; // Flag to prevent clearing anchor during programmatic scrolls

    // --- OPTIMIZATION Phase 1: Filter State Tracking & Caching ---
    let filterStateHash = null;
    let cachedFilteredResults = {
        logs: null,
        connectivity: null,
        btsnoop: null
    };

    // --- OPTIMIZATION Phase 1: CCC Stats Memoization ---
    let cccStatsRenderedHTML = null;


    // --- OPTIMIZATION Phase 1: Debounced Save Timer ---
    let saveDebounceTimer = null;

    // --- OPTIMIZATION Phase 2: Lazy Loading State ---
    let tabsLoaded = {
        logs: true,      // Main logs always loaded
        connectivity: false,
        btsnoop: false,  // Load on first visit
        ccc: false,
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
                const activeKeywords = filterKeywords.filter(kw => kw.active).map(kw => kw.text);
                const keywordRegexes = activeKeywords.length > 0 ? activeKeywords.map(wildcardToRegex) : null;
                const liveSearchRegex = liveSearchQuery ? wildcardToRegex(liveSearchQuery) : null;

                renderVirtualList(logContainer, logSizer, logViewport, filteredLogLines, logViewCollapseState, {
                    keywordRegexes,
                    liveSearchRegex,
                    selectedLine: userAnchorLine
                });
                mainScrollThrottleTimer = null;
            }, 100); // OPTIMIZATION: Increased from 50ms to 100ms for better performance
        }
    }

    // --- CCC Hover Tooltip Logic ---
    const cccTooltip = document.createElement('div');
    cccTooltip.className = 'ccc-tooltip';
    document.body.appendChild(cccTooltip);

    function showTooltip(event, line, cccMsg) {
        // Fallback: If cccMsg is not passed (from property), try to find it in global array
        if (!cccMsg && line && line.lineNumber) {
            // console.log('[Tooltip] Fallback lookup for line:', line.lineNumber);
            // Use relaxed matching (timestamps match or within same line logic)
            cccMsg = cccMessages.find(m => m.lineNumber === line.lineNumber);
        }

        if (!cccMsg) {
            // console.log('[Tooltip] No CCC message found explicitly or via fallback.');
            hideTooltip();
            return;
        }

        // UX Improvement: If we are showing the custom UI, immediately remove native 'title' attributes 
        // from the hovered elements to prevent double-tooltips (native + custom).
        if (event.target) {
            // Remove from specific target if it has one
            if (event.target.hasAttribute('title')) event.target.removeAttribute('title');

            // Also clean up siblings/parents just in case the mouse is slightly offset or bubbling
            const lineEl = event.target.closest('.log-line');
            if (lineEl) {
                const titleEls = lineEl.querySelectorAll('[title]');
                titleEls.forEach(el => el.removeAttribute('title'));
            }
        }

        // Decode the payload if not already decoded
        let decoded = cccMsg._decoded;
        if (!decoded) {
            try {
                decoded = CccTab.decodePayload(cccMsg.type, cccMsg.subtype, cccMsg.payload);
                cccMsg._decoded = decoded; // Cache it
            } catch (err) {
                console.error('[Tooltip] Decode failed:', err);
                decoded = { innerMsg: "Error decoding", params: err.message };
            }
        }

        const categoryName = CccTab.CCC_CONSTANTS.MESSAGE_TYPES[cccMsg.type] || `Unknown (0x${cccMsg.type.toString(16).padStart(2, '0').toUpperCase()})`;
        let typeName = `Unknown`;
        if (cccMsg.type === 0x02) typeName = CccTab.CCC_CONSTANTS.UWB_RANGING_MSGS[cccMsg.subtype] || typeName;
        else if (cccMsg.type === 0x03) typeName = CccTab.CCC_CONSTANTS.DK_EVENT_CATEGORIES[cccMsg.subtype] || typeName;
        else if (cccMsg.type === 0x01 && CccTab.CCC_CONSTANTS.SE_MSGS && CccTab.CCC_CONSTANTS.SE_MSGS[cccMsg.subtype]) typeName = CccTab.CCC_CONSTANTS.SE_MSGS[cccMsg.subtype];
        else if (cccMsg.type === 0x05) typeName = CccTab.CCC_CONSTANTS.SUPPLEMENTARY_MSGS[cccMsg.subtype] || typeName;
        else if (cccMsg.type === 0x00 && CccTab.CCC_CONSTANTS.FRAMEWORK_MSGS && CccTab.CCC_CONSTANTS.FRAMEWORK_MSGS[cccMsg.subtype]) typeName = CccTab.CCC_CONSTANTS.FRAMEWORK_MSGS[cccMsg.subtype];

        const innerMessage = decoded.innerMsg || "-";

        // Clean up params HTML for tooltip (remove nested divs if needed, or style them)
        // The decodePayload returns HTML with .tlv-block classes. We can use them directly if styles allow.
        const paramsHtml = decoded.params || "No parameters";

        cccTooltip.innerHTML = `
            <div class="ccc-tooltip-header">CCC Packet Details</div>
            <div class="ccc-tooltip-row"><span class="ccc-tooltip-label">Category:</span><span class="ccc-tooltip-value">${categoryName}</span></div>
            <div class="ccc-tooltip-row"><span class="ccc-tooltip-label">Type:</span><span class="ccc-tooltip-value">${typeName}</span></div>
            <div class="ccc-tooltip-row"><span class="ccc-tooltip-label">Message:</span><span class="ccc-tooltip-value">${innerMessage}</span></div>
            <div class="ccc-tooltip-row" style="flex-direction: column;">
                <span class="ccc-tooltip-label" style="margin-bottom: 2px;">Parameters:</span>
                <span class="ccc-tooltip-value" style="font-size: 0.85em;">${paramsHtml}</span>
            </div>
        `;

        cccTooltip.style.display = 'block';
        moveTooltip(event);
    }

    function moveTooltip(event) {
        const x = event.clientX + 15;
        const y = event.clientY + 15;

        // Boundary checks
        const rect = cccTooltip.getBoundingClientRect();
        let finalX = x;
        let finalY = y;

        if (x + rect.width > window.innerWidth) {
            finalX = event.clientX - rect.width - 10;
        }
        if (y + rect.height > window.innerHeight) {
            finalY = event.clientY - rect.height - 10;
        }

        cccTooltip.style.left = `${finalX}px`;
        cccTooltip.style.top = `${finalY}px`;
    }

    function hideTooltip() {
        cccTooltip.style.display = 'none';
    }

    // Event Delegation for Tooltip
    if (logContainer) {
        logContainer.addEventListener('mouseover', (e) => {
            const lineEl = e.target.closest('.log-line');
            if (lineEl) {
                const index = parseInt(lineEl.dataset.lineIndex, 10);
                if (!isNaN(index) && filteredLogLines[index]) {
                    const line = filteredLogLines[index];
                    showTooltip(e, line, line.cccMessage);
                }
            } else {
                hideTooltip();
            }
        });

        logContainer.addEventListener('mousemove', (e) => {
            if (cccTooltip.style.display === 'block') {
                moveTooltip(e);
            }
        });

        logContainer.addEventListener('mouseout', (e) => {
            // Only hide if we left the log line or the container
            // Actually, mouseover on another element will trigger checks.
            // If we move out of a CCC line to a non-CCC line, the mouseover listener above will hide it.
            // But if we move out of the container completely:
            if (!e.relatedTarget || !logContainer.contains(e.relatedTarget)) {
                hideTooltip();
            }
        });
    }




    // --- Enable Tooltip for Connectivity Tab (CCC Focus) ---
    // The connectivity tab uses a separate viewport: connectivityLogViewport
    // We need to attach listeners there as well.
    // However, connectivityLogViewport might not be in the DOM yet or defined at this scope.
    // We should attach it dynamically or use document-level delegation if possible, but localized is better.
    // Let's hook into setupConnectivityTab or just poll for it/attach if it exists.
    // Since main.js runs after DOMContentLoaded, we can try finding it.

    const connectivityContainer = document.getElementById('connectivityLogContainer');
    if (connectivityContainer) {
        connectivityContainer.addEventListener('mouseover', (e) => {
            const lineEl = e.target.closest('.log-line');
            if (lineEl) {
                const index = parseInt(lineEl.dataset.lineIndex, 10);
                // Note: Connectivity tab uses filteredConnectivityLogLines
                if (!isNaN(index) && filteredConnectivityLogLines[index]) {
                    const line = filteredConnectivityLogLines[index];
                    showTooltip(e, line, line.cccMessage);
                }
            } else {
                hideTooltip();
            }
        });

        connectivityContainer.addEventListener('mousemove', (e) => {
            if (cccTooltip.style.display === 'block') {
                moveTooltip(e);
            }
        });

        connectivityContainer.addEventListener('mouseout', (e) => {
            if (!e.relatedTarget || !connectivityContainer.contains(e.relatedTarget)) {
                hideTooltip();
            }
        });
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
                        rule.style.marginLeft = `- ${panelWidth} px`;
                        return;
                    }
                }
            } catch (e) {
                // Ignore CORS errors on external stylesheets
            }
        }
    }

    // =================================================================================
    // --- Helper Functions ---
    // =================================================================================

    /**
     * Helper to get dashboard elements for StatsTab
     * @returns {Object} Object containing dashboard DOM element references
     */
    function getDashboardElements() {
        return {
            cpuLoadStats: document.getElementById('cpuLoadStats'),
            temperatureStats: document.getElementById('temperatureStats'),
            batteryStats: document.getElementById('batteryStats'),
            cpuLoadPlotContainer: document.getElementById('cpuLoadPlotContainer'),
            batteryPlotContainer: document.getElementById('batteryPlotContainer')
        };
    }

    // =================================================================================
    // --- Style Injection for Log Levels ---
    // =================================================================================
    // Inject CSS for log level colors directly, as we can't edit the CSS file.
    function injectLogLevelStyles() {
        const style = document.createElement('style');
        style.textContent = `
        /* --- Android Studio Font --- */
        .log - line, .btsnoop - table {
        font - family: 'JetBrains Mono', 'Consolas', 'Menlo', 'Courier New', monospace;
        font - size: 13px;
    }
            /* FIX: Make the log line a flex container to prevent overlap */
            .log - line {
        display: flex;
        align - items: center;
        padding: 2px 5px;
        border - bottom: 1px solid #333;
        cursor: pointer;
        min - height: ${LINE_HEIGHT} px;
        box - sizing: border - box;
    }

    /* BTSnoop rows need absolute positioning for virtual scrolling */
    #btsnoopLogViewport.log - line {
        position: absolute;
        top: 0;
        left: 0;
        width: 100 %;
    }
            
            .log - line:hover {
        background - color: #444;
    }
            /* Adjusted Text Colors for Dark Mode Visibility */
            .log - line - E { color: #FF5252; } /* Red 400 */
            .log - line - W { color: #FFD740; } /* Amber A200 */
            .log - line - I { color: #69F0AE; } /* Green A200 */
            .log - line - D { color: #448AFF; } /* Blue A200 */

            /* Line numbers - fixed width to prevent misalignment */
            .line - number {
        display: inline - block;
        width: 60px;
        text - align: right;
        padding - right: 10px;
        color: #888;
        flex - shrink: 0;
        font - size: 11px;
    }

    /* --- Table-based Layout for BTSnoop --- */
    #btsnoopContentView {
        display: flex;
        flex - direction: column;
        height: 100 %;
    }
            /* --- Log Level Background Boxes --- */
            .log - level - box {
        display: inline - block;
        padding: 0 5px;
        margin: 0 5px;
        border - radius: 3px;
        color: #FFFFFF; /* White text by default */
        font - weight: bold;
        flex - shrink: 0; /* Don't shrink */
        width: 20px; /* Fixed width for alignment */
        text - align: center;
    }
            .log - level - box.log - level - E { background - color: #D32F2F; }
            .log - level - box.log - level - W { background - color: #FFC107; color: #000000; } /* Black text on Amber */
            .log - level - box.log - level - I { background - color: #388E3C; }
            .log - level - box.log - level - D { background - color: #1976D2; }
            .log - level - box.log - level - V { background - color: #757575; }

            /* --- Android Studio Style Log Lines --- */
            .log - line - content {
        display: flex;
        flex - direction: row;
        white - space: nowrap;
    }
            .log - meta {
        flex: 0 0 160px; /* Do not grow, do not shrink, base width 160px */
        white - space: nowrap;
    }
            .log - pid - tid {
        flex: 0 0 100px; /* Fixed width for PID-TID */
        white - space: nowrap;
        overflow: hidden;
        text - overflow: ellipsis;
    }
            .log - tag {
        flex: 0 0 180px; /* Fixed width for the tag */
        white - space: nowrap;
        overflow: hidden;
        text - overflow: ellipsis;
        color: #E0E0E0;
    }
            .log - message {
        flex - grow: 1; /* Take up remaining space */
        white - space: nowrap;
    }

            /* --- Enable horizontal scrolling for all log containers --- */
            .log - container {
        overflow - x: auto; /* This was correct */
        overflow - y: auto;
    }

    #btsnoopContentView {
        display: flex;
        flex - direction: column;
        height: 100 %;
    }
            .btsnoop - table { /* A single class for both header and body tables */
        width: 100 %;
        min - width: 1200px; /* Ensure table is wide enough to trigger horizontal scroll */
        table - layout: auto; /* FIX: Allow table to expand with content, enabling horizontal scroll */
        border - collapse: collapse;
    }

    /* NOTE: #btsnoopLogContainer, #btsnoopLogSizer, and #btsnoopLogViewport styles
       have been moved to styles.css to avoid conflicts with top: 70px offset */

            /* BTSnoop row styling */
            .btsnoop - row {
        display: block;
        padding: 0;
        border - bottom: 1px solid #444;
    }
            
            .btsnoop - row table {
        width: 100 %;
        min - width: 1200px; /* Match header table min-width */
        margin: 0;
        border - spacing: 0;
    }

    #btsnoopHeaderTable th {
        background - color: #f2f2f2;
        font - weight: bold;
        text - align: left;
        border - bottom: 2px solid #ccc;
    }
            .btsnoop - table th, .btsnoop - table td, .btsnoop - table.log - line - cell {
        padding: 2px 5px;
        overflow: hidden;
        box - sizing: border - box;
        vertical - align: top;
        white - space: nowrap; /* Keep content on one line */
        text - overflow: ellipsis; /* Truncate with ... */
    }
            /* Define column widths for both header and body */
            .btsnoop - table col: nth - child(1) { width: 60px; }
            .btsnoop - table col: nth - child(2) { width: 120px; }
            .btsnoop - table col: nth - child(3) { width: 160px; }
            .btsnoop - table col: nth - child(4) { width: 160px; }
            .btsnoop - table col: nth - child(5) { width: 80px; }
            .btsnoop - table col: nth - child(6) { width: 40 %; } /* Summary */
            .btsnoop - table col: nth - child(7) { width: 60 %; } /* Data */

            /* --- Fixes for Final Table Layout --- */
            .btsnoop - row {
        position: absolute; /* Required for virtual scrolling */
        left: 0;
        right: 0;
        height: ${LINE_HEIGHT} px; /* Fixed height is crucial for virtual scrolling performance */
        background - color: #2C2C2C; /* Dark background for rows */
    }
            .btsnoop - row: nth - child(even) {
        background - color: #343434; /* Slightly lighter for even rows */
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
            collapsedLogs: Array.from(logViewCollapseState).sort(),
            collapsedConnectivity: Array.from(connectivityViewCollapseState).sort()
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
                console.log(`[Perf] Saved ${key} to IndexedDB(non - blocking)`);
            } catch (error) {
                console.error(`[Perf] Failed to save ${key}: `, error);
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
                        return tagLower.includes('bluetooth') || tagLower.includes('ble') ||
                            tagLower.includes('bt_') || tagLower.includes('btm_');
                    });
                    // Filter NFC
                    nfcLogLines = originalLogLines.filter(line => {
                        if (line.isMeta) return true;
                        if (!line.tag) return false;
                        const tagLower = line.tag.toLowerCase();
                        return tagLower.includes('nfc') || tagLower.includes('nci') || tagLower.includes('hal');
                    });
                    // Filter DCK (Digital Key only)
                    // Filter DCK (Digital Key only)
                    // FIX: Rely on the worker's regex (isDck flag) which covers 'Dck', 'DigitalCarKey', etc.
                    dckLogLines = originalLogLines.filter(line => line.isMeta || line.isDck);

                    // Filter UWB & Nearby
                    uwbLogLines = originalLogLines.filter(line => {
                        if (line.isMeta) return true;
                        if (!line.tag) return false;
                        const tagLower = line.tag.toLowerCase();
                        return tagLower.includes('uwb') || tagLower.includes('ranging') ||
                            tagLower.includes('fiira') || tagLower.includes('nearby');
                    });

                    // Filter Wallet
                    walletLogLines = originalLogLines.filter(line => {
                        if (line.isMeta) return true;
                        if (line.isWallet) return true;
                        // Fallback to text check if isWallet not set (e.g. legacy worker)
                        if (!line.originalText) return false;
                        const text = line.originalText.toLowerCase();
                        return text.includes('wallet') || text.includes('quickaccesswallet') || text.includes('walletservice');
                    });

                    // Trigger initial setup for connectivity
                    if (!connectivityScrollListenerAttached) {
                        setupConnectivityTab();
                    } else {
                        applyConnectivityFilters();
                    }
                    break;

                case 'btsnoop':
                    // Only process if not already done.
                    if (!isBtsnoopProcessed) {
                        await processForBtsnoop();
                    }
                    console.log(`[Perf Phase2]BTSnoop tab loaded.Total packets: ${btsnoopPackets.length}`);
                    break;

                case 'ccc':
                    // CCC Analysis is handled by setupCccTab which is called in refreshActiveTab
                    console.log(`[Perf Phase2]${tabId} tab ready(init deferred to setupCccTab)`);
                    break;

                case 'stats':
                    console.log(`[Perf Phase2]Processing stats...`);

                    // Calculate log level statistics
                    const logStats = { total: 0, E: 0, W: 0, I: 0, D: 0, V: 0 };
                    for (const line of originalLogLines) {
                        if (line.isMeta) continue;
                        logStats.total++;
                        if (line.level && logStats[line.level] !== undefined) {
                            logStats[line.level]++;
                        }
                    }

                    // Render log level statistics and distribution chart
                    StatsTab.renderStats(logStats);

                    // Calculate and render dashboard stats (CPU, temp, battery)
                    const dashboardStats = StatsTab.processForDashboardStats(originalLogLines, consolidatedBatteryDataPoints);
                    console.log('[Perf Phase2] Lazy loading stats tab...');
                    const statsStart = performance.now();

                    // Process BTSnoop if needed (Stats tab shows BTSnoop Connection Events)
                    console.log('[Stats Debug] isBtsnoopProcessed:', isBtsnoopProcessed);
                    console.log('[Stats Debug] fileTasks.length:', fileTasks.length);
                    const btsnoopTasks = fileTasks.filter(task => task.path && task.path.includes('btsnoop_hci.log'));
                    console.log('[Stats Debug] BTSnoop tasks found:', btsnoopTasks.length);

                    if (!isBtsnoopProcessed && btsnoopTasks.length > 0) {
                        console.log('[Stats] Processing BTSnoop data for Connection Events table...');
                        await processForBtsnoop();
                    } else {
                        console.log('[Stats] Skipping BTSnoop processing. Processed:', isBtsnoopProcessed, 'Tasks:', btsnoopTasks.length);
                    }


                    await StatsTab.setupStatsTab(originalLogLines, getDashboardElements(), consolidatedBatteryDataPoints);
                    console.log(`[Perf Phase2]stats tab loaded in ${(performance.now() - statsStart).toFixed(2)}ms`);
                    break;
            }

            const duration = performance.now() - startTime;
            console.log(`[Perf Phase2]${tabId} tab loaded in ${duration.toFixed(2)}ms`);

            // Set loaded flag AFTER processing to avoid race conditions.
            tabsLoaded[tabId] = true;

        } catch (error) {
            console.error(`[Perf Phase2]Failed to lazy load ${tabId} tab: `, error);
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
    }
    if (fileChoice) {
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

                StatsTab.renderStats(finalStats);
                storedHighlights = finalHighlights; // Store highlights
                renderHighlights(finalHighlights);
                const dashboardStats = StatsTab.processForDashboardStats(originalLogLines, consolidatedBatteryDataPoints);
                StatsTab.renderDashboardStats(dashboardStats, { cpuLoadStats, temperatureStats, batteryStats });
                StatsTab.renderCpuPlot(dashboardStats.cpuDataPoints, cpuLoadPlotContainer);

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
        const deviceEventsTableEl = document.getElementById('deviceEventsTable');
        deviceEventsTable = deviceEventsTableEl ? deviceEventsTableEl.getElementsByTagName('tbody')[0] : null;
        cpuLoadStats = document.getElementById('cpuLoadStats');
        cpuLoadPlotContainer = document.getElementById('cpuLoadPlotContainer');
        const appVersionsTableEl = document.getElementById('appVersionsTable');
        appVersionsTable = appVersionsTableEl ? appVersionsTableEl.getElementsByTagName('tbody')[0] : null;
        appSearchInput = document.getElementById('appSearchInput');
        temperatureStats = document.getElementById('temperatureStats');
        batteryStats = document.getElementById('batteryStats');
        batteryPlotContainer = document.getElementById('batteryPlotContainer');

        btsnoopLogContainer = document.getElementById('btsnoopLogContainer');
        btsnoopLogSizer = document.getElementById('btsnoopLogSizer');
        const btsnoopConnectionEventsTableEl = document.getElementById('btsnoopConnectionEventsTable');
        btsnoopConnectionEventsTable = btsnoopConnectionEventsTableEl ? btsnoopConnectionEventsTableEl.getElementsByTagName('tbody')[0] : null;
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

        // OPTIMIZATION: Attach global interaction handler (Selection, Copy) to Body
        // This ensures it catches events from Log Viewports AND Standard Tables (CCC, Stats, etc.)
        document.body.addEventListener('click', handleViewportInteraction);

        const connectivityLogViewport = document.getElementById('connectivityLogViewport');
        /* Viewport specific listeners removed in favor of global body delegation */
        if (appSearchInput) appSearchInput.addEventListener('input', () => StatsTab.renderAppVersions(allAppVersions, appVersionsTable, appSearchInput));

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
        if (exportLogsBtn) exportLogsBtn.addEventListener('click', () => handleExport(filteredLogLines, 'filtered_logs.xlsx'));

        const exportBtsnoopXlsxBtn = document.getElementById('exportBtsnoopXlsxBtn');
        if (exportBtsnoopXlsxBtn) {
            // FIX: Attach the event listener for the Excel export button.
            exportBtsnoopXlsxBtn.addEventListener('click', () => BtsnoopTab.exportBtsnoopToXlsx());
        }


        const exportConnectivityBtn = document.getElementById('exportConnectivityBtn');
        if (exportConnectivityBtn) exportConnectivityBtn.addEventListener('click', () => handleExport(filteredConnectivityLogLines, 'connectivity_logs.xlsx'));

        const exportAnalyticsBtn = document.getElementById('exportStatsBtn');
        if (exportAnalyticsBtn) {
            exportAnalyticsBtn.addEventListener('click', () => exportStatsToExcel());
        }

        // Collapse/Expand All Files Button
        const collapseAllBtn = document.getElementById('collapseAllBtn');
        if (collapseAllBtn) {
            collapseAllBtn.addEventListener('click', () => {
                // Get all file headers from originalLogLines
                const fileHeaders = originalLogLines.filter(line => line.isMeta);

                if (fileHeaders.length === 0) return;

                // Check if all are collapsed or not
                const allCollapsed = fileHeaders.every(header => logViewCollapseState.has(header.originalText));

                if (allCollapsed) {
                    // Expand all
                    logViewCollapseState.clear();
                    collapseAllBtn.textContent = '⊟'; // Square minus symbol
                    collapseAllBtn.title = 'Collapse All Files';
                } else {
                    // Collapse all
                    logViewCollapseState.clear();
                    fileHeaders.forEach(header => logViewCollapseState.add(header.originalText));
                    collapseAllBtn.textContent = '⊞'; // Square plus symbol
                    collapseAllBtn.title = 'Expand All Files';
                }

                // Refresh the view
                refreshActiveTab();
            });
        }

        // Sort by Size Button
        const sortBySizeBtn = document.getElementById('sortBySizeBtn');
        let sortDescending = false; // Initial click will sort Ascending (Smallest First) since files are usually Descending
        if (sortBySizeBtn) {
            sortBySizeBtn.addEventListener('click', () => {
                console.log('[Sort Debug] Button clicked, originalLogLines.length:', originalLogLines.length);
                if (originalLogLines.length === 0) {
                    console.log('[Sort Debug] No log lines to sort');
                    return;
                }
                // Apply active filters
                // (Logic removed: Irrelevant BTSnoop filtering block was here)
                // Group lines by file (using isMeta headers as delimiters)
                const fileSections = [];
                let currentSection = null;

                for (const line of originalLogLines) {
                    if (line.isMeta) {
                        // Start a new section
                        if (currentSection) {
                            fileSections.push(currentSection);
                        }
                        currentSection = {
                            header: line,
                            lines: []
                        };
                    } else if (currentSection) {
                        currentSection.lines.push(line);
                    }
                }

                // Push the last section
                if (currentSection) {
                    fileSections.push(currentSection);
                }

                console.log('[Sort Debug] Found', fileSections.length, 'file sections');
                if (fileSections.length === 0) {
                    console.log('[Sort Debug] No file sections found - no isMeta headers');
                    return;
                }

                // Sort sections by line count - toggle between descending and ascending
                if (sortDescending) {
                    fileSections.sort((a, b) => b.lines.length - a.lines.length); // Largest first
                } else {
                    fileSections.sort((a, b) => a.lines.length - b.lines.length); // Smallest first
                }
                sortDescending = !sortDescending; // Toggle for next click

                // Rebuild originalLogLines with sorted sections
                // Use loop instead of spread operator to avoid stack overflow with large arrays
                const newLogLines = [];
                for (const section of fileSections) {
                    newLogLines.push(section.header);
                    for (const line of section.lines) {
                        newLogLines.push(line);
                    }
                }
                originalLogLines = newLogLines;

                // Reassign indices
                for (let i = 0; i < originalLogLines.length; i++) {
                    originalLogLines[i].index = i;
                }

                // Invalidate cache to force re-render
                cachedFilteredResults['logs'] = null;
                filteredLogLines = [];

                // Refresh the view
                console.log(`[Sort] Sorted by size: ${sortDescending ? 'will sort descending next' : 'will sort ascending next'}`);
                refreshActiveTab();
            });
        }

    }

    // New Function: Export Stats Tab to Multi-sheet Excel
    // Export Stats Tab to Multi-sheet Excel (using ExportManager)
    // Export Stats Tab to Multi-sheet Excel (using ExportManager)
    function exportStatsToExcel() {
        try {
            // FIX: Filter logs based on selected time range
            let exportLogs = originalLogLines;
            if (startTimeInput.value && endTimeInput.value) {
                const start = new Date(startTimeInput.value).getTime();
                const end = new Date(endTimeInput.value).getTime();
                if (!isNaN(start) && !isNaN(end)) {
                    exportLogs = originalLogLines.filter(line => {
                        const t = new Date(line.timestamp).getTime();
                        return t >= start && t <= end;
                    });
                    console.log(`[Export] Filtering by time: ${new Date(start).toLocaleString()} - ${new Date(end).toLocaleString()} (${exportLogs.length} lines)`);
                }
            }

            ExportManager.exportStatsToExcel({
                logLines: exportLogs,
                minLogDate: minLogDate,
                maxLogDate: maxLogDate,
                filename: 'android_log_stats.xlsx'
            });
        } catch (error) {
            alert('Export failed: ' + error.message);
            console.error('Export error:', error);
        }
    }

    // Helper for summary stats (simplified re-implementation)
    // Use ExportManager's calculateLogLevels
    function calculateLogLevels(lines) {
        return ExportManager.calculateLogLevels(lines);
    }


    async function clearPreviousState(clearStorage = false) {
        // Invalidate any currently running filter operations
        filterVersion++;

        // Clear all log arrays - set to null first to help GC
        originalLogLines = null;
        filteredLogLines = null;
        bleLogLines = null;
        nfcLogLines = null;
        dckLogLines = null;
        uwbLogLines = null;
        walletLogLines = null;
        filteredWalletLogLines = null;
        connectivityLogLines = null;
        filteredConnectivityLogLines = null;
        filteredBleLogLines = null;
        filteredNfcLogLines = null;
        filteredDckLogLines = null;
        btsnoopPackets = null;
        filteredBtsnoopPackets = null;
        btsnoopConnectionEvents = null;
        cccMessages = null;
        if (window.finalBleKeys) window.finalBleKeys.clear();


        // Now reinitialize as empty arrays
        originalLogLines = [];
        filteredLogLines = [];
        bleLogLines = [];
        nfcLogLines = [];
        dckLogLines = [];
        uwbLogLines = [];
        walletLogLines = [];
        filteredWalletLogLines = [];
        connectivityLogLines = [];
        filteredConnectivityLogLines = [];
        filteredBleLogLines = [];
        filteredNfcLogLines = [];
        filteredDckLogLines = [];
        btsnoopPackets = [];
        filteredBtsnoopPackets = [];
        btsnoopConnectionEvents = [];
        cccMessages = [];


        // Clear other data structures
        // FIX: Preserve keywords? User likely wants them.
        // If we want to clear them, we should do it explicitly via a "Reset" button.
        // For now, let's PRESERVE them.
        // filterKeywords = []; 
        logTags = [];
        allAppVersions = [];
        fileTasks = [];

        // Clear search and filters
        // FIX: Preserve live search too
        // liveSearchQuery = '';
        // searchInput.value = '';

        // Clear time filters
        startTimeInput.value = '';
        endTimeInput.value = '';
        isTimeFilterActive = false;
        if (timeRangeSlider && timeRangeSlider.noUiSlider) {
            timeRangeSlider.noUiSlider.destroy();
            document.getElementById('timeRangeSliderContainer').style.display = 'none';
        }

        // Reset log levels to default (all active)
        // FIX: Do NOT reset log levels on file reload. User wants persistence.
        // Only reset if we are explicitly resetting the app (which might need a different flag or explicit call)
        // For 'clearPreviousState(true)' which is file load, we preserve filters.
        if (!activeLogLevels || activeLogLevels.size === 0) {
            activeLogLevels = new Set(['V', 'D', 'I', 'W', 'E', 'F', 'A', 'S']);
            logLevelButtons.forEach(btn => btn.classList.add('active'));
        }
        // Else: keep existing activeLogLevels and button states.

        // Clear maps and sets
        logViewCollapseState.clear();
        connectivityViewCollapseState.clear();
        if (typeof btsnoopConnectionMap !== 'undefined') {
            btsnoopConnectionMap.clear();
        }
        btsnoopConnectionMap = new Map();
        activeBtsnoopFilters = new Set(['cmd', 'evt', 'acl', 'l2cap', 'smp', 'att']);

        // Reset Filter Hashing & Caching
        filterStateHash = null;
        cachedFilteredResults = {
            logs: null,
            connectivity: null,
            btsnoop: null,
            ccc: null,
            stats: null
        };

        // Reset CCC Tab State
        CccTab.reset();

        // Reset state flags
        localBtAddress = 'Host';
        isBtsnoopProcessed = false;
        userAnchorLine = null;

        // Clear UI tables
        if (bleKeysTable) bleKeysTable.innerHTML = '';
        if (appVersionsTable) appVersionsTable.innerHTML = '';
        if (accountsList) accountsList.innerHTML = '';
        if (deviceEventsTable) deviceEventsTable.innerHTML = '';

        // Clear filter chips
        renderFilterChips();

        // Clear connectivity state
        activeTechs = { ble: true, nfc: true, dck: true, uwb: true, wallet: true };

        // Clear log view
        logViewport.innerHTML = '';
        logSizer.style.height = '0px';

        // Clear connectivity view if it exists
        const connectivityViewport = document.getElementById('connectivityLogViewport');
        const connectivitySizer = document.getElementById('connectivityLogSizer');
        if (connectivityViewport) connectivityViewport.innerHTML = '';
        if (connectivitySizer) connectivitySizer.style.height = '0px';

        // Reset lazy loading flags
        tabsLoaded = {
            logs: true,
            connectivity: false,
            btsnoop: false,
            ccc: false,
            stats: false
        };

        // Clear IndexedDB if requested
        if (clearStorage && db) {
            await clearData();
        }

        // Give browser a moment to process cleanup
        await new Promise(resolve => setTimeout(resolve, 100));
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
                zipEntry.async('blob').then(blob => fileTasks.push({ blob, path: fullPath, size: blob.size }))
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
}; `;
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
                fileTasks.push({ file, path, size: file.size });
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
        // They will be handled separately
        // Sort tasks by size (largest first) so bigger files appear first in the view
        const tasksToParse = fileTasks
            .filter(task => !task.path.includes('btsnoop_hci.log'))
            .sort((a, b) => (b.size || 0) - (a.size || 0));
        // Use the dedicated parser worker file
        // Note: We use a loop to create multiple workers below

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

                    // Aggregate CCC messages from this file
                    if (data.cccMessages && data.cccMessages.length > 0) {
                        cccMessages.push(...data.cccMessages);
                        console.log(`[CCC] Extracted ${data.cccMessages.length} CCC messages from ${data.filePath}`);
                    }

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
                    }
                }
            };

            for (let i = 0; i < maxWorkers; i++) {
                const worker = new LogParserWorker(); // Use Vite worker import
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
        TimeTracker.start('Result Consolidation');

        // Create a lookup map for performance
        const fileSizeMap = new Map(fileTasks.map(task => [task.path, task.size || 0]));

        // FIX: Sort results by original file size (largest first) to ensure consistent display order,
        // as worker results may arrive out of order.
        allResults.sort((a, b) => {
            const sizeA = fileSizeMap.get(a.filePath) || 0;
            const sizeB = fileSizeMap.get(b.filePath) || 0;
            return sizeB - sizeA;
        });

        originalLogLines = [];
        // Ensure CCC messages are reset before re-populating if we are re-processing files (though processFiles usually clears state first)
        // But if multiple calls happen, we want to be safe.
        // Actually, cccMessages is global. It accumulates across files in the loop.
        // We should clear it at the START of processFiles, which calls clearPreviousState.
        // But here we are just merging results.

        const consolidatedTagSet = new Set(); // Use a new set for consolidation
        let consolidatedMinTimestamp, consolidatedMaxTimestamp;
        const finalServices = {};
        const finalHighlights = { accounts: new Set(), deviceEvents: [], walletEvents: [] };
        const finalStats = { total: 0, E: 0, W: 0, I: 0, D: 0, V: 0 };
        // finalBleKeys is now global window.finalBleKeys
        window.finalBleKeys.clear(); // Reset for new processing
        let finalLocalBtAddress = null;
        const consolidatedAppVersions = new Map();
        // Reset battery data points for new file load
        // Reset battery data points for new file load
        consolidatedBatteryDataPoints = [];
        consolidatedThermalDataPoints = [];


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

                const fileUwbLogs = result.parsedLines.filter(l => l.isDck); // Re-using DCK/UWB classification for now as they are grouped
                if (fileUwbLogs.length > 0) {
                    if (fileHeader) uwbLogLines.push(fileHeader);
                    for (const line of fileUwbLogs) uwbLogLines.push(line);
                }

                const fileWalletLogs = result.parsedLines.filter(l => l.isWallet);
                if (fileWalletLogs.length > 0) {
                    if (fileHeader) walletLogLines.push(fileHeader);
                    for (const line of fileWalletLogs) walletLogLines.push(line);
                }



                let currentIndex = originalLogLines.length;

                // FIX: Map CCC messages to lines for tooltip hover
                if (result.cccMessages && result.cccMessages.length > 0) {
                    const lineMap = new Map();
                    // Create a lookup for lines in THIS file chunk/result by lineNumber
                    result.parsedLines.forEach(l => lineMap.set(l.lineNumber, l));

                    let mappedCount = 0;
                    result.cccMessages.forEach(cccMsg => {
                        if (cccMsg.lineNumber) {
                            const line = lineMap.get(cccMsg.lineNumber);
                            if (line) {
                                line.cccMessage = cccMsg;
                                mappedCount++;
                            } else {
                                if (mappedCount === 0) console.warn('[CCC Debug] Failed to find line for CCC msg at line:', cccMsg.lineNumber);
                            }
                        }
                    });
                    console.log(`[Main] Mapped ${mappedCount} / ${result.cccMessages.length} CCC messages. (Sample Line # from Map: ${result.parsedLines[0]?.lineNumber})`);
                }

                for (const line of result.parsedLines) {
                    line.index = currentIndex++; // Assign global index immediately
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
                        window.finalBleKeys.set(addr, keyInfo);
                    });
                }

                // Consolidate battery data from worker
                if (result.batteryDataPoints) {
                    // FIX: Use push with spread syntax to avoid creating new large arrays.
                    for (const point of result.batteryDataPoints) {
                        consolidatedBatteryDataPoints.push(point);
                    }
                }

                // Consolidate thermal data from worker
                if (result.thermalDataPoints) {
                    for (const point of result.thermalDataPoints) {
                        consolidatedThermalDataPoints.push(point);
                    }
                }

            }
        }
        allAppVersions = Array.from(consolidatedAppVersions).sort((a, b) => a[0].localeCompare(b[0]));

        // Set the global local address if it was found
        if (finalLocalBtAddress) {
            localBtAddress = finalLocalBtAddress;
        }

        TimeTracker.stop('Result Consolidation');

        // Re-assign indices after sorting to ensure they are sequential
        for (let i = 0; i < originalLogLines.length; i++) {
            originalLogLines[i].index = i;
        }

        // OPTIMIZATION Phase 3: Sync data to filter worker
        syncDataToWorker(originalLogLines);

        // OPTIMIZATION: Use debounced save to prevent blocking UI
        debouncedSave('logData', originalLogLines);
        debouncedSave('fileName', currentZipFileName);

        // --- Finalize UI ---
        console.log('[Time Range Debug] consolidatedMinTimestamp:', consolidatedMinTimestamp);
        console.log('[Time Range Debug] consolidatedMaxTimestamp:', consolidatedMaxTimestamp);
        minLogDate = consolidatedMinTimestamp ? logcatToDate(consolidatedMinTimestamp) : null;
        maxLogDate = consolidatedMaxTimestamp ? logcatToDate(consolidatedMaxTimestamp) : null;
        console.log('[Time Range Debug] minLogDate:', minLogDate);
        console.log('[Time Range Debug] maxLogDate:', maxLogDate);
        logTags = Array.from(consolidatedTagSet).sort();
        initializeTimeFilter(consolidatedMinTimestamp, consolidatedMaxTimestamp);

        // Render the stats and highlights that were calculated by the workers
        StatsTab.renderStats(finalStats);
        storedHighlights = finalHighlights; // Store highlights
        renderHighlights(finalHighlights);

        // Process and render secondary dashboard stats like CPU, Temp, and App Versions
        const dashboardStats = StatsTab.processForDashboardStats(originalLogLines, consolidatedBatteryDataPoints);
        // FIX: Store for re-rendering
        window.finalDashboardStats = dashboardStats;
        // Also attach battery points to the stats object for convenience
        window.finalDashboardStats.batteryStatsPoints = consolidatedBatteryDataPoints;

        StatsTab.renderDashboardStats(dashboardStats, { cpuLoadStats, temperatureStats, batteryStats });
        StatsTab.renderAppVersions(allAppVersions, appVersionsTable, appSearchInput);
        makeTableResizable('appVersionsTable'); // FIX: Enable resize on this table
        StatsTab.renderTemperaturePlot(dashboardStats.temperatureDataPoints, document.getElementById('temperaturePlotContainer'));
        StatsTab.renderCpuPlot(dashboardStats.cpuDataPoints, cpuLoadPlotContainer);
        StatsTab.renderBatteryPlot(consolidatedBatteryDataPoints, batteryPlotContainer);


        // Reset the processing flag BEFORE refreshing the active tab,
        // otherwise applyFilters (called by refreshActiveTab) will abort.
        isProcessing = false;

        // Refresh the currently active tab. This ensures that the user is on
        // 'btsnoop' or 'connectivity' tabs, they find the data ready (e.g., lazy loading triggered).
        // This replaces the hardcoded applyFilters(true).
        await refreshActiveTab();

        // --- Background Processing ---
        // Automatically start heavy decoding tasks (like BTSnoop and CCC pre-processing)
        // after the main UI is ready. This fulfills the requirement for "decode ble" in background.
        setTimeout(async () => {
            console.log('[Background] Starting background processing for BTSnoop/CCC...');
            if (!isBtsnoopProcessed) {
                await processForBtsnoop();
            }

            // Pre-calculate CCC Stats in background
            if (cccMessages && cccMessages.length > 0 && !tabsLoaded.ccc) {
                console.log('[Background] Pre-calculating CCC stats...');
                await CccTab.setup(cccMessages, btsnoopConnectionMap, processForBtsnoop, isBtsnoopProcessed);
                // Note: we don't set tabsLoaded.ccc = true here to ensure refreshActiveTab still checks if needed,
                // but CccTab cache will be populated.
            }

            console.log('[Background] Processing complete.');
        }, 500);

        // Auto-collapse left panel to maximize log viewing space
        if (leftPanel && panelToggleBtn && !leftPanel.classList.contains('collapsed')) {
            leftPanel.classList.add('collapsed');
            panelToggleBtn.innerHTML = '&raquo;';
            console.log('[UI] Auto-collapsed left panel after file loading');
        }

        progressText.textContent = 'Complete!';
    }

    /**
     * OPTIMIZATION: Master refresh function with intelligent caching and lazy loading.
     * Only re-filters when filter state actually changes.
     * Lazy loads tab data on first visit.
     */
    // Helper function to jump to a specific line number
    function gotoLine(lineNumber) {
        console.log(`[Goto Line] Jumping to line #${lineNumber}...`);

        // Clear filters internally but keep search box value for user to see
        const searchInput = document.getElementById('searchInput');
        // Don't clear searchInput.value - let user see what they typed
        liveSearchQuery = '';

        // Clear keyword chips
        filterKeywords.forEach(kw => kw.active = false);
        const keywordChipsContainer = document.getElementById('keywordChips');
        if (keywordChipsContainer) keywordChipsContainer.innerHTML = '';

        // Hide autocomplete
        const autocompleteSuggestions = document.getElementById('autocompleteSuggestions');
        if (autocompleteSuggestions) autocompleteSuggestions.style.display = 'none';

        // Refresh to show full log, then scroll
        refreshActiveTab().then(() => {
            setTimeout(() => {
                // Find the FIRST non-meta line with this lineNumber
                console.log(`[Goto Line Debug] Looking for lineNumber: ${lineNumber}`);
                console.log(`[Goto Line Debug] Sample lines:`, originalLogLines.slice(0, 5).map(l => ({
                    lineNumber: l.lineNumber,
                    isMeta: l.isMeta,
                    text: l.originalText?.substring(0, 50)
                })));

                const targetIndex = originalLogLines.findIndex(line =>
                    !line.isMeta && line.lineNumber === lineNumber
                );

                if (targetIndex !== -1) {
                    const foundLine = originalLogLines[targetIndex];
                    console.log(`[Goto Line Debug] Found at index ${targetIndex}:`, {
                        lineNumber: foundLine.lineNumber,
                        isMeta: foundLine.isMeta,
                        text: foundLine.originalText?.substring(0, 80)
                    });

                    const LINE_HEIGHT = 24;
                    const logContainer = document.getElementById('logContainer');

                    if (logContainer) {
                        logContainer.scrollTop = targetIndex * LINE_HEIGHT;
                        console.log(`[Goto Line] Scrolled to line #${lineNumber} at index ${targetIndex}`);

                        // Highlight the line after a short delay
                        setTimeout(() => {
                            const rows = logContainer.querySelectorAll('.log-row');
                            rows.forEach(row => {
                                const lineNum = row.getAttribute('data-line-number');
                                if (lineNum && parseInt(lineNum) === lineNumber) {
                                    row.style.backgroundColor = '#fff3cd';
                                    setTimeout(() => { row.style.backgroundColor = ''; }, 2000);
                                }
                            });
                        }, 400);
                    }
                } else {
                    console.warn(`[Goto Line] Line #${lineNumber} not found`);
                }
            }, 200);
        });
    }

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
                await applyFilters();
                cacheFilteredResults('logs', filteredLogLines);
                break;
            case 'connectivity':
                if (!connectivityScrollListenerAttached) await setupConnectivityTab(); else await applyConnectivityFilters();
                cacheFilteredResults('connectivity', filteredConnectivityLogLines);
                break;
            case 'btsnoop':
                // Delegate setup to the module
                // FIX: Pass necessary dependencies including DB refs and UI containers
                await BtsnoopTab.setupBtsnoopTab({
                    db,
                    getDb: () => db, // Simple wrapper if getDb isn't global, but passing 'db' instance usually works if open
                    saveData,
                    loadData,
                    TimeTracker,
                    btsnoopInitialView: document.getElementById('btsnoopInitialView'),
                    btsnoopContentView: document.getElementById('btsnoopContentView'),
                    btsnoopFilterContainer: document.getElementById('btsnoopFilterContainer')
                });
                // FIX: Render BLE Keys using the Connection Events from the module
                // The module manages the data state (processed events), so we pull from it.
                const bleKeysTableBody = document.querySelector('#bleKeysTable tbody');
                if (bleKeysTableBody) {
                    renderBleKeys(
                        BtsnoopTab.getBtsnoopConnectionEvents(),
                        BtsnoopTab.getBtsnoopConnectionMap(),
                        bleKeysTableBody
                    );
                }
                cacheFilteredResults('btsnoop', BtsnoopTab.getBtsnoopPackets());
                break;
            case 'ccc':
                await CccTab.setup(cccMessages, btsnoopConnectionMap, processForBtsnoop, isBtsnoopProcessed);
                cacheFilteredResults('ccc', true); // Mark as cached so needsRefiltering works correctly next time
                break;
            case 'stats':
                // FIX: Render BLE Keys in Stats tab too
                const bleKeysTable = document.querySelector('#bleKeysTable tbody');
                if (bleKeysTable) {
                    renderBleKeys(
                        BtsnoopTab.getBtsnoopConnectionEvents(),
                        BtsnoopTab.getBtsnoopConnectionMap(),
                        bleKeysTable,
                        window.finalBleKeys || new Map() // Pass global keys
                    );
                }

                // FIX: Re-render charts to ensure correct dimensions if parsed while tab was hidden
                if (window.finalDashboardStats) {
                    // Use requestAnimationFrame to ensure DOM is visible/layout is computed
                    requestAnimationFrame(() => {
                        if (cpuLoadPlotContainer) StatsTab.renderCpuPlot(window.finalDashboardStats.cpuDataPoints, cpuLoadPlotContainer);
                        const tempContainer = document.getElementById('temperaturePlotContainer');
                        if (tempContainer) StatsTab.renderTemperaturePlot(window.finalDashboardStats.temperatureDataPoints, tempContainer);
                        if (batteryPlotContainer) StatsTab.renderBatteryPlot(window.finalDashboardStats.batteryStatsPoints || [], batteryPlotContainer);
                    });
                }

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

    // Helper function to build filter configuration for FilterManager
    function getFilterConfig() {
        const activeKeywords = filterKeywords.filter(kw => kw.active).map(kw => ({
            text: kw.text,
            active: true,
            regex: wildcardToRegex(kw.text)
        }));

        // Parse inputs as UTC to match worker's UTC-based timestamps
        // FIX: Append 'Z' to treat the "datetime-local" string as a UTC time
        const startTime = startTimeInput.value ? new Date(startTimeInput.value + 'Z') : null;
        const endTime = endTimeInput.value ? new Date(endTimeInput.value + 'Z') : null;

        return {
            activeLogLevels: activeLogLevels,
            keywords: activeKeywords,
            isAndLogic: isAndLogic,
            liveSearchQuery: liveSearchQuery,
            startTime: startTime,
            endTime: endTime,
            isTimeFilterActive: isTimeFilterActive
        };
    }

    function applyMainFilters(linesToFilter, collapseState, activeCollapseSet) {
        // Use FilterManager for filtering
        const filterConfig = getFilterConfig();

        // Time filter is handled within FilterManager


        // Use FilterManager.applyMainFilters
        return FilterManager.applyMainFilters(
            linesToFilter,
            collapseState || { isInside: false },
            activeCollapseSet,
            filterConfig
        );
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
        // --- Worker Setup ---
        let worker;
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
            const filteredChunk = applyMainFilters(chunk, collapseState, logViewCollapseState);
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
    async function applyFiltersAsync(sourceLines, targetLines, container, renderFn, preFilterFn = null, activeCollapseSet) {
        const currentVersion = ++filterVersion; // Invalidate previous filter runs

        // 1. Find the first visible line in the current viewport to use as an anchor.
        // Prioritize the user-clicked anchor. Fallback to the top visible line from the PREVIOUS render.
        let anchorLine = userAnchorLine;
        if (!anchorLine && targetLines.length > 0 && container.scrollTop > 0) {
            const topVisibleIndex = Math.floor(container.scrollTop / LINE_HEIGHT);
            // Verify index bounds
            if (topVisibleIndex < targetLines.length) {
                anchorLine = targetLines[topVisibleIndex];
            }
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
                collapsedFileHeaders: Array.from(activeCollapseSet),
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
                        // Anchor lost (filtered out). 
                        // Try to keep relative position or just stay put?
                        // If we reset to 0, it's annoying. Let's try to maintain the same pixel offset if possible, 
                        // or at least clamping it to the new height.
                        // Actually, if the anchor is gone, it means the context changed. 
                        // Going to top (0) is safe, BUT if we are actively scrolling, we might want to be smarter.
                        // Better heuristic: find the nearest neighbor? Too expensive.
                        // Fallback: If user had an explicit anchor (selection) and it's gone, clear the selection.
                        if (userAnchorLine === anchorLine) {
                            userAnchorLine = null;
                        }
                        // Default to top if anchor is lost
                        newScrollTop = 0;
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
            const filteredChunk = applyMainFilters(chunk, collapseState, activeCollapseSet);
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
            } else {
                // Anchor lost fallback (same as worker path)
                if (userAnchorLine === anchorLine) {
                    userAnchorLine = null;
                }
                newScrollTop = 0;
            }
        }

        // Force the scroll position update
        if (container.scrollTop !== newScrollTop) {
            container.scrollTop = newScrollTop;
        }

        // 7. Final render
        renderFn();

        // Double check scroll after render (sometimes layout shifts affect it)
        if (container.scrollTop !== newScrollTop) {
            container.scrollTop = newScrollTop;
        }
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
    // wildcardToRegex removed (imported from utils)

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

        // Set input fields initial values and constraints
        const minIso = dateToISO(minLogDate);
        const maxIso = dateToISO(maxLogDate);

        startTimeInput.min = minIso;
        startTimeInput.max = maxIso;
        endTimeInput.min = minIso;
        endTimeInput.max = maxIso;

        startTimeInput.value = minIso;
        endTimeInput.value = maxIso;

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

        timeRangeSlider.noUiSlider.on('end', (values) => {
            const [currentStart, currentEnd] = values.map(v => Number(v));
            // Reset filter active flag if we are covering the full range (with slight buffer for float precision)
            const isFullRange = (Math.abs(currentStart - minTime) < 1000) && (Math.abs(currentEnd - maxTime) < 1000);
            isTimeFilterActive = !isFullRange;
            refreshActiveTab(); // Apply filters only when the user finishes sliding
        });

        // When input fields are changed, update the slider
        [startTimeInput, endTimeInput].forEach(input => {
            [startTimeInput, endTimeInput].forEach(input => {
                input.addEventListener('change', async () => {
                    isUpdatingFromInput = true;
                    // Match UTC logic
                    const startVal = startTimeInput.value ? new Date(startTimeInput.value + 'Z').getTime() : minTime;
                    const endVal = endTimeInput.value ? new Date(endTimeInput.value + 'Z').getTime() : maxTime;

                    // Check if full range
                    const isFullRange = (Math.abs(startVal - minTime) < 1000) && (Math.abs(endVal - maxTime) < 1000);
                    isTimeFilterActive = !isFullRange;

                    timeRangeSlider.noUiSlider.set([startVal, endVal]);
                    isUpdatingFromInput = false;
                    await refreshActiveTab(); // Apply filters after input change
                });
            });
        });
    }

    function dateToISO(date) {
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        const hours = String(date.getUTCHours()).padStart(2, '0');
        const minutes = String(date.getUTCMinutes()).padStart(2, '0');
        const seconds = String(date.getUTCSeconds()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
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
        const date = new Date(Date.UTC(year, month, day, hours, minutes, seconds, milliseconds));
        return isNaN(date) ? null : date;
    }

    // Helper functions removed (imported from utils)
    // --- Helper for Standard Table Scroll Restoration ---
    function restoreTableScroll(tableId) {
        const table = document.getElementById(tableId);
        if (!table) return;

        const selectedRowId = selectedTableRows.get(tableId);
        if (!selectedRowId) return;

        // Try to find the row with this ID
        const row = table.querySelector(`tr[data-row-id="${selectedRowId}"]`);
        if (row) {
            row.classList.add('selected');
            // Ensure meaningful scroll into view
            row.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            console.log(`[Restore] Restored selection for ${tableId} -> ${selectedRowId}`);
        } else {
            // Anchor lost? Optional: clear selection or keep it if it might come back later.
            // keeping it allows it to re-appear if filters change back.
        }
    }

    // renderVirtualLogs removed (replaced by VirtualList component)

    // Orphaned code removed (cleanup)

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

    async function renderUI(isInitialLoad = false) {
        renderFilterChips();
        // This function's primary role is to re-apply filters when a UI control
        // (like a keyword chip) changes the filter state. The initial render is
        // handled at the end of processFiles.
        await refreshActiveTab();
    }

    // Export logs to text file (using ExportManager)
    function handleExport(logLines, filename) {
        try {
            ExportManager.exportLogsToText(logLines, filename, currentZipFileName);
        } catch (error) {
            alert('Export failed: ' + error.message);
            console.error('Export error:', error);
        }
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
        startTimeInput.addEventListener('change', () => timeRangeSlider.noUiSlider.set([new Date(startTimeInput.value + 'Z').getTime(), null]));
        endTimeInput.addEventListener('change', () => timeRangeSlider.noUiSlider.set([null, new Date(endTimeInput.value + 'Z').getTime()]));
    }
    if (logLevelToggleBtn) {
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
    bindMasterToggle('masterToggleUwb', 'uwb', 'uwbFiltersPanel');
    bindMasterToggle('masterToggleWallet', 'wallet', null);

    ['bleFiltersPanel', 'nfcFiltersPanel', 'dckFiltersPanel', 'uwbFiltersPanel'].forEach(panelId => {
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
            const inputValue = searchInput.value;

            // Check for goto line pattern: #123 or line:123
            const gotoLineMatch = inputValue.match(/^(?:#|line:)\s*(\d+)$/i);
            if (gotoLineMatch) {
                clearTimeout(debounceTimer);
                const targetLineNumber = parseInt(gotoLineMatch[1]);
                gotoLine(targetLineNumber);
                return;
            }

            // Normal search behavior (debounced)
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

    // Stats rendering functions moved to StatsTab.js module


    // CCC Logic moved to ui/tabs/CccTab.js

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
        // FIX: Correctly render BLE Security Keys (IRK/LTK)
        if (bleKeysTbody) {
            renderBleKeys(btsnoopConnectionEvents, btsnoopConnectionMap, bleKeysTbody);
        }

        // Render Device Events
        renderDeviceEvents(highlights.deviceEvents, deviceEventsTable);

        // Setup filters for all highlight tables
        setupTableFilters('deviceEventsTable');
        setupTableFilters('bleKeysTable');
        setupTableFilters('btsnoopConnectionEventsTable');

        // Restore selection/scroll
        restoreTableScroll('deviceEventsTable');
        restoreTableScroll('bleKeysTable');
        restoreTableScroll('btsnoopConnectionEventsTable');

        // Make tables sortable with default descending sort
        // Make tables sortable with default descending sort
        setupDeviceEventsTab('deviceEventsTable');
        setupBleKeysTab('bleKeysTable');
        makeSortable('btsnoopConnectionEventsTable', 1, 'desc'); // Sort by timestamp column

        // Make tables resizable
        if (document.getElementById('btsnoopConnectionEventsTable')) {
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

                // Restore scroll position after filtering
                restoreTableScroll(tableId);
            });
        });
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
        const activeKeywords = filterKeywords.filter(kw => kw.active).map(kw => kw.text);
        const keywordRegexes = activeKeywords.length > 0 ? activeKeywords.map(wildcardToRegex) : null;
        const liveSearchRegex = liveSearchQuery ? wildcardToRegex(liveSearchQuery) : null;

        // Re-use the generic virtual logger but targeting the connectivity container
        renderVirtualList(
            document.getElementById('connectivityLogContainer'),
            document.getElementById('connectivityLogSizer'),
            document.getElementById('connectivityLogViewport'),
            filteredConnectivityLogLines,
            connectivityViewCollapseState,
            {
                keywordRegexes,
                liveSearchRegex,
                selectedLine: userAnchorLine
            }
        );
    }

    async function applyConnectivityFilters() {
        // Collect active layers from DOM
        const activeLayers = {
            ble: new Set(),
            nfc: new Set()
        };

        const blePanel = document.getElementById('bleFiltersPanel');
        if (blePanel) {
            blePanel.querySelectorAll('.filter-icon.active').forEach(b => activeLayers.ble.add(b.dataset.bleFilter));
        }

        const nfcPanel = document.getElementById('nfcFiltersPanel');
        if (nfcPanel) {
            nfcPanel.querySelectorAll('.filter-icon.active').forEach(b => activeLayers.nfc.add(b.dataset.nfcFilter));
        }

        const data = { bleLogLines, nfcLogLines, dckLogLines, uwbLogLines, walletLogLines };

        let candidates = filterConnectivityLogs(data, activeTechs, activeLayers);

        // Sort by index to maintain chronological order
        // Note: filterConnectivityLogs already sorts, but double check if we need to resort here?
        // The module sorts. We are good.

        // Update global source
        connectivityLogLines = candidates;

        // Apply main filters (Search, Level, Time)
        return applyFiltersAsync(
            connectivityLogLines,
            filteredConnectivityLogLines,
            document.getElementById('connectivityLogContainer'),
            renderConnectivityVirtualLogs,
            null, // No pre-filter function needed here as it's already done
            connectivityViewCollapseState
        );
    }

    // Master Toggle Handler Helper
    function bindMasterToggle(id, techKey, filterPanelId, activeSet) { // Added activeSet
        const toggle = document.getElementById(id);
        const panel = filterPanelId ? document.getElementById(filterPanelId) : null;

        if (toggle) {
            // Find parent tech-section for styling. If panel exists use it, else use toggle's parent.
            const techSection = panel ? panel.closest('.tech-section') : toggle.closest('.tech-section');

            // Init state: Use HTML checked attribute as source of truth, sync activeTechs to it
            activeTechs[techKey] = toggle.checked;

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

    // setupCccTab moved to ui/tabs/CccTab.js

    async function setupBtsnoopTab() {
        console.log('[BTSnoop Debug] 1. setupBtsnoopTab called.');
        if (!btsnoopScrollListenerAttached && btsnoopLogContainer instanceof HTMLElement) {
            // FIX: Attach the correct virtual scroll listener.
            btsnoopLogContainer.addEventListener('scroll', () => {
                // Clear the anchor when user manually scrolls
                // This allows scroll restoration to work only when filters change
                if (!window.btsnoopScrollFrame) {
                    window.btsnoopScrollFrame = requestAnimationFrame(() => {
                        renderBtsnoopVirtualLogs();
                        window.btsnoopScrollFrame = null;

                        // Sync horizontal scroll
                        const header = document.getElementById('btsnoopHeader');
                        if (header && header.firstChild) {
                            header.scrollLeft = btsnoopLogContainer.scrollLeft;
                        }

                        // Clear anchor after manual scroll (debounced)
                        // But ONLY if this is not a programmatic scroll
                        if (!isProgrammaticBtsnoopScroll) {
                            clearTimeout(window.btsnoopAnchorClearTimer);
                            window.btsnoopAnchorClearTimer = setTimeout(() => {
                                btsnoopAnchorPacketNumber = null;
                            }, 100);
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

        // Attach Toggle Collapse/Expand Listener
        const toggleCollapseBtn = document.getElementById('btsnoopToggleCollapseBtn');

        if (toggleCollapseBtn) {
            const newBtn = toggleCollapseBtn.cloneNode(true);
            toggleCollapseBtn.parentNode.replaceChild(newBtn, toggleCollapseBtn);
            newBtn.addEventListener('click', () => {
                const metaPackets = btsnoopPackets.filter(p => p.type === 'META');
                if (metaPackets.length === 0) return;

                const allCollapsed = metaPackets.every(p => btsnoopCollapsedFiles.has(p.fileName));

                if (allCollapsed) {
                    // Expand All
                    btsnoopCollapsedFiles.clear();
                    newBtn.textContent = '⊟';
                    newBtn.title = 'Collapse All Files';
                } else {
                    // Collapse All
                    metaPackets.forEach(p => btsnoopCollapsedFiles.add(p.fileName));
                    newBtn.textContent = '⊞';
                    newBtn.title = 'Expand All Files';
                }
                renderBtsnoopPackets();
            });
        }

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
        console.log('[BTSnoop Debug] [MAIN.JS] Delegating to BtsnoopTab module...');

        // Pass dependencies explicitly to module
        const deps = {
            db,
            getDb: () => db,
            saveData,
            loadData,
            TimeTracker,
            btsnoopInitialView,
            btsnoopContentView,
            btsnoopFilterContainer
        };

        try {
            // Processing is now handled by the module
            const result = await BtsnoopTab.processForBtsnoop(fileTasks, deps);

            // Sync duplicated state to satisfy legacy code in main.js (e.g. searching/filtering if not yet refactored)
            btsnoopPackets = BtsnoopTab.getBtsnoopPackets();
            btsnoopConnectionEvents = BtsnoopTab.getBtsnoopConnectionEvents();
            isBtsnoopProcessed = true;

            // Update main.js cache logic
            cacheFilteredResults('btsnoop', btsnoopPackets);

            return result;

        } catch (e) {
            console.error('[BTSnoop Debug] Module processing failed:', e);
            // Ensure UI shows error
            if (btsnoopInitialView) {
                btsnoopInitialView.innerHTML = `<p>Error: ${e.message}</p>`;
            }
            throw e;
        }
    }

    // resolveBtsnoopHandles logic moved to BtsnoopTab.js

    // renderBtsnoopConnectionEvents and exportBtsnoopToXlsx moved to BtsnoopTab.js

    let currentBtsnoopRequest = null; // To manage batched loading

    // [DELETED] Duplicate BTSnoop functions (renderBtsnoopPackets, createBtsnoopFilterHeader, renderBtsnoopVirtualLogs, handleBtsnoopFilterInput) removed to use BtsnoopTab.js module.

    function handleViewportInteraction(event) {
        const target = event.target;
        // Debug logging to trace clicks
        console.log('[Click Debug] Target:', target.tagName, 'Classes:', target.className, 'ParentTable:', target.closest('table')?.id);

        // 1. Handle Copy Actions (Button or Ctrl+Click)
        const isCopyBtn = target.classList.contains('copy-log-btn');
        const isCtrlClick = (event.ctrlKey || event.metaKey);
        // Identify potential copy targets: specific class or generic table cell
        const copyTarget = target.closest('.copy-cell') || target.closest('.btsnoop-copy-cell') || target.closest('td');

        if (isCopyBtn || (isCtrlClick && copyTarget)) {
            let logText = '';

            if (isCopyBtn) {
                logText = target.dataset.logText;
            } else if (copyTarget) {
                // Check if this is part of a Table Row (TR)
                const trRow = copyTarget.closest('tr'); // Standard tables

                if (trRow) {
                    // Standard Table Row: Aggregate all cells
                    const cells = Array.from(trRow.querySelectorAll('td'));
                    // Use double space separator for tabular data
                    logText = cells.map(c => c.dataset.logText || c.textContent.trim()).join('  ');
                    console.log(`[Copy] Aggregated Table Row(${cells.length} cols): `, logText.length, 'chars');
                } else {
                    // Fallback to single cell copy (e.g., Virtual Log Line span)
                    logText = copyTarget.dataset.logText || copyTarget.textContent;
                }
            }

            if (logText) {
                navigator.clipboard.writeText(logText).then(() => {
                    console.log('[Copy] Copied:', logText.length, 'chars');
                    // --- CCC Hover Tooltip Logic ---
                    function setupCccHover() {
                        const viewport = document.getElementById('logViewport');
                        const tooltip = document.createElement('div');
                        tooltip.id = 'cccTooltip';
                        document.body.appendChild(tooltip);

                        // Helper to hide tooltip
                        const hideTooltip = () => {
                            tooltip.style.display = 'none';
                        };

                        // Delegate mouseover/mousemove on the viewport
                        viewport.addEventListener('mousemove', (e) => {
                            const target = e.target.closest('.log-line');
                            if (!target) {
                                hideTooltip();
                                return;
                            }

                            const index = parseInt(target.dataset.lineIndex, 10);
                            if (isNaN(index)) return;

                            // Determine which list is active (filtered or original) based on current view
                            // The 'renderVirtualList' is called with 'filteredLogLines' (or original if filters empty)
                            // But main.js variable 'filteredLogLines' is always the source of truth for the MAIN view loop.
                            // If we are in connectivity view, that's different.
                            // Assuming this is the main Log View.
                            const line = filteredLogLines[index];

                            if (line && line.cccMessage) {
                                // Decode on the fly
                                const msg = line.cccMessage;
                                const { innerMsg, params } = CccTab.decodePayload(msg.type, msg.subtype, msg.payload);
                                const categoryName = CccTab.CCC_CONSTANTS?.MESSAGE_TYPES?.[msg.type] || `Type 0x${msg.type.toString(16)}`;

                                let handleNumber = -1;
                                if (msg.handle !== undefined && msg.handle !== null) {
                                    if (typeof msg.handle === 'string' && msg.handle.startsWith('0x')) {
                                        handleNumber = parseInt(msg.handle, 16);
                                    } else {
                                        handleNumber = Number(msg.handle);
                                    }
                                }
                                const peerAddress = msg.peerAddress || btsnoopConnectionMap?.get(handleNumber)?.address || 'N/A';


                                let html = `<div class="tooltip-header">CCC Packet Detail</div>`;
                                html += `<div class="tooltip-row"><span class="tooltip-label">Category:</span><span class="tooltip-value">${escapeHtml(categoryName)}</span></div>`;
                                html += `<div class="tooltip-row"><span class="tooltip-label">Msg:</span><span class="tooltip-value" style="font-weight:bold; color:#fff">${escapeHtml(innerMsg)}</span></div>`;
                                html += `<div class="tooltip-row"><span class="tooltip-label">Dir:</span><span class="tooltip-value">${escapeHtml(msg.direction)}</span></div>`;
                                html += `<div class="tooltip-row"><span class="tooltip-label">Peer:</span><span class="tooltip-value">${escapeHtml(peerAddress)}</span></div>`;

                                if (params) {
                                    html += `<div class="tooltip-row" style="margin-top:4px; border-top:1px solid #444; padding-top:2px;">${params}</div>`;
                                }

                                tooltip.innerHTML = html;
                                tooltip.style.display = 'block';

                                // Position tooltip
                                const x = e.clientX + 15;
                                const y = e.clientY + 15;

                                // Adjust if off screen
                                const rect = tooltip.getBoundingClientRect();
                                const winWidth = window.innerWidth;
                                const winHeight = window.innerHeight;

                                tooltip.style.left = (x + rect.width > winWidth ? x - rect.width - 20 : x) + 'px';
                                tooltip.style.top = (y + rect.height > winHeight ? y - rect.height - 20 : y) + 'px';
                            } else {
                                hideTooltip();
                            }
                        });

                        viewport.addEventListener('mouseleave', hideTooltip);
                    }

                    // Initialize hover listeners once DOM is ready (or after initial render?)
                    // DOMContentLoaded started at line 31.
                    setupCccHover();

                    // Visual feedback
                    const feedbackEl = isCopyBtn ? target : copyTarget;
                    const originalBg = feedbackEl.style.backgroundColor;
                    const originalColor = feedbackEl.style.color;
                    const originalText = isCopyBtn ? feedbackEl.textContent : null;

                    feedbackEl.style.backgroundColor = '#34a853';
                    feedbackEl.style.color = '#fff';
                    if (isCopyBtn) feedbackEl.textContent = '✓';

                    setTimeout(() => {
                        feedbackEl.style.backgroundColor = originalBg;
                        feedbackEl.style.color = originalColor;
                        if (isCopyBtn) feedbackEl.textContent = originalText;
                    }, 600);
                }).catch(err => console.error('Copy failed:', err));
            }
            event.preventDefault();
            event.stopPropagation();
            return;
        }

        // 2. Handle Generic Table Selection (CCC, Stats, etc.)
        // Ensure we catch interactions for tables that might not be in a 'log-viewport'
        const parentTable = target.closest('table');
        if (parentTable && target.closest('tr') && !target.closest('thead')) {
            // Check for text selection
            if (window.getSelection().toString().length > 0) return;

            // Check if this is an interactive table (by class or specific ID)
            const isInteractive = parentTable.classList.contains('ccc-table') ||
                parentTable.classList.contains('highlight-table') ||
                ['cccStatsTable', 'deviceEventsTable', 'bleKeysTable', 'btsnoopConnectionEventsTable'].includes(parentTable.id);

            if (isInteractive) {
                const row = target.closest('tr');
                const tbody = row.closest('tbody');

                if (tbody) {
                    Array.from(tbody.children).forEach(r => r.classList.remove('selected'));
                }
                row.classList.add('selected');

                // Persist selection using unique ID
                if (parentTable.id && row.dataset.rowId) {
                    selectedTableRows.set(parentTable.id, row.dataset.rowId);
                    console.log(`[Interaction] Selected row ${row.dataset.rowId} in ${parentTable.id}`);
                }
                return;
            }
        }




        // 3. Handle Log Line Selection (Virtual Viewports)
        if (target.closest('.log-line')) {
            // Check for text selection - if user is selecting text, don't trigger row select
            if (window.getSelection().toString().length > 0) {
                return;
            }

            const lineDiv = target.closest('.log-line');
            const lineIndex = parseInt(lineDiv.dataset.lineIndex, 10);
            const activeViewport = target.closest('.log-viewport');

            // Determine source array based on viewport ID
            let sourceArray = filteredLogLines; // Default
            if (activeViewport && activeViewport.id === 'connectivityLogViewport') {
                sourceArray = filteredConnectivityLogLines;
            }

            if (!isNaN(lineIndex) && sourceArray[lineIndex]) {
                const clickedLine = sourceArray[lineIndex];

                // Handle collapsing/expanding file headers
                if (clickedLine.isMeta) {
                    const headerText = clickedLine.originalText;
                    // Determine which collapse state set to use
                    let collapseSet = logViewCollapseState;
                    if (activeViewport && activeViewport.id === 'connectivityLogViewport') {
                        collapseSet = connectivityViewCollapseState;
                    }

                    if (collapseSet.has(headerText)) {
                        collapseSet.delete(headerText);
                    } else {
                        collapseSet.add(headerText);
                    }
                    console.log(`[Interaction] Toggled collapse for: ${headerText} `);
                    refreshActiveTab(); // Re-filter and render
                    return;
                }

                // Toggle anchor
                if (userAnchorLine === clickedLine) {
                    userAnchorLine = null;
                } else {
                    userAnchorLine = clickedLine;
                    console.log('Selected Anchor:', userAnchorLine);
                }

                // Force Re-render to update highlights
                if (activeViewport && activeViewport.id === 'connectivityLogViewport') {
                    renderConnectivityVirtualLogs();
                } else {
                    handleMainLogScroll();
                }
            }
        }
        // [DELETED] BTSnoop Row Selection (Sections 4 & 5) removed to use BtsnoopTab.js module.
    }

    // --- Memory Cleanup on Exit ---
    // Ensure all data, including persisted data in IndexedDB, is cleared when the user leaves.

    // ============================================================================
    // TABLE SORTING FUNCTIONALITY
    // ============================================================================

    // makeSortable logic moved to table-sort.js

    // ============================================================================
    // INITIALIZE APPLICATION
    // ============================================================================

    async function initializeApp() {
        const skeletonLoader = document.getElementById('skeletonLoader');

        try {
            await openDb(); // Ensure the database is open before any other operations.

            // Clean slate on refresh as requested
            await clearData();
            console.log('[Init] Cleared old data.');

            // Attach file input listeners. The state is cleared inside processFiles.
            if (zipInput) {
                zipInput.addEventListener('change', (event) => processFiles(event.target.files));
            }
            if (logFilesInput) {
                logFilesInput.addEventListener('change', (event) => processFiles(event.target.files));
            }

            initializeDynamicElements();
            injectLogLevelStyles();

            // No persistence check - we cleared everything
            if (skeletonLoader) skeletonLoader.style.display = 'none';

            await applyFilters();

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

    // --- Expose for Testing ---
    // --- Expose for Testing ---
    window._debug = {
        // Delegate to module getters/setters if available, or just use getters
        get btsnoopPackets() { return BtsnoopTab.getBtsnoopPackets(); },
        // set btsnoopPackets(v) { ... } // Read-only via debug to avoid state desync
        get isBtsnoopProcessed() { return isBtsnoopProcessed; },
        set isBtsnoopProcessed(v) { isBtsnoopProcessed = v; },
        // renderBtsnoopPackets: () => BtsnoopTab.renderBtsnoopPackets(), // If needed, but better to trigger via setup
        setupBtsnoopTab,
        get selectedBtsnoopPacket() { return BtsnoopTab.getSelectedBtsnoopPacket(); },
        // set selectedBtsnoopPacket(v) { BtsnoopTab.setSelectedBtsnoopPacket(v); }
    };

    initializeApp();
});