/**
 * LogState - Manages all log data state
 * Consolidates log lines from various sources and technologies
 */
export class LogState {
    constructor() {
        // Main log data
        this.originalLogLines = [];
        this.filteredLogLines = [];

        // Technology-specific logs
        this.byTechnology = {
            ble: [],
            nfc: [],
            dck: [],
            uwb: [],
            wallet: []
        };

        // Filtered versions by technology
        this.filteredByTechnology = {
            ble: [],
            nfc: [],
            dck: [],
            wallet: []
        };

        // Connectivity view (merged BLE/NFC/DCK/UWB/Wallet)
        this.connectivity = [];
        this.filteredConnectivity = [];

        // CCC (Car Connectivity Consortium) messages
        this.cccMessages = [];

        // Unique tags for autocomplete
        this.tags = [];
    }

    /**
     * Reset all log data to initial state
     */
    reset() {
        this.originalLogLines = [];
        this.filteredLogLines = [];

        // Reset technology-specific
        Object.keys(this.byTechnology).forEach(key => {
            this.byTechnology[key] = [];
        });

        Object.keys(this.filteredByTechnology).forEach(key => {
            this.filteredByTechnology[key] = [];
        });

        this.connectivity = [];
        this.filteredConnectivity = [];
        this.cccMessages = [];
        this.tags = [];
    }

    /**
     * Get total number of log lines
     */
    get totalLines() {
        return this.originalLogLines.length;
    }

    /**
     * Get total number of filtered lines
     */
    get filteredCount() {
        return this.filteredLogLines.length;
    }
}
