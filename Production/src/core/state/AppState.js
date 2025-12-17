/**
 * AppState - Central application state container
 * Aggregates all sub-state modules into a single coherent state tree
 */
import { LogState } from './LogState.js';
import { FilterState } from './FilterState.js';
import { UIState } from './UIState.js';

class AppState {
    constructor() {
        // Sub-state modules
        this.log = new LogState();
        this.filter = new FilterState();
        this.ui = new UIState();

        // BTSnoop/Bluetooth state
        this.btsnoop = {
            packets: [],
            filteredPackets: [],
            connectionEvents: [],
            connectionMap: new Map(),
            localAddress: 'Host',
            rowPositions: [],
            totalHeight: 0,
            sortColumn: 1, // Timestamp column
            sortOrder: 'desc',
            isProcessed: false
        };

        // Processing/Worker state
        this.processing = {
            batteryDataPoints: [],
            thermalDataPoints: [],
            appVersions: [],
            fileTasks: [],
            zipEntries: [],
            workerVersion: 6
        };
    }

    /**
     * Reset entire application state
     */
    reset() {
        this.log.reset();
        this.filter.reset();
        this.ui.reset();

        // Reset BTSnoop
        this.btsnoop.packets = [];
        this.btsnoop.filteredPackets = [];
        this.btsnoop.connectionEvents = [];
        this.btsnoop.connectionMap.clear();
        this.btsnoop.localAddress = 'Host';
        this.btsnoop.rowPositions = [];
        this.btsnoop.totalHeight = 0;
        this.btsnoop.sortColumn = 1;
        this.btsnoop.sortOrder = 'desc';
        this.btsnoop.isProcessed = false;

        // Reset processing
        this.processing.batteryDataPoints = [];
        this.processing.thermalDataPoints = [];
        this.processing.appVersions = [];
        this.processing.fileTasks = [];
        this.processing.zipEntries = [];
    }

    /**
     * Get a snapshot of current state for debugging
     */
    getSnapshot() {
        return {
            log: {
                totalLines: this.log.totalLines,
                filteredCount: this.log.filteredCount,
                technologies: Object.keys(this.log.byTechnology).map(tech => ({
                    name: tech,
                    count: this.log.byTechnology[tech].length
                })),
                cccMessageCount: this.log.cccMessages.length,
                tagCount: this.log.tags.length
            },
            filter: {
                activeKeywords: this.filter.activeKeywordCount,
                liveSearch: this.filter.liveSearchQuery,
                activeLevels: Array.from(this.filter.activeLevels),
                isAndLogic: this.filter.isAndLogic,
                hasActiveFilters: this.filter.hasActiveFilters
            },
            ui: {
                currentFile: this.ui.currentFileName,
                loadedTabs: Object.entries(this.ui.tabsLoaded)
                    .filter(([_, loaded]) => loaded)
                    .map(([tab]) => tab),
                isProcessing: this.ui.isProcessing,
                hasTimeFilter: this.ui.timeFilter.isActive
            },
            btsnoop: {
                packetCount: this.btsnoop.packets.length,
                filteredCount: this.btsnoop.filteredPackets.length,
                connectionEventCount: this.btsnoop.connectionEvents.length,
                isProcessed: this.btsnoop.isProcessed
            },
            processing: {
                batteryPoints: this.processing.batteryDataPoints.length,
                thermalPoints: this.processing.thermalDataPoints.length,
                appVersions: this.processing.appVersions.length,
                pendingTasks: this.processing.fileTasks.length
            }
        };
    }

    /**
     * Log current state snapshot to console
     */
    logState() {
        console.log('[AppState] Current State:', this.getSnapshot());
    }
}

// Singleton instance
export const appState = new AppState();

// Expose to window for debugging
if (typeof window !== 'undefined') {
    window._appState = appState;
}
