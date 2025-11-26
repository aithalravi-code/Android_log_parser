document.addEventListener('DOMContentLoaded', () => {
    // --- IndexedDB Helper ---
    const DB_NAME = 'logViewerDB';
    const DB_VERSION = 1;
    const STORE_NAME = 'logStore';
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
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'key' });
                }
            };
        });
    }

    function dbAction(type, key, value = null) {
        return new Promise((resolve, reject) => {
            if (!db) return reject('DB not open');
            const transaction = db.transaction([STORE_NAME], type);
            const store = transaction.objectStore(STORE_NAME);
            const request = type === 'readwrite' ? store.put({ key, value }) : store.get(key);
            transaction.oncomplete = () => resolve(request.result);
            transaction.onerror = (event) => reject('DB transaction error: ' + event.target.error);
        });
    }

    const saveData = (key, value) => dbAction('readwrite', key, value);
    const loadData = (key) => dbAction('readonly', key);
    const clearData = () => new Promise((resolve, reject) => db.transaction([STORE_NAME], 'readwrite').objectStore(STORE_NAME).clear().onsuccess = resolve);

    // --- DOM Elements ---
    const zipInput = document.getElementById('zipInput');
    const logFilesInput = document.getElementById('logFilesInput');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
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
    let btsnoopLogTableBody; // For efficient btsnoop rendering

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
    let filteredNfcLogLines = []; // The currently filtered set of NFC lines
    let dckLogLines = []; // Holds all DCK-related log lines
    let filteredDckLogLines = []; // The currently filtered set of DCK lines
    let btsnoopPackets = []; // Holds parsed btsnoop packets
    let kernelLogLines = []; // Holds all Kernel-related log lines
    let filteredBtsnoopPackets = []; // Holds the filtered set of btsnoop packets
    let btsnoopConnectionEvents = []; // Holds LE Connection Complete events
    let btsnoopConnectionMap = new Map(); // Maps connection handle to BT address
    let allAppVersions = []; // Holds all found app versions
    let filteredKernelLogLines = []; // The currently filtered set of Kernel lines
    let filteredLogLines = []; // The currently filtered set of lines
    let fileTasks = []; // Holds all discovered file tasks for later processing (e.g., btsnoop)
    let logTags = []; // Unique list of tags for autocomplete
    let zipEntriesToProcess = []; // Temp storage for entries from a zip
    let lastCheckedIndex = -1; // For shift-click selection
    let activeBleLayers = new Set(['manager', 'gatt', 'smp', 'hci']); // Default to all layers active
    let activeNfcLayers = new Set(['framework', 'hce', 'p2p', 'hal']); // Default to all layers active
    let activeBtsnoopFilters = new Set(['cmd', 'evt', 'acl', 'l2cap', 'smp', 'att']); // Default to connection events and L2CAP data
    let activeDckLayers = new Set(['manager', 'hal', 'oem']); // Default to all layers active
    let filterVersion = 0; // "Cancellation token" for async filtering
    let isProcessing = false; // Flag to prevent race conditions during filtering
    let btsnoopColumnFilterDebounceTimer = null;
    let userAnchorLine = null; // The log line object the user has clicked to anchor
    let bleScrollListenerAttached = false;
    let collapsedFileHeaders = new Set(); // For collapsible file logs
    let nfcScrollListenerAttached = false;
    let dckScrollListenerAttached = false;
    let kernelScrollListenerAttached = false;
    let btsnoopScrollListenerAttached = false;
    let btsnoopScrollThrottleTimer = null; // For throttling btsnoop scroll events
    let btsnoopRowPool = []; // For recycling DOM elements in btsnoop virtual scroll

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
            .log-line-E { color: #D32F2F; } /* Red */
            .log-line-W { color: #FBC02D; } /* Yellow */
            .log-line-I { color: #388E3C; } /* Green */
            .log-line-D { color: #1976D2; } /* Blue */

            /* --- Fix for BTSnoop Header Alignment --- */
            .btsnoop-column-filters {
                display: flex; /* Treat the header row as a flex container */
                width: 100%; /* Ensure it spans the full width */
                padding-right: 17px; /* Account for scrollbar width to prevent layout shift */
                box-sizing: border-box;
            }
            .btsnoop-column-filters th {
                padding: 2px 5px; /* Match cell padding */
            }
            /* FIX: Apply the same fixed-width flex rules to header cells as data cells */
            .btsnoop-column-filters th:nth-child(1) { flex: 0 0 60px; }
            .btsnoop-column-filters th:nth-child(2) { flex: 0 0 100px; }
            .btsnoop-column-filters th:nth-child(3), .btsnoop-column-filters th:nth-child(4) { flex: 0 0 180px; }
            .btsnoop-column-filters th:nth-child(5) { flex: 0 0 120px; }

            /* Apply the same flex rules to header cells as data cells */
            .btsnoop-column-filters th:nth-child(6), .btsnoop-column-filters th:nth-child(7) { flex: 1 1 0; min-width: 0; }

            /* --- FINAL REDESIGN for BTSnoop View --- */
            /* This container holds the header and the log container */
            #btsnoopContentView {
                display: flex;
                flex-direction: column;
                height: 100%;
            }
            /* The new header is a div, not a table */
            #btsnoopHeader {
                display: flex;
                border-bottom: 2px solid #ccc;
                padding-bottom: 5px;
                margin-bottom: 5px;
            }
            .btsnoop-row {
                display: flex;
                position: absolute;
                width: 100%;
                height: ${LINE_HEIGHT}px;
                border-bottom: 1px solid #e0e0e0;
            }
            /* Shared column widths for header AND data cells */
            .btsnoop-header-cell, .btsnoop-cell {
                padding: 2px 5px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                box-sizing: border-box;
            }
            .btsnoop-header-cell:nth-child(1), .btsnoop-cell:nth-child(1) { flex: 0 0 60px; }
            .btsnoop-header-cell:nth-child(2), .btsnoop-cell:nth-child(2) { flex: 0 0 100px; }
            .btsnoop-header-cell:nth-child(3), .btsnoop-cell:nth-child(3) { flex: 0 0 180px; }
            .btsnoop-header-cell:nth-child(4), .btsnoop-cell:nth-child(4) { flex: 0 0 180px; }
            .btsnoop-header-cell:nth-child(5), .btsnoop-cell:nth-child(5) { flex: 0 0 120px; }
            .btsnoop-header-cell:nth-child(6), .btsnoop-cell:nth-child(6) { flex: 1 1 50%; min-width: 0; } /* Summary */
            .btsnoop-header-cell:nth-child(7), .btsnoop-cell:nth-child(7) { flex: 1 1 50%; min-width: 0; } /* Data */
            }
        `;
        document.head.appendChild(style);
    }
    injectLogLevelStyles();
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
                folderInputContainer.style.display = 'block';
                fileInputContainer.style.display = 'none';
            }
        });
    } else {
        console.warn('HTML element with ID "folderChoice" not found.');
    }

    if (fileChoice) {
        fileChoice.addEventListener('change', () => {
            if (fileChoice.checked) {
                folderInputContainer.style.display = 'none';
                fileInputContainer.style.display = 'block';
            }
        });
    } else {
        console.warn('HTML element with ID "fileChoice" not found.');
    }

    // Add click listeners to clear state immediately when the user intends to select new files.
    if (zipInput) {
        zipInput.addEventListener('click', () => clearPreviousState(true));
        zipInput.addEventListener('change', (event) => processFiles(event.target.files));
    } else {
        console.warn('HTML element with ID "zipInput" not found.');
    }

    if (logFilesInput) {
        logFilesInput.addEventListener('click', () => clearPreviousState(true));
        logFilesInput.addEventListener('change', (event) => {
            const files = event.target.files;
            if (!files || files.length === 0) return;
            if (files && files.length > 0) {
                processFiles(files);
            }
        });
    } else {
        console.warn('HTML element with ID "logFilesInput" not found.');
    }

    async function checkForPersistedLogs() {
        try {
            const persistedData = await loadData('logData');
            if (persistedData && persistedData.value) {
                originalLogLines = persistedData.value;
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
                renderHighlights(finalHighlights);
                const dashboardStats = processForDashboardStats();
                renderDashboardStats(dashboardStats);
                renderCpuPlot(dashboardStats.cpuDataPoints);

                initializeTimeFilterFromLines();
                await renderUI(true); // Use fast initial render and wait for it to complete
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
            bleLogContainer = document.getElementById('bleLogContainer');        bleLogSizer = document.getElementById('bleLogSizer');
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
        btsnoopLogViewport = document.getElementById('btsnoopLogViewport');
        btsnoopLogTableBody = document.getElementById('btsnoopLogTableBody');
        kernelLogContainer = document.getElementById('kernelLogContainer');
        kernelLogSizer = document.getElementById('kernelLogSizer');
        kernelLogViewport = document.getElementById('kernelLogViewport');

        nfcFilterButtons = document.querySelectorAll('[data-nfc-filter]');
        bleFilterButtons = document.querySelectorAll('[data-ble-filter]');
        btsnoopFilterButtons = document.querySelectorAll('[data-btsnoop-filter]');
        btsnoopColumnFilters = document.querySelectorAll('.btsnoop-column-filters input');
        dckFilterButtons = document.querySelectorAll('[data-dck-filter]');

        // Attach event listeners now that elements are guaranteed to exist
        if (logContainer) logContainer.addEventListener('scroll', () => renderVirtualLogs(logContainer, logSizer, logViewport, filteredLogLines));
        // Removed specialized log container scroll listeners from here.
        // They will be attached dynamically when the tab is first accessed.
        if (keywordChipsContainer) keywordChipsContainer.addEventListener('mousedown', handleChipClick);

        [logViewport, bleLogViewport, nfcLogViewport, dckLogViewport, kernelLogViewport].forEach(vp => {
            if (vp) vp.addEventListener('mousedown', handleViewportInteraction);
        });
        if (bleLogViewport) bleLogViewport.addEventListener('mousedown', handleViewportInteraction);
        if (nfcLogViewport) nfcLogViewport.addEventListener('mousedown', handleViewportInteraction);
        if (dckLogViewport) dckLogViewport.addEventListener('mousedown', handleViewportInteraction);
        if (kernelLogViewport) kernelLogViewport.addEventListener('mousedown', handleViewportInteraction);
        if (appSearchInput) appSearchInput.addEventListener('input', () => renderAppVersions(allAppVersions));

        attachLayerFilterListeners(nfcFilterButtons, activeNfcLayers, applyNfcFilters);
        attachLayerFilterListeners(bleFilterButtons, activeBleLayers, applyBleFilters);
        // FIX: Pass an anonymous function to avoid closure issues with the active filter set.
        // This ensures that renderBtsnoopPackets always gets the CURRENT state of the global activeBtsnoopFilters.
        attachLayerFilterListeners(btsnoopFilterButtons, activeBtsnoopFilters, () => renderBtsnoopPackets(btsnoopConnectionMap, activeBtsnoopFilters));
        attachLayerFilterListeners(dckFilterButtons, activeDckLayers, applyDckFilters);

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

        const exportBleBtn = document.getElementById('exportBleBtn');
        if (exportBleBtn) exportBleBtn.addEventListener('click', () => handleExport(filteredBleLogLines, 'ble_logs.txt'));

        const exportNfcBtn = document.getElementById('exportNfcBtn');
        if (exportNfcBtn) exportNfcBtn.addEventListener('click', () => handleExport(filteredNfcLogLines, 'nfc_logs.txt'));

        const exportDckBtn = document.getElementById('exportDckBtn');
        if (exportDckBtn) exportDckBtn.addEventListener('click', () => handleExport(filteredDckLogLines, 'dck_logs.txt'));

        const exportKernelBtn = document.getElementById('exportKernelBtn');
        if (exportKernelBtn) exportKernelBtn.addEventListener('click', () => handleExport(filteredKernelLogLines, 'kernel_logs.txt'));

        const exportBtsnoopBtn = document.getElementById('exportBtsnoopBtn');
        if (exportBtsnoopBtn) exportBtsnoopBtn.addEventListener('click', () => handleExport(btsnoopPackets.map(p => `${p.timestamp} ${p.direction} ${p.type} ${p.summary}`), 'btsnoop_packets.txt'));

        const analyzeDckBtn = document.getElementById('analyzeDckBtn');
        if (analyzeDckBtn) {
            analyzeDckBtn.addEventListener('click', async () => {
                if (filteredDckLogLines.length === 0) {
                    alert("No filtered DCK logs to analyze. Please load logs and ensure they are visible in the DCK tab.");
                    return;
                }

                const analysisContainer = document.getElementById('dckGeminiAnalysisContainer');
                const resultDiv = document.getElementById('dckGeminiResult');

                analysisContainer.style.display = 'block';
                resultDiv.textContent = 'Analyzing with Gemini...';

                try {
                    // IMPORTANT: Replace with your actual backend server URL
                    const response = await fetch('http://localhost:3000/analyze-dck', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        // Send the raw text of the filtered logs
                        body: JSON.stringify({ logs: filteredDckLogLines.map(line => line.originalText).join('\n') }),
                    });

                    if (!response.ok) {
                        throw new Error(`Server error: ${response.statusText}`);
                    }

                    const analysis = await response.json();
                    resultDiv.innerHTML = analysis.text; // Using innerHTML to render potential Markdown from the backend
                } catch (error) {
                    resultDiv.textContent = `Error getting analysis: ${error.message}. Make sure your backend server is running.`;
                    console.error('Gemini analysis failed:', error);
                }
            });
        }
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
        btsnoopConnectionMap.clear();
        btsnoopPackets = [];
        btsnoopConnectionEvents = [];
        kernelLogLines = [];
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
        logViewport.innerHTML = '';
        logSizer.style.height = '0px';

        if (clearStorage && db) { // Also clear the persisted data from IndexedDB
            await clearData();
        }
    }

    async function processFiles(files, fromModal = false) {
        // Set the processing flag to prevent concurrent filtering operations
        isProcessing = true;

        // FIX: Initialize all dynamic DOM element references at the start of processing.
        // This ensures that all containers are found before any rendering is attempted.
        initializeDynamicElements();

        TimeTracker.reset();
        TimeTracker.start('Total Processing Time');

        // Determine what was uploaded and set the display text prominently.
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

                    self.onmessage = async (event) => {
                        const { zipFile } = event.data;
                        const fileTasks = [];

                        async function processZip(zipData, currentPath) {
                            const jszip = new JSZip();
                            const zip = await jszip.loadAsync(zipData);
                            const promises = [];

                            zip.forEach((relativePath, zipEntry) => {
                                const fullPath = currentPath + ' -> ' + zipEntry.name;
                                if (zipEntry.dir) return; // Skip directories

                                if (zipEntry.name.endsWith('.zip')) {
                                    promises.push(
                                        zipEntry.async('arraybuffer').then(nestedZipData => processZip(nestedZipData, fullPath))
                                    );
                                } else if (zipEntry.name.endsWith('.txt') || zipEntry.name.endsWith('.log') || zipEntry.name.includes('btsnoop_hci.log')) {
                                    promises.push(
                                        zipEntry.async('blob').then(blob => fileTasks.push({ blob, path: fullPath }))
                                    );
                                }
                            });
                            await Promise.all(promises);
                        }

                        try {
                            await processZip(zipFile, zipFile.name);
                            self.postMessage({ status: 'success', fileTasks });
                        } catch (error) {
                            self.postMessage({ status: 'error', error: error.message });
                        }
                    };`;
                    const blob = new Blob([zipWorkerScriptText], { type: 'application/javascript' });
                    const zipWorkerURL = URL.createObjectURL(blob);
                    const zipWorker = new Worker(zipWorkerURL);
                    zipWorker.onmessage = (e) => {
                        if (e.data.status === 'success') fileTasks.push(...e.data.fileTasks);
                        else reject(e.data.error);
                        zipWorker.terminate();
                        URL.revokeObjectURL(zipWorkerURL);
                        resolve();
                    };
                    zipWorker.onerror = (err) => reject(err);
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
        // They will be handled separately by the BTSnoop tab's logic.
        const tasksToParse = fileTasks.filter(task => !task.path.includes('btsnoop_hci.log'));
        // --- Simplified Worker Pool Logic ---
        // To bypass 'file://' CORS restrictions, the worker's code is embedded
        // directly as a string. A Blob is created from this string, and a URL
            // is generated for that Blob, which is a valid origin for the worker. The unmatched group is changed from .* to .+ to avoid matching empty lines.
        // FIX: Replaced the single template literal with string concatenation to avoid syntax errors
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
            '            \'\\\\s+\' + // Separator\n' +
            '            \'(?:(?:\\\\s*\\\\d+\\\\s+\\\\d+\\\\s+(?:\\\\d+\\\\s+)?)?(?<level>[A-Z])\\\\s+(?<tag>[^\\\\s:]+?)(?::\\\\s|\\\\s+)|(?<level2>[A-Z])\\\\/(?<tag2>[^\\\\(\\\\s]+)(?:\\\\(\\\\s*\\\\d+\\\\))?:\\\\s)\' + // Two formats for level/tag\n' +
            '            \'(?<message>(?!.*Date: \\\\d{4}).*)\' + // Standard logcat message, negative lookahead to prevent matching custom format\n' +
            '        \'|\' +\n' +
            '            \'Date:\\\\s(?<customFullDate>\\\\d{4}-\\\\d{2}-\\\\d{2})\\\\s(?<customTime>\\\\d{2}:\\\\d{2}:\\\\d{2})\' + // Date: YYYY-MM-DD HH:mm:ss\n' +
            '            \'(?<customMessage>\\\\|.*)\' + // The rest of the custom log line, must start with a pipe\n' +
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
            '    const versionRegex = new RegExp(\'Package\\\\s+\\\\[([^\\]]+)\\\\].*?versionName=([^\\\\s\\\\n,]+)\');\n' +
            '    const appVersions = new Map();\n' +
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
'    const kernelRegex = /^\\s*\\[\\s*\\d+\\.\\d+\\]/;\n' +
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
            '                const { logcatDate, logcatTime, level, tag, level2, tag2, message } = match.groups;\n' +
            '                const [month, day] = logcatDate.split(\'-\').map(Number);\n' + // This was line 209
            '                const [hours, minutes, seconds, milliseconds] = logcatTime.split(/[:.]/).map(Number);\n' +
            '                lineDateObj = new Date(fileYear, month - 1, day, hours, minutes, seconds, milliseconds || 0);\n' +
            '\n' +
            '                const fullTimestamp = logcatDate + \' \' + logcatTime;\n' +
            '                if (!minTimestamp || fullTimestamp < minTimestamp) minTimestamp = fullTimestamp;\n' +
            '                if (!maxTimestamp || fullTimestamp > maxTimestamp) maxTimestamp = fullTimestamp;\n' +
            '\n' +
            '                const finalTag = (tag || tag2 || \'\').trim();\n' +
            '                tagSet.add(finalTag);\n' +
            '                const finalLevel = (level || level2).trim();\n' + // This was line 217
            '                parsedLine = { isMeta: false, dateObj: lineDateObj, date: logcatDate, time: logcatTime, timestamp: fullTimestamp, level: finalLevel, tag: finalTag, message: message.trim(), originalText: lineText };\n' +
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
            '        } else { // Unmatched line\n' +
            '            parsedLine = { isMeta: false, dateObj: null, date: \'N/A\', time: \'N/A\', originalText: lineText, level: \'V\', lineNumber: i + 1 };\n' +
            '            stats.V++;\n' +
            '        }\n' +
            '\n' +
            '        if (parsedLine) parsedLine.lineNumber = i + 1;\n' +
            '        const textToSearchForHighlights = parsedLine.message || lineText;\n' +
            '        let accountMatch;\n' +
            '        while ((accountMatch = accountRegex.exec(textToSearchForHighlights)) !== null) {\n' +
            '            if (accountMatch[1]) highlights.accounts.add(accountMatch[1].trim());\n' +
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
            '        for (const serviceName in services) {\n' +
            '            const service = services[serviceName];\n' +
            '            if (service.on.test(lineText)) highlights.deviceEvents.push({ date: parsedLine.date, time: parsedLine.time, timestamp: parsedLine.timestamp, event: serviceName + \' Status\', detail: \'On\', originalText: lineText });\n' +
            '            if (service.off.test(lineText)) highlights.deviceEvents.push({ date: parsedLine.date, time: parsedLine.time, timestamp: parsedLine.timestamp, event: serviceName + \' Status\', detail: \'Off\', originalText: lineText });\n' +
            '        }\n' +
            '        \n' +
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
            '    self.postMessage({ status: \'success\', tags: Array.from(tagSet), minTimestamp, maxTimestamp, filePath: path, stats, highlights: { ...highlights, accounts: Array.from(highlights.accounts) }, appVersions: Array.from(appVersions), batteryDataPoints });\n' +
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
        const consolidatedAppVersions = new Map();
        let consolidatedBatteryDataPoints = [];

        // --- Consolidate Results ---
        for (const result of allResults) {
            if (result.status === 'success') {
                // OPTIMIZATION: Efficiently and safely populate specialized logs from worker results
                for (const l of result.parsedLines) {
                    if (l.isBle) bleLogLines.push(l);
                    if (l.isNfc) nfcLogLines.push(l);
                    if (l.isKernel) kernelLogLines.push(l);
                    if (l.isDck) dckLogLines.push(l);
                }
                // Use concat instead of spread operator to avoid stack overflow with very large arrays.
                originalLogLines = originalLogLines.concat(result.parsedLines);
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
                // Consolidate battery data from worker
                if (result.batteryDataPoints) {
                    consolidatedBatteryDataPoints = consolidatedBatteryDataPoints.concat(result.batteryDataPoints);
                }
            }
        }
        allAppVersions = Array.from(consolidatedAppVersions).sort((a, b) => a[0].localeCompare(b[0]));

        TimeTracker.stop('Result Consolidation');

        // --- Persist Data ---
        TimeTracker.start('Persisting & UI Render');
        // Persist data asynchronously, don't wait for it.
        saveData('logData', originalLogLines);
        saveData('fileName', currentZipFileName);

        // --- Finalize UI ---
        minLogDate = consolidatedMinTimestamp ? logcatToDate(consolidatedMinTimestamp) : null;
        maxLogDate = consolidatedMaxTimestamp ? logcatToDate(consolidatedMaxTimestamp) : null;
        logTags = Array.from(consolidatedTagSet).sort();
        initializeTimeFilter(consolidatedMinTimestamp, consolidatedMaxTimestamp);

        // Render the stats and highlights that were calculated by the workers
        renderStats(finalStats);
        renderHighlights(finalHighlights);

        // Process and render secondary dashboard stats like CPU, Temp, and App Versions
        const dashboardStats = processForDashboardStats();
        renderDashboardStats(dashboardStats);        
        renderAppVersions(allAppVersions);
        renderTemperaturePlot(dashboardStats.temperatureDataPoints);
        renderCpuPlot(dashboardStats.cpuDataPoints);
        renderBatteryPlot(consolidatedBatteryDataPoints);

        // The initial render is now handled by a direct call to applyFilters,
        // which is the correct way to populate the log view for the first time.
        applyFilters(true);
        
        // Reset the processing flag now that everything is complete
        progressText.textContent = 'Complete!';
        isProcessing = false;

    }

    /**
     * NEW: Master refresh function. Detects the active tab and calls its
     * specific filtering and rendering function. This is now the central
     * point for all UI updates triggered by filter changes.
     */
    async function refreshActiveTab() {
        const activeTabId = document.querySelector('.tab-btn.active')?.dataset.tab;

        switch (activeTabId) {
            case 'logs':
                applyFilters();
                break;
            case 'ble':
                if (!bleScrollListenerAttached) setupBleTab(); else renderBleVirtualLogs();
                break;
            case 'nfc':
                if (!nfcScrollListenerAttached) setupNfcTab(); else renderNfcVirtualLogs();
                break;
            case 'dck':
                if (!dckScrollListenerAttached) setupDckTab(); else renderDckVirtualLogs();
                break;
            case 'kernel':
                processForKernel(); // This function already includes filtering
                break;
            case 'btsnoop':
                // OPTIMIZATION: Parse btsnoop logs just-in-time on the first visit to the tab.
                // On subsequent visits, the data is already in memory and renders instantly.
                if (btsnoopPackets.length === 0 && fileTasks.length > 0) {
                    await processForBtsnoop(); // This happens only once.
                }
                // Now that data is guaranteed to be parsed, set up and render.
                setupBtsnoopTab(); 
                break;
            // 'stats' tab has its own update mechanisms and doesn't need a call here.
        }
    }

    /**
     * A generic filtering function that applies the main filters (keyword, level, time)
     * to a given set of log lines. This is the new core of the filtering system.
     * @param {Array} linesToFilter The array of log line objects to filter.
     * @returns {Array} A new array containing only the lines that pass the filters.
     */
    function applyMainFilters(linesToFilter) {
        const activeKeywords = filterKeywords.filter(kw => kw.active).map(kw => kw.text);
        const keywordRegexes = activeKeywords.length > 0 ? activeKeywords.map(wildcardToRegex) : null;
        const liveSearchRegex = liveSearchQuery ? wildcardToRegex(liveSearchQuery) : null;
        const startTime = startTimeInput.value ? new Date(startTimeInput.value) : null;
        const endTime = endTimeInput.value ? new Date(endTimeInput.value) : null;

        let isInsideCollapsedSection = false;
        const results = [];

        for (const line of linesToFilter) {
            // Always include file headers in the results, and update the collapsed state.
            if (line.isMeta) {
                isInsideCollapsedSection = collapsedFileHeaders.has(line.originalText);
                results.push(line); // Always include headers
                continue;
            }

            // If we are inside a collapsed section, skip this log line.
            if (isInsideCollapsedSection) continue;

            // Now, apply all other filters to the visible lines.
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

            results.push(line); // Line passes all filters
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
    async function applyFilters(force = false) {
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

        if (originalLogLines.length === 0) {
            filteredLogLines = [];
            renderVirtualLogs(logContainer, logSizer, logViewport, []);
            return;
        };

        // Apply main filters to the lines that are not hidden by collapsed sections.
        // This is the correct, unified approach.
        // The main "Logs" tab filters from ALL original lines.
        filteredLogLines = applyMainFilters(originalLogLines);

        // --- Scroll Restoration Logic ---
        // 2. Find the anchor in the new list and scroll to it.
        let newScrollTop = 0;
        // If the user's chosen anchor was filtered out, clear it.
        if (userAnchorLine && !filteredLogLines.includes(userAnchorLine)) {
            userAnchorLine = null;
        }

        if (anchorLine) {
            const newAnchorIndex = filteredLogLines.findIndex(line => line === anchorLine);
            if (newAnchorIndex !== -1) {
                // The anchor line is still visible, scroll to it.
                newScrollTop = newAnchorIndex * LINE_HEIGHT;
            }
            // If the anchor was filtered out, we default to scrolling to the top (newScrollTop = 0).
        }

        // --- Force Layout Reflow ---
        // This is the key fix. By updating the sizer's height and then reading a property
        // like offsetHeight, we force the browser to recalculate the layout immediately.
        // This ensures the new maximum scroll height is known before we set scrollTop.
        logSizer.style.height = `${filteredLogLines.length * LINE_HEIGHT}px`;
        logSizer.offsetHeight; // Reading this property forces the reflow.

        logContainer.scrollTop = newScrollTop;
        // --- End Scroll Restoration ---

        // Now that scroll is set correctly, render the logs immediately.
        renderVirtualLogs(logContainer, logSizer, logViewport, filteredLogLines);

        TimeTracker.stop('Async Filtering');
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
    function renderVirtualLogs(container, sizer, viewport, lines) {
        if (!container || !sizer || !viewport || !lines) return;

        const scrollTop = container.scrollTop;
        const containerHeight = container.clientHeight;

        // Get active keyword regexes for highlighting
        const activeKeywords = filterKeywords.filter(kw => kw.active).map(kw => kw.text);
        const keywordRegexes = activeKeywords.length > 0 ? activeKeywords.map(wildcardToRegex) : null;
        const liveSearchRegex = liveSearchQuery ? wildcardToRegex(liveSearchQuery) : null;

        // Set the total height of the scrollable area
        // Calculate the range of lines to render
        let startIndex = Math.floor(scrollTop / LINE_HEIGHT) - BUFFER_LINES;
        startIndex = Math.max(0, startIndex); // Don't go below 0
        let endIndex = Math.ceil((scrollTop + containerHeight) / LINE_HEIGHT) + BUFFER_LINES;
        endIndex = Math.min(lines.length, endIndex); // Don't go past the end
        // Create the HTML for the visible lines
        let visibleHtml = '';
        for (let i = startIndex; i < endIndex; i++) {
            const line = lines[i];
            let lineText = escapeHtml(line.originalText || line.text);
            let lineClass = 'log-line';
            if (line.isMeta) {
                lineClass += ' log-line-meta';
            } else if (line.level) {
                lineClass += ` log-line-${line.level}`;
            }

            // Apply keyword highlighting
            if (!line.isMeta) {
                if (keywordRegexes) {
                    keywordRegexes.forEach(regex => {
                        lineText = lineText.replace(regex, (match) => `<mark>${match}</mark>`);
                    });
                }
                if (liveSearchRegex) {
                    lineText = lineText.replace(liveSearchRegex, (match) => `<mark class="live-search">${match}</mark>`);
                }
            }
            // Add the copy button, storing the raw text in a data attribute
            const copyButtonHtml = line.isMeta ? '' : `<button class="copy-log-btn" data-log-text="${escapeHtml(line.originalText || line.text)}">📋</button>`;
            // Add a data attribute to identify the line's index in the filtered array
            if (userAnchorLine === line) {
                lineClass += ' selected-anchor';
            }

            // Add collapse/expand indicator for meta lines
            if (line.isMeta) {
                const indicator = collapsedFileHeaders.has(line.originalText) ? '[+] ' : '[-] ';
                lineText = indicator + lineText;
            }
            let lineNumberHtml = '';
            // Only show line numbers for non-meta lines that have a number
            if (!line.isMeta && line.lineNumber) {
                lineNumberHtml = `<span class="line-number">${line.lineNumber}</span>`;
            } else if (!line.isMeta) {
                lineNumberHtml = `<span class="line-number"></span>`; // Keep alignment
            }
            visibleHtml += `<div class="${lineClass}" data-line-index="${i}">${lineNumberHtml}${lineText}${copyButtonHtml}</div>`;
        }

        viewport.innerHTML = visibleHtml;
        // Position the viewport to match the scroll position
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

            button.addEventListener('mousedown', () => {
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
    } else {
        console.warn('HTML element with ID "startTime" not found.');
    }

    if (endTimeInput) {
        endTimeInput.addEventListener('change', () => timeRangeSlider.noUiSlider.set([null, new Date(endTimeInput.value).getTime()]));
    } else {
        console.warn('HTML element with ID "endTime" not found.');
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
    } else {
        console.warn('HTML element with ID "logLevelToggleBtn" not found.');
    }
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
                addKeyword(searchInput.value);
            }
        });

        searchInput.addEventListener('input', () => {
            liveSearchQuery = searchInput.value;
            refreshActiveTab(); // Re-filter on every keystroke

            const query = searchInput.value.toLowerCase();
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
            searchInput.value = '';
            renderUI();
        }
    }

    // Placeholder for time inputs
    // startTimeInput.addEventListener('change', renderUI);
    // endTimeInput.addEventListener('change', renderUI);


    // =================================================================================
    // --- Statistics ---
    // =================================================================================
    // --- Statistics Rendering (data is now pre-calculated by the worker) ---
    function renderStats(stats) {
        if (!stats) return;
        
        logCounts.innerHTML = `<p>Total Lines: <span class="stat-value">${stats.total.toLocaleString()}</span></p>`;

        const totalLogs = stats.total > 0 ? stats.total : 1; // Avoid division by zero
        const createBar = (level, count) => {
            const percentage = (count / totalLogs) * 100;
            return `
                <div class="dist-bar-container">
                    <div class="dist-label">${level} (${percentage.toFixed(1)}%)</div>
                    <div class="dist-bar-wrapper">
                        <div class="dist-bar log-line-${level[0]}" style="width: ${percentage}%;">${count.toLocaleString()}</div>
                    </div>
                </div>
            `;
        };

        errorDistribution.innerHTML = `
            ${createBar('Error', stats.E || 0)}
            ${createBar('Warn', stats.W || 0)}
            ${createBar('Info', stats.I || 0)}
            ${createBar('Debug', stats.D || 0)}
            ${createBar('Verbose', stats.V || 0)}
        `;
    }

    // --- Highlights Processing ---
    function renderHighlights(highlights) {
        if (!highlights || !accountsList || !deviceEventsTable) return;
    
        // Render BLE Keys
        // Clear previous results
        accountsList.innerHTML = '';
        deviceEventsTable.innerHTML = '';
        
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
    
        // Render Device Events
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



    // --- BLE Log Processing ---

    async function setupBleTab() {
        if (!bleScrollListenerAttached && bleLogContainer instanceof HTMLElement) {
            bleLogContainer.addEventListener('scroll', renderBleVirtualLogs);
            bleScrollListenerAttached = true;
        }
        applyBleFilters();
    }
    function applyBleFilters() {
        const layerKeywords = {
            manager: /BluetoothManager|BluetoothAdapter/i,
            gatt: /GATT|BtGatt/i,
            smp: /SMP/i,
            hci: /HCI/i
        };

        let filteredLines = bleLogLines; // Start with all BLE lines

        // 1. Apply specialized layer filters
        if (activeBleLayers.size === 0) {
            filteredLines = [];
        } else {
            // Only apply layer filters if NOT all layers are selected.
            if (activeBleLayers.size < bleFilterButtons.length) {
                filteredLines = filteredLines.filter(line => {
                    if (line.isMeta) return true; // Always include file headers
                    return Array.from(activeBleLayers).some(layer => layerKeywords[layer]?.test(line.originalText));
                });
            }
        }
        // 2. Apply main filters (keyword, level, time) to the result of the layer filters
        filteredBleLogLines = applyMainFilters(filteredLines);

        if (bleLogContainer) bleLogContainer.scrollTop = 0;
        if (bleLogSizer) {
            bleLogSizer.style.height = `${filteredBleLogLines.length * LINE_HEIGHT}px`;
        }
        renderBleVirtualLogs();
    }

    function renderBleVirtualLogs() {
        renderVirtualLogs(bleLogContainer, bleLogSizer, bleLogViewport, filteredBleLogLines);
    }

    async function setupDckTab() {
        if (!dckScrollListenerAttached && dckLogContainer instanceof HTMLElement) {
            dckLogContainer.addEventListener('scroll', renderDckVirtualLogs);
            dckScrollListenerAttached = true;
        }
        applyDckFilters();
    }

    function applyDckFilters() {
        const layerKeywords = {
            // Correct DCK Layer Keywords
            manager: /DigitalCarKeyManager|CarKey|Dck/i, // High-level framework
            hal: /UwbTransport|UwbConnector|IDigitalCarKey/i, // HAL and transport layers
            oem: /oem-dck|vendor.google.automotive.dck/i // OEM-specific logs
        };

        let filteredLines = dckLogLines;

        // 1. Apply specialized layer filters
        if (activeDckLayers.size === 0) {
            filteredLines = [];
        } else {
            // Only apply layer filters if NOT all layers are selected.
            if (activeDckLayers.size < dckFilterButtons.length) {
                filteredLines = filteredLines.filter(line => {
                    if (line.isMeta) return true; // Always include file headers
                    return Array.from(activeDckLayers).some(layer => layerKeywords[layer]?.test(line.originalText));
                });
            }
        }
        // 2. Apply main filters to the result
        filteredDckLogLines = applyMainFilters(filteredLines);

        if (dckLogContainer) dckLogContainer.scrollTop = 0;
        if (dckLogSizer) {
            dckLogSizer.style.height = `${filteredDckLogLines.length * LINE_HEIGHT}px`;
        }
        renderDckVirtualLogs();
    }

    function renderDckVirtualLogs() {
        renderVirtualLogs(dckLogContainer, dckLogSizer, dckLogViewport, filteredDckLogLines);
    }

    async function setupNfcTab() {
        if (!nfcScrollListenerAttached && nfcLogContainer instanceof HTMLElement) {
            nfcLogContainer.addEventListener('scroll', renderNfcVirtualLogs);
            nfcScrollListenerAttached = true;
        }
        applyNfcFilters();
    }

    function applyNfcFilters() {
        const layerKeywords = {
            framework: /NfcManager|NfcService|TagDispatcher|NfcTag/i,
            hce: /HostEmulationManager|ApduServiceInfo/i,
            p2p: /P2pLinkManager/i,
            hal: /NxpNci|NxpExtns|libnfc|libnfc-nci/i
        };

        let filteredLines = nfcLogLines;

        // 1. Apply specialized layer filters
        // If no layers are active, show nothing.
        if (activeNfcLayers.size === 0) {
            filteredLines = [];
        } else {
            // Only apply layer filters if NOT all layers are selected.
            if (activeNfcLayers.size < nfcFilterButtons.length) { 
                filteredLines = filteredLines.filter(line => {
                    if (line.isMeta) return true; // Always include file headers
                    return Array.from(activeNfcLayers).some(layer => layerKeywords[layer]?.test(line.originalText));
                });
            }
        }
        // 2. Apply main filters to the result
        filteredNfcLogLines = applyMainFilters(filteredLines);

        if (nfcLogContainer) nfcLogContainer.scrollTop = 0;
        if (nfcLogSizer) {
            nfcLogSizer.style.height = `${filteredNfcLogLines.length * LINE_HEIGHT}px`;
        }
        renderNfcVirtualLogs();
    }

    function renderNfcVirtualLogs() {
        renderVirtualLogs(nfcLogContainer, nfcLogSizer, nfcLogViewport, filteredNfcLogLines);
    }

    // --- Kernel Log Processing ---
    async function processForKernel() {
        // OPTIMIZATION: This function is now much simpler. It just applies filters
        // to the pre-populated kernelLogLines array.
        if (!kernelScrollListenerAttached && kernelLogContainer instanceof HTMLElement) {
            kernelLogContainer.addEventListener('scroll', renderKernelVirtualLogs);
            kernelScrollListenerAttached = true;
        }
        
        // FIX: For kernel logs, we show everything found without sub-filters for now.
        // It should still respect the main filters.
        filteredKernelLogLines = applyMainFilters(kernelLogLines);

        if (kernelLogSizer) {
            kernelLogSizer.style.height = `${filteredKernelLogLines.length * LINE_HEIGHT}px`;
        }
        if (kernelLogContainer) kernelLogContainer.scrollTop = 0;
        renderKernelVirtualLogs();
    }

    function renderKernelVirtualLogs() {
        renderVirtualLogs(kernelLogContainer, kernelLogSizer, kernelLogViewport, filteredKernelLogLines);
    }
    // --- BTSnoop Tab Setup ---
    async function setupBtsnoopTab() {
        if (!btsnoopScrollListenerAttached && btsnoopLogContainer instanceof HTMLElement) {
            // Use the generic render function, throttled for performance.
            btsnoopLogContainer.addEventListener('scroll', () => {
                if (!btsnoopScrollThrottleTimer) {
                    btsnoopScrollThrottleTimer = setTimeout(() => {
                        renderBtsnoopVirtualLogs();
                        btsnoopScrollThrottleTimer = null;
                    }, 50); // Throttle to 50ms
                }
            });
            btsnoopScrollListenerAttached = true;
        }
        // Initial render when tab is first set up
        renderBtsnoopPackets(btsnoopConnectionMap, activeBtsnoopFilters);
    }
    // --- BTSnoop Log Processing ---
    async function processForBtsnoop() {
        TimeTracker.start('BTSnoop Processing');
        const initialView = document.getElementById('btsnoopInitialView');
        const contentView = document.getElementById('btsnoopContentView');
        const filterContainer = document.getElementById('btsnoopFilterContainer');
        const exportBtn = document.getElementById('exportBtsnoopXlsxBtn');

        // If the view elements don't exist, we can't proceed with UI updates.
        if (!initialView || !contentView || !filterContainer || !exportBtn) {
            TimeTracker.stop('BTSnoop Processing');
            return; // Exit if the tab hasn't been rendered in the DOM yet.
        }

        // Find ALL btsnoop files to concatenate them.
        const btsnoopTasks = fileTasks.filter(task =>
            /btsnoop_hci\.log.*/.test(task.path)
        );

        if (btsnoopTasks.length === 0) {
            // Don't log processing time if there's nothing to do.
            TimeTracker.stop('BTSnoop Processing');
            return;
        }

        // If parsing has already happened, don't do it again.
        if (btsnoopPackets.length > 0) {
            TimeTracker.stop('BTSnoop Processing');
            return;
        }

        btsnoopConnectionMap.clear(); // Clear previous connection data
        btsnoopConnectionEvents = []; // Clear previous connection events
        initialView.innerHTML = `<p>Found ${btsnoopTasks.length} btsnoop file(s). Parsing packets...</p>`;

        try {
            // Read all found btsnoop files into buffers.
            const bufferPromises = btsnoopTasks.map(task => (task.file || task.blob).arrayBuffer());
            const buffers = await Promise.all(bufferPromises);

            let finalBuffer;
            if (buffers.length === 1) {
                finalBuffer = buffers[0];
            } else {
                // Concatenate buffers, keeping the header of the first file only.
                let totalSize = buffers[0].byteLength;
                for (let i = 1; i < buffers.length; i++) {
                    totalSize += (buffers[i].byteLength - 16); // Subtract 16 bytes for the header
                }

                const finalArray = new Uint8Array(totalSize);
                let offset = 0;

                finalArray.set(new Uint8Array(buffers[0]), offset);
                offset += buffers[0].byteLength;

                for (let i = 1; i < buffers.length; i++) {
                    const dataPart = new Uint8Array(buffers[i], 16); // Get data after the header
                    finalArray.set(dataPart, offset);
                    offset += dataPart.byteLength;
                }
                finalBuffer = finalArray.buffer;
            }

            const buffer = finalBuffer;
            const dataView = new DataView(buffer);

            // Check file header
            const magic = new TextDecoder().decode(buffer.slice(0, 8));
            if (magic !== 'btsnoop\0') {
                throw new Error('Invalid btsnoop file format.');
            }

            let offset = 16; // Skip 16-byte file header
            let packetNumber = 1;
            const BTSNOOP_EPOCH_DELTA = 0x00dcddb30f2f8000n; // Delta between Unix and BTSnoop epochs

            while (offset < buffer.byteLength) {
                if (offset + 24 > buffer.byteLength) break; // Not enough data for a packet header

                const includedLength = dataView.getUint32(offset + 4, false);
                const flags = dataView.getUint32(offset + 12, false);
                const timestampMicro = dataView.getBigUint64(offset + 16, false);

                const timestampMs = Number(timestampMicro - BTSNOOP_EPOCH_DELTA) / 1000;
                const date = new Date(timestampMs);
                const timestampStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}.${date.getMilliseconds().toString().padStart(3, '0')}`;

                offset += 24; // Move to packet data
                if (offset + includedLength > buffer.byteLength) break;

                const packetData = new Uint8Array(buffer, offset, includedLength);
                const direction = (flags & 1) === 0 ? 'Host -> Controller' : 'Controller -> Host';

                const interpretation = interpretHciPacket(packetData, btsnoopConnectionMap, btsnoopPackets.length + 1, direction);

                // If this was an LE Connection Complete event, add it to our special list for the stats page
                if (interpretation.isConnectionComplete) {
                    btsnoopConnectionEvents.push({
                        ...interpretation.connectionInfo,
                        timestamp: timestampStr,
                        rawData: interpretation.data
                    });
                }

                btsnoopPackets.push({
                    ...interpretation, // Spread the interpretation results
                    number: packetNumber++,
                    timestamp: timestampStr,
                    tags: interpretation.tags,
                    direction,
                    type: interpretation.type,
                    summary: interpretation.summary,
                    data: interpretation.data
                });

                offset += includedLength;
            }

            // --- Post-processing pass to resolve forward-referenced handles ---
            for (const packet of btsnoopPackets) {
                // Check if the source or destination is an unresolved handle
                const sourceIsHandle = packet.source && packet.source.startsWith('Handle:');
                const destIsHandle = packet.destination && packet.destination.startsWith('Handle:');

                if (sourceIsHandle || destIsHandle) {
                    // The handle was already extracted and stored during the first pass
                    if (packet.handle !== null && btsnoopConnectionMap.has(packet.handle)) {
                        const resolvedAddress = btsnoopConnectionMap.get(packet.handle).address;
                        if (sourceIsHandle) {
                            packet.source = resolvedAddress;
                        }
                        if (destIsHandle) {
                            packet.destination = resolvedAddress;
                        }
                    }
                }
            }

            // Now that data is parsed, update the UI to show the content view.
            initialView.style.display = 'none';
            contentView.style.display = 'block';
            filterContainer.style.display = 'block';
            exportBtn.style.display = 'block';

            // Render the packets and the connection events table on the Stats page.
            renderBtsnoopPackets(btsnoopConnectionMap, activeBtsnoopFilters); // Initial render
            renderBtsnoopConnectionEvents(); // Render the new table on the Stats page
        } catch (error) {
            console.error('Error processing btsnoop log:', error);
            initialView.style.display = 'block';
            initialView.innerHTML = `<p>Error: ${error.message}</p>`;
        }

        TimeTracker.stop('BTSnoop Processing');
    }

    function renderBtsnoopConnectionEvents() {
        if (!btsnoopConnectionEventsTable) return;

        if (btsnoopConnectionEvents.length === 0) {
            btsnoopConnectionEventsTable.innerHTML = '<tr><td colspan="5">No LE Connection Complete events found.</td></tr>';
            return;
        }

        let tableHtml = '';
        for (const event of btsnoopConnectionEvents) {
            tableHtml += `<tr>
                <td>${event.packetNum}</td>
                <td>${event.timestamp}</td>
                <td>${event.handle}</td>
                <td>${event.address}</td>
                <td class="log-line-cell">${escapeHtml(event.rawData)}</td>
            </tr>`;
        }
        btsnoopConnectionEventsTable.innerHTML = tableHtml;
    }

    function interpretHciPacket(data, connectionMap, packetNum, direction) {
        if (data.length === 0) return { type: 'Empty', summary: 'Empty Packet', tags: [], sourceDest: '', data: '', bleKeys: null, number: packetNum };
        const packetType = data[0];
        const tags = [];
        const hexData = Array.from(data, byte => byte.toString(16).padStart(2, '0')).join(' ');
        let source = 'Host';
        let destination = 'Controller';

        switch (packetType) {
            case 0x01: // Command
                tags.push('cmd');
                // Commands are always Host -> Controller
                if (data.length < 4) return { type: 'HCI Command', summary: 'Malformed', tags, source, destination, data: hexData, bleKeys: null, number: packetNum };
                const opcode = (data[2] << 8) | data[1];
                const paramLength = data[3];
                const opName = HCI_COMMANDS[opcode] || `Unknown OpCode: 0x${opcode.toString(16).padStart(4, '0')}`;
                return { type: 'HCI Command', summary: `${opName}, Length: ${paramLength}`, tags, source, destination, data: hexData, bleKeys: null, number: packetNum };
            case 0x02: // ACL Data
                tags.push('acl');
                if (data.length < 5) return { type: 'ACL Data', summary: 'Malformed', tags, source, destination, data: hexData, bleKeys: null, number: packetNum };
                const handle = ((data[2] & 0x0F) << 8) | data[1]; // The handle is in the first 12 bits of these two bytes.
                const dataLength = (data[4] << 8) | data[3];
                // Use the mapped address if available, otherwise show the handle
                if (direction === 'Controller -> Host') {
                    source = `Handle: 0x${handle.toString(16)}`;
                } else {
                    destination = `Handle: 0x${handle.toString(16)}`;
                }

                // This packet has a handle, which will be resolved in the post-processing pass.

                let aclSummary = `Length: ${dataLength}`;

                // L2CAP Parsing
                if (data.length >= 9) {
                    tags.push('l2cap');
                    const l2capLength = (data[6] << 8) | data[5];
                    const cid = (data[8] << 8) | data[7];
                    aclSummary += `, L2CAP Len: ${l2capLength}, CID: ${L2CAP_CIDS[cid] || '0x' + cid.toString(16)}`;

                    if (cid === 0x0004 && data.length >= 10) { // ATT
                        tags.push('att');
                        const attOpcode = data[9];
                        aclSummary += ` > ATT: ${ATT_OPCODES[attOpcode] || 'Op ' + attOpcode.toString(16)}`;
                    } else if (cid === 0x0006 && data.length >= 10) { // SMP
                        tags.push('smp');
                        const smpCode = data[9];
                        const smpData = data.slice(10);
                        aclSummary += ` > SMP: ${SMP_CODES[smpCode] || 'Code ' + smpCode.toString(16)}`;
                        // Restore Key Extraction Logic
                        if (smpCode === 0x06 /* Encryption Information */ && smpData.length >= 16) {
                            const ltk = Array.from(smpData.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join('');
                            aclSummary += ` (LTK: ${ltk.substring(0, 8)}...)`;
                            // FIX: Return the packet with the extracted LTK.
                            return { type: 'ACL Data', summary: aclSummary, tags, source, destination, data: hexData, bleKeys: { type: 'LTK', value: ltk }, number: packetNum, handle: handle };
                        } else if (smpCode === 0x08 /* Identity Information */ && smpData.length >= 16) {
                            const irk = Array.from(smpData.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join('');
                            // FIX: Include the handle in the return object for consistency.
                            return { type: 'ACL Data', summary: aclSummary, tags, source, destination, data: hexData, bleKeys: { type: 'IRK', value: irk }, number: packetNum, handle: handle };
                        }
                    }
                }
                return { type: 'ACL Data', summary: aclSummary, tags, source, destination, data: hexData, bleKeys: null, number: packetNum, handle: handle };
            case 0x04: // Event
                tags.push('evt');
                if (data.length < 3) return { type: 'HCI Event', summary: 'Malformed', tags, source, destination, data: hexData, bleKeys: null, number: packetNum };
                const eventCode = data[1];
                const eventLength = data[2];
                let summary = `${HCI_EVENTS[eventCode] || 'Unknown Event'}, Length: ${eventLength}`;
                if (eventCode === 0x0E && data.length >= 7) { // Command Complete
                    const cmdOpcode = (data[5] << 8) | data[4];
                    summary += ` (for ${HCI_COMMANDS[cmdOpcode] || '0x' + cmdOpcode.toString(16)})`;
                } else if (eventCode === 0x0F && data.length >= 5) { // Command Status
                    const status = data[3];
                    const cmdOpcode = (data[5] << 8) | data[4];
                    summary += ` (Status: ${status === 0 ? 'OK' : 'Error'} for 0x${cmdOpcode.toString(16)})`;
                } else if (eventCode === 0x3E && data.length >= 4) { // LE Meta Event
                    const subEventCode = data[3];
                    summary += ` > ${LE_META_EVENTS[subEventCode] || 'Unknown Sub-event'}`;
                    // FIX: Handle both legacy (0x01) and enhanced (0x0A) connection complete events.
                    if ((subEventCode === 0x01 || subEventCode === 0x0A) && data.length >= 15) {
                        const connectionHandle = (data[6] << 8) | data[5];
                        const peerAddress = Array.from(data.slice(9, 15)).reverse().map(b => b.toString(16).padStart(2, '0')).join(':').toUpperCase();
                        if (connectionHandle) {
                            connectionMap.set(connectionHandle, { address: peerAddress, packetNum: packetNum });
                        }
                        destination = peerAddress;
                        // This is the event we want to capture for the stats page.
                        // Return extra info so the caller can store it.
                        return {
                            type: 'HCI Event', summary, tags, source, destination, data: hexData, bleKeys: null, number: packetNum, handle: null,
                            isConnectionComplete: true,
                            connectionInfo: {
                                packetNum: packetNum,
                                handle: `0x${connectionHandle.toString(16).padStart(4, '0')}`,
                                address: peerAddress
                            }
                        };
                    }
                }
                return { type: 'HCI Event', summary, tags, source, destination, data: hexData, bleKeys: null, number: packetNum, handle: null };
            default:
                return { type: `Unknown (0x${packetType.toString(16)})`, summary: 'Unknown packet type', tags, source, destination, data: hexData, bleKeys: null, number: packetNum, handle: null };
        }
    }

    function renderBtsnoopPackets(connMap, currentActiveFilters) {
        // Get all active column filters first
        const columnFilters = Array.from(btsnoopColumnFilters)
            .map(input => ({
                index: parseInt(input.dataset.column, 10),
                value: input.value.toLowerCase()
            }))
            .filter(f => f.value);

        // Combine button and text filters in a single pass for correct AND logic
        filteredBtsnoopPackets = btsnoopPackets.filter(p => {
            // 1. Check button filters first
            const primaryTag = p.tags[0];
            if (!currentActiveFilters.has(primaryTag)) {
                return false;
            }
            if (primaryTag === 'acl') {
                const subTags = p.tags.slice(1);
                if (subTags.length > 0 && !subTags.some(t => currentActiveFilters.has(t))) {
                    return false;
                }
            }

            // 2. If it passes button filters, check column text filters
            if (columnFilters.length > 0) {
                const passesAllColumnFilters = columnFilters.every(filter => {
                    const cellValue = [p.number, p.timestamp, p.source || '', p.destination || '', p.type, p.summary, p.data][filter.index];
                    return cellValue.toString().toLowerCase().includes(filter.value);
                });
                if (!passesAllColumnFilters) return false;
            }

            // If we get here, the packet passes all active filters
            return true;
        });

        // Reset scroll and update sizer height
        if (btsnoopLogContainer) btsnoopLogContainer.scrollTop = 0;
        if (btsnoopLogSizer) {
            btsnoopLogSizer.style.height = `${filteredBtsnoopPackets.length * LINE_HEIGHT}px`;
        }
        renderBtsnoopVirtualLogs();
    }

    function renderBtsnoopVirtualLogs() {
        if (!btsnoopLogContainer || !btsnoopLogSizer || !btsnoopLogViewport) return;

        const scrollTop = btsnoopLogContainer.scrollTop;
        const containerHeight = btsnoopLogContainer.clientHeight;

        let startIndex = Math.floor(scrollTop / LINE_HEIGHT) - BUFFER_LINES;
        startIndex = Math.max(0, startIndex);
        let endIndex = Math.ceil((scrollTop + containerHeight) / LINE_HEIGHT) + BUFFER_LINES;
        endIndex = Math.min(filteredBtsnoopPackets.length, endIndex);

        const numVisibleRows = endIndex - startIndex;

        // --- Smart DOM Element Recycling ---
        while (btsnoopRowPool.length < numVisibleRows) {
            const row = document.createElement('div');
            row.className = 'btsnoop-row';
            for (let j = 0; j < 7; j++) {
                row.appendChild(document.createElement('div'));
            }
            btsnoopRowPool.push(row);
            btsnoopLogViewport.appendChild(row);
        }

        for (let i = 0; i < btsnoopRowPool.length; i++) {
            const row = btsnoopRowPool[i];
            if (i < numVisibleRows) {
                const packetIndex = startIndex + i;
                const packet = filteredBtsnoopPackets[packetIndex];
                const cells = row.children;

                cells[0].className = 'btsnoop-cell'; cells[0].textContent = packet.number;
                cells[1].className = 'btsnoop-cell'; cells[1].textContent = packet.timestamp;
                cells[2].className = 'btsnoop-cell'; cells[2].textContent = escapeHtml(packet.source || (packet.direction === 'Controller -> Host' ? 'Controller' : 'Host'));
                cells[3].className = 'btsnoop-cell'; cells[3].textContent = escapeHtml(packet.destination || (packet.direction === 'Host -> Controller' ? 'Controller' : 'Host'));
                cells[4].className = 'btsnoop-cell'; cells[4].textContent = packet.type;
                cells[5].className = 'btsnoop-cell'; cells[5].textContent = escapeHtml(packet.summary);
                cells[6].className = 'btsnoop-cell log-line-cell'; cells[6].textContent = escapeHtml(packet.data);

                row.style.transform = `translateY(${packetIndex * LINE_HEIGHT}px)`;
                row.style.display = 'flex';
            } else {
                row.style.display = 'none';
            }
        }
    }

    // Attach listeners for the new column filters
    const btsnoopFiltersContainer = document.querySelector('.btsnoop-column-filters');
    if (btsnoopFiltersContainer) {
        btsnoopFiltersContainer.addEventListener('input', (e) => {
            clearTimeout(btsnoopColumnFilterDebounceTimer);
            btsnoopColumnFilterDebounceTimer = setTimeout(() => {
                if (e.target.tagName === 'INPUT') {
                    // Pass the connection map and the CURRENT active filters
                    renderBtsnoopPackets(btsnoopConnectionMap, activeBtsnoopFilters);
                }
            }, 300); // 300ms debounce delay
        });
    }

    // --- Dictionaries for HCI Parsing ---
    const HCI_COMMANDS = { 0x200C: 'LE Set Scan Enable', 0x200B: 'LE Set Scan Parameters', 0x2006: 'LE Set Advertising Parameters', 0x200A: 'LE Set Advertising Enable', 0x200D: 'LE Create Connection' };
    const HCI_EVENTS = { 0x0E: 'Command Complete', 0x0F: 'Command Status', 0x3E: 'LE Meta Event' };
    const LE_META_EVENTS = { 0x01: 'LE Connection Complete', 0x02: 'LE Advertising Report', 0x0A: 'LE Connection Update Complete' };
    const L2CAP_CIDS = { 0x0004: 'ATT', 0x0005: 'LE Signaling', 0x0006: 'SMP' };
    const ATT_OPCODES = { 0x01: 'Error Rsp', 0x02: 'Exchange MTU Req', 0x03: 'Exchange MTU Rsp', 0x04: 'Find Info Req', 0x05: 'Find Info Rsp', 0x08: 'Read By Type Req', 0x09: 'Read By Type Rsp', 0x0A: 'Read Req', 0x0B: 'Read Rsp', 0x0C: 'Read Blob Req', 0x0D: 'Read Blob Rsp', 0x10: 'Read By Group Type Req', 0x11: 'Read By Group Type Rsp', 0x12: 'Write Req', 0x13: 'Write Rsp', 0x52: 'Write Cmd', 0x1B: 'Notification', 0x1D: 'Indication', 0x1E: 'Confirmation' };
    const SMP_CODES = { 0x01: 'Pairing Req', 0x02: 'Pairing Rsp', 0x03: 'Pairing Confirm', 0x04: 'Pairing Random', 0x05: 'Pairing Failed', 0x06: 'Encryption Info (LTK)', 0x07: 'Master Identification', 0x08: 'Identity Info (IRK)' };

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
        } else if (target.closest('.log-line-meta')) {
            // Handle collapsing/expanding file logs in ANY viewport
            const lineDiv = target.closest('.log-line-meta');
            const lineIndex = parseInt(lineDiv.dataset.lineIndex, 10);
            const activeViewport = target.closest('.log-viewport');
            let sourceArray = filteredLogLines; // Default to main logs

            if (activeViewport === bleLogViewport) sourceArray = filteredBleLogLines;
            else if (activeViewport === nfcLogViewport) sourceArray = filteredNfcLogLines;
            else if (activeViewport === dckLogViewport) sourceArray = filteredDckLogLines;
            else if (activeViewport === kernelLogViewport) sourceArray = filteredKernelLogLines;

            if (!isNaN(lineIndex) && sourceArray[lineIndex]) {
                const clickedLine = sourceArray[lineIndex];
                if (collapsedFileHeaders.has(clickedLine.originalText)) {
                    collapsedFileHeaders.delete(clickedLine.originalText);
                } else {
                    collapsedFileHeaders.add(clickedLine.originalText);
                }
                // Re-apply the correct filter function for the active tab
                if (activeViewport === bleLogViewport) applyBleFilters();
                else if (activeViewport === nfcLogViewport) applyNfcFilters();
                else if (activeViewport === dckLogViewport) applyDckFilters();
                else if (activeViewport === kernelLogViewport) processForKernel(); // Kernel has no sub-filters
                else applyFilters(true); // Main log view

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
                renderVirtualLogs(logContainer, logSizer, logViewport, filteredLogLines);
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
        await openDb(); // Ensure the database is open before any other operations.
        initializeDynamicElements(); // FIX: Initialize elements on startup to prevent null references.
        injectLogLevelStyles();
        // Check for a persisted session. If one is found and rendered, this will return true.
        await checkForPersistedFilters();
        const sessionRestored = await checkForPersistedLogs();
        if (!sessionRestored) {
            await applyFilters();
        }

    }

    initializeApp();
});