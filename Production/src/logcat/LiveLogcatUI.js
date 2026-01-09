import { LiveLogcatManager } from './LiveLogcatManager.js';

/**
 * LiveLogcatUI - Manages UI integration for live logcat streaming
 */
export class LiveLogcatUI {
    constructor() {
        this.manager = new LiveLogcatManager();
        this.streamStartTime = null;
        this.durationTimer = null;
        this.lineCount = 0;

        this.initializeUI();
        this.setupEventListeners();
    }

    /**
     * Initialize UI state
     */
    initializeUI() {
        // Check WebUSB support
        if (!LiveLogcatManager.isSupported()) {
            document.getElementById('webusbWarning').style.display = 'block';
            document.getElementById('connectDeviceBtn').disabled = true;
        }

        // Setup status callback
        this.manager.onStatus((status) => {
            this.handleStatusUpdate(status);
        });

        // Setup log callback
        this.manager.onLog((line) => {
            this.handleNewLogLine(line);
        });
    }

    /**
     * Setup event listeners for UI controls
     */
    setupEventListeners() {
        // Device connection
        document.getElementById('connectDeviceBtn').addEventListener('click', () => {
            this.connectDevice();
        });

        document.getElementById('disconnectDeviceBtn').addEventListener('click', () => {
            this.disconnectDevice();
        });

        // Logcat controls
        document.getElementById('startLogcatBtn').addEventListener('click', () => {
            this.startLogcat();
        });

        document.getElementById('stopLogcatBtn').addEventListener('click', () => {
            this.stopLogcat();
        });

        document.getElementById('pauseLogcatBtn').addEventListener('click', () => {
            this.pauseLogcat();
        });

        document.getElementById('resumeLogcatBtn').addEventListener('click', () => {
            this.resumeLogcat();
        });

        document.getElementById('saveLogcatBtn').addEventListener('click', () => {
            this.saveToFile();
        });

        document.getElementById('clearLogcatBtn').addEventListener('click', () => {
            this.clearBuffer();
        });
    }

    /**
     * Connect to Android device
     */
    async connectDevice() {
        try {
            const connectBtn = document.getElementById('connectDeviceBtn');
            connectBtn.disabled = true;
            connectBtn.textContent = '🔄 Connecting...';

            const deviceInfo = await this.manager.connectDevice();

            // Update UI with device info
            document.getElementById('deviceModel').textContent = deviceInfo.model;
            document.getElementById('deviceAndroid').textContent = deviceInfo.androidVersion;
            document.getElementById('deviceInfo').style.display = 'block';
            document.getElementById('connectDeviceBtn').style.display = 'none';
            document.getElementById('logcatControls').style.display = 'block';

            console.log('[LiveLogcatUI] Device connected:', deviceInfo);
        } catch (error) {
            console.error('[LiveLogcatUI] Connection error:', error);
            alert(`Failed to connect: ${error.message}`);

            const connectBtn = document.getElementById('connectDeviceBtn');
            connectBtn.disabled = false;
            connectBtn.textContent = '🔌 Connect Device';
        }
    }

    /**
     * Disconnect from device
     */
    async disconnectDevice() {
        try {
            await this.manager.disconnectDevice();

            // Reset UI
            document.getElementById('deviceInfo').style.display = 'none';
            document.getElementById('connectDeviceBtn').style.display = 'block';
            document.getElementById('connectDeviceBtn').disabled = false;
            document.getElementById('connectDeviceBtn').textContent = '🔌 Connect Device';
            document.getElementById('logcatControls').style.display = 'none';

            // Reset stats
            this.resetStats();

            console.log('[LiveLogcatUI] Device disconnected');
        } catch (error) {
            console.error('[LiveLogcatUI] Disconnect error:', error);
            alert(`Failed to disconnect: ${error.message}`);
        }
    }

    /**
     * Start logcat streaming
     */
    async startLogcat() {
        try {
            // Ask user if they want to save to file
            const saveToFile = confirm('Do you want to save logs to a file while streaming?\n\n' +
                'Click OK to choose a file location, or Cancel to stream without saving.');

            await this.manager.startLogcat({
                saveToFile: saveToFile,
                autoSave: true
            });

            // Update UI
            document.getElementById('startLogcatBtn').style.display = 'none';
            document.getElementById('stopLogcatBtn').style.display = 'block';
            document.getElementById('pauseLogcatBtn').style.display = 'block';
            document.getElementById('deviceStatusBadge').textContent = 'Streaming';
            document.getElementById('deviceStatusBadge').style.background = '#34a853';

            // Start duration timer
            this.streamStartTime = Date.now();
            this.lineCount = 0;
            this.startDurationTimer();

            console.log('[LiveLogcatUI] Logcat streaming started');
        } catch (error) {
            console.error('[LiveLogcatUI] Start logcat error:', error);
            alert(`Failed to start logcat: ${error.message}`);
        }
    }

    /**
     * Stop logcat streaming
     */
    async stopLogcat() {
        try {
            await this.manager.stopLogcat();

            // Update UI
            document.getElementById('startLogcatBtn').style.display = 'block';
            document.getElementById('stopLogcatBtn').style.display = 'none';
            document.getElementById('pauseLogcatBtn').style.display = 'none';
            document.getElementById('resumeLogcatBtn').style.display = 'none';
            document.getElementById('deviceStatusBadge').textContent = 'Connected';
            document.getElementById('deviceStatusBadge').style.background = '#4285F4';

            // Stop duration timer
            this.stopDurationTimer();

            console.log('[LiveLogcatUI] Logcat streaming stopped');
        } catch (error) {
            console.error('[LiveLogcatUI] Stop logcat error:', error);
            alert(`Failed to stop logcat: ${error.message}`);
        }
    }

    /**
     * Pause logcat streaming
     */
    pauseLogcat() {
        this.manager.pauseLogcat();

        // Update UI
        document.getElementById('pauseLogcatBtn').style.display = 'none';
        document.getElementById('resumeLogcatBtn').style.display = 'block';
        document.getElementById('deviceStatusBadge').textContent = 'Paused';
        document.getElementById('deviceStatusBadge').style.background = '#fbbc04';

        console.log('[LiveLogcatUI] Logcat streaming paused');
    }

    /**
     * Resume logcat streaming
     */
    resumeLogcat() {
        this.manager.resumeLogcat();

        // Update UI
        document.getElementById('pauseLogcatBtn').style.display = 'block';
        document.getElementById('resumeLogcatBtn').style.display = 'none';
        document.getElementById('deviceStatusBadge').textContent = 'Streaming';
        document.getElementById('deviceStatusBadge').style.background = '#34a853';

        console.log('[LiveLogcatUI] Logcat streaming resumed');
    }

    /**
     * Save captured logs to file
     */
    async saveToFile() {
        try {
            await this.manager.saveToFile();
            alert('Logs saved successfully!');
        } catch (error) {
            console.error('[LiveLogcatUI] Save error:', error);
            alert(`Failed to save logs: ${error.message}`);
        }
    }

    /**
     * Clear log buffer
     */
    clearBuffer() {
        if (confirm('Are you sure you want to clear the captured logs buffer?')) {
            this.manager.clearBuffer();
            this.lineCount = 0;
            document.getElementById('logcatLineCount').textContent = '0';

            // Also clear the displayed logs from the main view
            if (window.clearLiveLogLines) {
                window.clearLiveLogLines();
            }

            console.log('[LiveLogcatUI] Buffer cleared');
        }
    }

    /**
     * Handle new log line from stream
     */
    handleNewLogLine(line) {
        this.lineCount++;
        document.getElementById('logcatLineCount').textContent = this.lineCount.toLocaleString();

        // Add to main log view (integrate with existing system)
        // This will be called by the main app to add the line to originalLogLines
        if (window.addLiveLogLine) {
            window.addLiveLogLine(line);
        }
    }

    /**
     * Handle status updates from manager
     */
    handleStatusUpdate(status) {
        console.log('[LiveLogcatUI] Status update:', status);

        switch (status.status) {
            case 'connected':
                // Already handled in connectDevice
                break;
            case 'disconnected':
                // Handle unexpected disconnection
                if (this.manager.isStreaming) {
                    alert('Device disconnected unexpectedly!');
                    this.disconnectDevice();
                }
                break;
            case 'error':
                console.error('[LiveLogcatUI] Error:', status.message);
                break;
        }
    }

    /**
     * Start duration timer
     */
    startDurationTimer() {
        this.durationTimer = setInterval(() => {
            const elapsed = Date.now() - this.streamStartTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            document.getElementById('logcatDuration').textContent =
                `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }, 1000);
    }

    /**
     * Stop duration timer
     */
    stopDurationTimer() {
        if (this.durationTimer) {
            clearInterval(this.durationTimer);
            this.durationTimer = null;
        }
    }

    /**
     * Reset stats
     */
    resetStats() {
        this.lineCount = 0;
        this.streamStartTime = null;
        this.stopDurationTimer();
        document.getElementById('logcatDuration').textContent = '00:00';
        document.getElementById('logcatLineCount').textContent = '0';
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.liveLogcatUI = new LiveLogcatUI();
    });
} else {
    window.liveLogcatUI = new LiveLogcatUI();
}
