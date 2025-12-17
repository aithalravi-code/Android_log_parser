/**
 * FilterState - Manages all filtering configuration and state
 * Controls how logs are filtered across the application
 */
export class FilterState {
    constructor() {
        // Keyword filtering
        this.keywords = []; // Array of {text: string, active: boolean}
        this.liveSearchQuery = '';

        // Log level filtering
        this.activeLevels = new Set(['V', 'D', 'I', 'W', 'E', 'F', 'A', 'S']);

        // Logic mode
        this.isAndLogic = false; // false = OR, true = AND

        // Technology toggles (master switches)
        this.activeTechs = {
            ble: true,
            nfc: true,
            dck: true,
            uwb: true,
            wallet: true
        };

        // Layer-specific filters
        this.activeLayers = {
            ble: new Set(['manager', 'gatt', 'smp', 'hci']),
            nfc: new Set(['framework', 'hce', 'p2p', 'hal']),
            btsnoop: new Set(['cmd', 'evt', 'acl', 'l2cap', 'smp', 'att'])
        };

        // Filter cache for optimization
        this.stateHash = null;
        this.cachedResults = {
            logs: null,
            connectivity: null,
            btsnoop: null
        };

        // Version for async filtering cancellation
        this.version = 0;
    }

    /**
     * Reset to default filter state
     */
    reset() {
        this.keywords = [];
        this.liveSearchQuery = '';
        this.activeLevels = new Set(['V', 'D', 'I', 'W', 'E', 'F', 'A', 'S']);
        this.isAndLogic = false;

        // Reset tech toggles
        Object.keys(this.activeTechs).forEach(key => {
            this.activeTechs[key] = true;
        });

        // Reset layers
        this.activeLayers.ble = new Set(['manager', 'gatt', 'smp', 'hci']);
        this.activeLayers.nfc = new Set(['framework', 'hce', 'p2p', 'hal']);
        this.activeLayers.btsnoop = new Set(['cmd', 'evt', 'acl', 'l2cap', 'smp', 'att']);

        // Clear cache
        this.clearCache();
        this.version = 0;
    }

    /**
     * Clear filter cache
     */
    clearCache() {
        this.stateHash = null;
        this.cachedResults.logs = null;
        this.cachedResults.connectivity = null;
        this.cachedResults.btsnoop = null;
    }

    /**
     * Increment filter version (for cancellation)
     */
    incrementVersion() {
        this.version++;
        return this.version;
    }

    /**
     * Get active keyword count
     */
    get activeKeywordCount() {
        return this.keywords.filter(kw => kw.active).length;
    }

    /**
     * Check if any filters are active
     */
    get hasActiveFilters() {
        return this.activeKeywordCount > 0 ||
            this.liveSearchQuery.length > 0 ||
            this.activeLevels.size < 8;
    }
}
