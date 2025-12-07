/**
 * Enhanced Performance Tracker for Android Log Parser
 * Provides comprehensive execution time monitoring and reporting
 */

export class PerformanceTracker {
    constructor() {
        this.metrics = [];
        this.sessions = [];
        this.currentSession = null;

        // Performance thresholds (in milliseconds)
        this.thresholds = {
            fileLoad: 5000,      // 5 seconds for file loading
            parsing: 3000,       // 3 seconds for parsing
            filtering: 1000,     // 1 second for filtering
            rendering: 500,      // 500ms for rendering
            export: 3000,        // 3 seconds for export
            workerComm: 100,     // 100ms for worker communication
            dbOperation: 200     // 200ms for IndexedDB operations
        };

        // Track memory usage if available
        this.memorySnapshots = [];

        // Auto-export settings
        this.autoExportEnabled = false;
        this.autoExportInterval = 300000; // 5 minutes
        this.autoExportTimer = null;
    }

    /**
     * Start a new performance measurement
     * @param {string} name - Name of the operation
     * @param {string} category - Category (fileLoad, parsing, filtering, etc.)
     * @param {object} metadata - Additional metadata
     * @returns {string} Measurement ID
     */
    startMeasure(name, category = 'general', metadata = {}) {
        const id = `${category}-${name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        performance.mark(`${id}-start`);

        // Capture memory snapshot if available
        const memoryInfo = this.captureMemorySnapshot();

        const measurement = {
            id,
            name,
            category,
            startTime: performance.now(),
            startTimestamp: new Date().toISOString(),
            metadata: {
                ...metadata,
                memoryAtStart: memoryInfo
            },
            status: 'running'
        };

        this.metrics.push(measurement);

        return id;
    }

    /**
     * End a performance measurement
     * @param {string} id - Measurement ID from startMeasure
     * @param {object} additionalMetadata - Additional metadata to add
     * @returns {object} Completed metric
     */
    endMeasure(id, additionalMetadata = {}) {
        const metric = this.metrics.find(m => m.id === id);

        if (!metric) {
            console.warn(`⚠️ Performance metric not found: ${id}`);
            return null;
        }

        performance.mark(`${id}-end`);

        try {
            const measure = performance.measure(id, `${id}-start`, `${id}-end`);
            metric.duration = measure.duration;
        } catch (e) {
            // Fallback if marks were cleared
            metric.duration = performance.now() - metric.startTime;
        }

        metric.endTime = performance.now();
        metric.endTimestamp = new Date().toISOString();
        metric.status = 'completed';

        // Capture end memory snapshot
        const memoryInfo = this.captureMemorySnapshot();
        metric.metadata = {
            ...metric.metadata,
            ...additionalMetadata,
            memoryAtEnd: memoryInfo,
            memoryDelta: memoryInfo && metric.metadata.memoryAtStart
                ? memoryInfo.usedJSHeapSize - metric.metadata.memoryAtStart.usedJSHeapSize
                : null
        };

        // Check against threshold
        this.checkThreshold(metric);

        // Add to current session if active
        if (this.currentSession) {
            this.currentSession.metrics.push(metric);
        }

        return metric;
    }

    /**
     * Mark a measurement as failed
     * @param {string} id - Measurement ID
     * @param {Error|string} error - Error object or message
     */
    markFailed(id, error) {
        const metric = this.metrics.find(m => m.id === id);

        if (metric) {
            metric.status = 'failed';
            metric.error = error instanceof Error ? error.message : error;
            metric.duration = performance.now() - metric.startTime;
            metric.endTimestamp = new Date().toISOString();
        }
    }

    /**
     * Capture current memory usage
     * @returns {object|null} Memory info or null if not available
     */
    captureMemorySnapshot() {
        if (performance.memory) {
            const snapshot = {
                usedJSHeapSize: performance.memory.usedJSHeapSize,
                totalJSHeapSize: performance.memory.totalJSHeapSize,
                jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
                timestamp: Date.now()
            };

            this.memorySnapshots.push(snapshot);

            // Keep only last 100 snapshots
            if (this.memorySnapshots.length > 100) {
                this.memorySnapshots.shift();
            }

            return snapshot;
        }
        return null;
    }

    /**
     * Check if metric exceeds threshold
     * @param {object} metric - Metric to check
     */
    checkThreshold(metric) {
        const threshold = this.thresholds[metric.category];

        if (threshold && metric.duration > threshold) {
            const warning = {
                severity: 'warning',
                message: `${metric.name} took ${metric.duration.toFixed(2)}ms (threshold: ${threshold}ms)`,
                metric: metric,
                timestamp: new Date().toISOString()
            };

            console.warn(`⚠️ Performance Warning: ${warning.message}`);

            // Store warning
            if (!this.warnings) this.warnings = [];
            this.warnings.push(warning);
        }
    }

    /**
     * Start a new performance session
     * @param {string} name - Session name
     * @param {object} metadata - Session metadata
     * @returns {string} Session ID
     */
    startSession(name, metadata = {}) {
        const sessionId = `session-${Date.now()}`;

        this.currentSession = {
            id: sessionId,
            name,
            startTime: performance.now(),
            startTimestamp: new Date().toISOString(),
            metadata,
            metrics: []
        };

        this.sessions.push(this.currentSession);

        return sessionId;
    }

    /**
     * End the current session
     * @returns {object} Completed session
     */
    endSession() {
        if (!this.currentSession) {
            console.warn('⚠️ No active session to end');
            return null;
        }

        this.currentSession.endTime = performance.now();
        this.currentSession.endTimestamp = new Date().toISOString();
        this.currentSession.duration = this.currentSession.endTime - this.currentSession.startTime;

        const session = this.currentSession;
        this.currentSession = null;

        return session;
    }

    /**
     * Generate comprehensive performance report
     * @returns {object} Performance report
     */
    getReport() {
        const categories = {};
        const completedMetrics = this.metrics.filter(m => m.status === 'completed');
        const failedMetrics = this.metrics.filter(m => m.status === 'failed');

        // Group by category
        completedMetrics.forEach(metric => {
            if (!categories[metric.category]) {
                categories[metric.category] = {
                    count: 0,
                    totalDuration: 0,
                    avgDuration: 0,
                    maxDuration: 0,
                    minDuration: Infinity,
                    measurements: [],
                    threshold: this.thresholds[metric.category] || null
                };
            }

            const cat = categories[metric.category];
            cat.count++;
            cat.totalDuration += metric.duration;
            cat.maxDuration = Math.max(cat.maxDuration, metric.duration);
            cat.minDuration = Math.min(cat.minDuration, metric.duration);
            cat.measurements.push({
                name: metric.name,
                duration: metric.duration,
                timestamp: metric.startTimestamp,
                metadata: metric.metadata
            });
        });

        // Calculate averages and percentiles
        Object.values(categories).forEach(cat => {
            cat.avgDuration = cat.totalDuration / cat.count;

            // Calculate percentiles
            const durations = cat.measurements.map(m => m.duration).sort((a, b) => a - b);
            cat.p50 = this.percentile(durations, 50);
            cat.p90 = this.percentile(durations, 90);
            cat.p95 = this.percentile(durations, 95);
            cat.p99 = this.percentile(durations, 99);
        });

        // Memory analysis
        const memoryAnalysis = this.analyzeMemory();

        return {
            summary: {
                totalMeasurements: this.metrics.length,
                completedMeasurements: completedMetrics.length,
                failedMeasurements: failedMetrics.length,
                totalSessions: this.sessions.length,
                warningsCount: this.warnings ? this.warnings.length : 0
            },
            categories,
            sessions: this.sessions,
            failedMetrics,
            warnings: this.warnings || [],
            memory: memoryAnalysis,
            generatedAt: new Date().toISOString(),
            userAgent: navigator.userAgent
        };
    }

    /**
     * Calculate percentile from sorted array
     * @param {Array} sortedArray - Sorted array of numbers
     * @param {number} percentile - Percentile to calculate (0-100)
     * @returns {number} Percentile value
     */
    percentile(sortedArray, percentile) {
        if (sortedArray.length === 0) return 0;
        const index = (percentile / 100) * (sortedArray.length - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        const weight = index % 1;

        if (lower === upper) return sortedArray[lower];

        return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
    }

    /**
     * Analyze memory usage patterns
     * @returns {object} Memory analysis
     */
    analyzeMemory() {
        if (this.memorySnapshots.length === 0) {
            return { available: false };
        }

        const usedHeapSizes = this.memorySnapshots.map(s => s.usedJSHeapSize);

        return {
            available: true,
            current: this.memorySnapshots[this.memorySnapshots.length - 1],
            peak: Math.max(...usedHeapSizes),
            average: usedHeapSizes.reduce((a, b) => a + b, 0) / usedHeapSizes.length,
            snapshots: this.memorySnapshots.length
        };
    }

    /**
     * Export report as JSON file
     * @param {string} filename - Optional filename
     */
    exportToJSON(filename = null) {
        const report = this.getReport();
        const defaultFilename = `performance-report-${new Date().toISOString().replace(/:/g, '-')}.json`;

        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || defaultFilename;
        a.click();
        URL.revokeObjectURL(url);

        console.log(`📊 Performance report exported: ${a.download}`);
    }

    /**
     * Export report as CSV file
     * @param {string} filename - Optional filename
     */
    exportToCSV(filename = null) {
        const report = this.getReport();
        const defaultFilename = `performance-report-${new Date().toISOString().replace(/:/g, '-')}.csv`;

        // CSV headers
        let csv = 'Category,Name,Duration (ms),Status,Timestamp,Metadata\n';

        // Add data rows
        this.metrics.forEach(metric => {
            const row = [
                metric.category,
                metric.name,
                metric.duration ? metric.duration.toFixed(2) : 'N/A',
                metric.status,
                metric.startTimestamp,
                JSON.stringify(metric.metadata).replace(/,/g, ';') // Escape commas
            ];
            csv += row.join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || defaultFilename;
        a.click();
        URL.revokeObjectURL(url);

        console.log(`📊 Performance report exported: ${a.download}`);
    }

    /**
     * Get summary statistics for display
     * @returns {string} Formatted summary
     */
    getSummary() {
        const report = this.getReport();
        let summary = '\n=== Performance Summary ===\n';

        summary += `Total Measurements: ${report.summary.totalMeasurements}\n`;
        summary += `Completed: ${report.summary.completedMeasurements}\n`;
        summary += `Failed: ${report.summary.failedMeasurements}\n`;
        summary += `Warnings: ${report.summary.warningsCount}\n\n`;

        summary += '=== By Category ===\n';
        Object.entries(report.categories).forEach(([category, stats]) => {
            summary += `\n${category.toUpperCase()}:\n`;
            summary += `  Count: ${stats.count}\n`;
            summary += `  Avg: ${stats.avgDuration.toFixed(2)}ms\n`;
            summary += `  Min: ${stats.minDuration.toFixed(2)}ms\n`;
            summary += `  Max: ${stats.maxDuration.toFixed(2)}ms\n`;
            summary += `  P95: ${stats.p95.toFixed(2)}ms\n`;
            if (stats.threshold) {
                summary += `  Threshold: ${stats.threshold}ms\n`;
            }
        });

        if (report.memory.available) {
            summary += '\n=== Memory ===\n';
            summary += `  Current: ${(report.memory.current.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB\n`;
            summary += `  Peak: ${(report.memory.peak / 1024 / 1024).toFixed(2)} MB\n`;
            summary += `  Average: ${(report.memory.average / 1024 / 1024).toFixed(2)} MB\n`;
        }

        return summary;
    }

    /**
     * Enable automatic report export
     * @param {number} intervalMs - Export interval in milliseconds
     */
    enableAutoExport(intervalMs = 300000) {
        this.autoExportEnabled = true;
        this.autoExportInterval = intervalMs;

        if (this.autoExportTimer) {
            clearInterval(this.autoExportTimer);
        }

        this.autoExportTimer = setInterval(() => {
            if (this.metrics.length > 0) {
                this.exportToJSON();
            }
        }, intervalMs);

        console.log(`✅ Auto-export enabled (interval: ${intervalMs / 1000}s)`);
    }

    /**
     * Disable automatic report export
     */
    disableAutoExport() {
        this.autoExportEnabled = false;

        if (this.autoExportTimer) {
            clearInterval(this.autoExportTimer);
            this.autoExportTimer = null;
        }

        console.log('❌ Auto-export disabled');
    }

    /**
     * Reset all metrics and sessions
     */
    reset() {
        this.metrics = [];
        this.sessions = [];
        this.currentSession = null;
        this.warnings = [];
        this.memorySnapshots = [];

        // Clear performance marks and measures
        performance.clearMarks();
        performance.clearMeasures();

        console.log('🔄 Performance tracker reset');
    }

    /**
     * Get real-time performance stats
     * @returns {object} Current stats
     */
    getCurrentStats() {
        const runningMetrics = this.metrics.filter(m => m.status === 'running');
        const recentMetrics = this.metrics
            .filter(m => m.status === 'completed')
            .slice(-10);

        return {
            running: runningMetrics.length,
            completed: this.metrics.filter(m => m.status === 'completed').length,
            failed: this.metrics.filter(m => m.status === 'failed').length,
            recentMetrics: recentMetrics.map(m => ({
                name: m.name,
                category: m.category,
                duration: m.duration
            })),
            currentMemory: this.captureMemorySnapshot()
        };
    }
}

// Singleton instance for global use
export const perfTracker = new PerformanceTracker();

// Make available globally for console access
if (typeof window !== 'undefined') {
    window.perfTracker = perfTracker;
    console.log('📊 Performance Tracker initialized. Use window.perfTracker to access.');
}
