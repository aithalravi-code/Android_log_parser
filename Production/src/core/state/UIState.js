/**
 * UIState - Manages UI-specific state
 * Controls UI behavior, selection, and display state
 */
export class UIState {
    constructor() {
        // File info
        this.currentFileName = '';

        // Table state
        this.tableSortState = {}; // tableId -> {column, order}
        this.selectedTableRows = new Map(); // tableId -> selectedRowId

        // Collapse state for different views
        this.collapseState = {
            logView: new Set(),           // Collapsed headers in main logs
            connectivityView: new Set(),  // Collapsed headers in connectivity view
            btsnoopFiles: new Set()       // Collapsed BTSnoop files
        };

        // User anchors/selection
        this.userAnchorLine = null;         // Selected log line object
        this.btsnoopAnchorPacket = null;    // Selected BTSnoop packet number

        // Tab loading state (lazy loading optimization)
        this.tabsLoaded = {
            logs: true,         // Main logs always loaded
            connectivity: false,
            btsnoop: false,
            ccc: false,
            stats: false
        };

        // Time filter state
        this.timeFilter = {
            min: null,
            max: null,
            isActive: false
        };

        // Scroll listener flags (to prevent duplicate attachments)
        this.scrollListeners = {
            ble: false,
            nfc: false,
            dck: false,
            kernel: false,
            btsnoop: false,
            connectivity: false
        };

        // Processing flags
        this.isProcessing = false;

        // Debounce timers
        this.timers = {
            save: null,
            filter: null,
            mainScroll: null,
            btsnoopScroll: null,
            btsnoopColumnFilter: null
        };
    }

    /**
     * Reset UI state to defaults
     */
    reset() {
        this.currentFileName = '';
        this.tableSortState = {};
        this.selectedTableRows.clear();

        // Clear collapse states
        Object.keys(this.collapseState).forEach(key => {
            this.collapseState[key].clear();
        });

        this.userAnchorLine = null;
        this.btsnoopAnchorPacket = null;

        // Reset tab loading (keep logs as loaded)
        this.tabsLoaded = {
            logs: true,
            connectivity: false,
            btsnoop: false,
            ccc: false,
            stats: false
        };

        this.timeFilter = {
            min: null,
            max: null,
            isActive: false
        };

        // Reset scroll listeners
        Object.keys(this.scrollListeners).forEach(key => {
            this.scrollListeners[key] = false;
        });

        this.isProcessing = false;

        // Clear timers
        Object.keys(this.timers).forEach(key => {
            if (this.timers[key]) {
                clearTimeout(this.timers[key]);
                this.timers[key] = null;
            }
        });
    }

    /**
     * Mark tab as loaded
     */
    markTabLoaded(tabId) {
        if (this.tabsLoaded.hasOwnProperty(tabId)) {
            this.tabsLoaded[tabId] = true;
        }
    }

    /**
     * Check if tab is loaded
     */
    isTabLoaded(tabId) {
        return this.tabsLoaded[tabId] === true;
    }

    /**
     * Toggle collapse state for a header
     */
    toggleCollapse(view, headerText) {
        const collapseSet = this.collapseState[view];
        if (!collapseSet) {
            return;
        }

        if (collapseSet.has(headerText)) {
            collapseSet.delete(headerText);
        } else {
            collapseSet.add(headerText);
        }
    }

    /**
     * Check if header is collapsed
     */
    isCollapsed(view, headerText) {
        const collapseSet = this.collapseState[view];
        return collapseSet ? collapseSet.has(headerText) : false;
    }
}
