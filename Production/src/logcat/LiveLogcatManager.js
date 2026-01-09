import { AdbWebUsbBackendManager } from '@yume-chan/adb-backend-webusb';
import { Adb, AdbDaemonTransport } from '@yume-chan/adb';
import AdbWebCredentialStore from '@yume-chan/adb-credential-web';

/**
 * LiveLogcatManager - Manages live logcat streaming from Android devices via WebUSB
 * 
 * Features:
 * - Connect to Android device via WebUSB
 * - Stream logcat in real-time
 * - Write raw logs to file
 * - Integrate with existing filter system
 */
export class LiveLogcatManager {
    constructor() {
        this.backend = null;
        this.adb = null;
        this.logcatProcess = null;
        this.isStreaming = false;
        this.isPaused = false;
        this.capturedLogs = [];
        this.fileHandle = null;
        this.fileWriter = null;
        this.onLogCallback = null;
        this.onStatusCallback = null;

        // Configuration
        this.maxBufferSize = 50000; // Keep last 50k lines in memory
        this.autoSaveInterval = 5 * 60 * 1000; // 5 minutes
        this.autoSaveTimer = null;

        // Credential store for ADB authentication
        this.credentialStore = new AdbWebCredentialStore();
    }

    /**
     * Check if WebUSB is supported in current browser
     */
    static isSupported() {
        return 'usb' in navigator;
    }

    /**
     * Connect to Android device via WebUSB
     * @returns {Promise<Object>} Device info
     */
    async connectDevice() {
        if (!LiveLogcatManager.isSupported()) {
            throw new Error('WebUSB is not supported in this browser. Please use Chrome, Edge, or Opera.');
        }

        try {
            console.log('[LiveLogcat] Requesting USB device...');
            const manager = AdbWebUsbBackendManager.BROWSER;

            if (!manager) {
                throw new Error('WebUSB manager not available');
            }

            // Request device from user
            this.backend = await manager.requestDevice();

            if (!this.backend) {
                throw new Error('No device selected');
            }

            console.log('[LiveLogcat] Connecting to device...');
            // Connect to backend and get connection stream
            const connection = await this.backend.connect();

            // Authenticate and create transport
            const transport = await AdbDaemonTransport.authenticate({
                serial: this.backend.serial,
                connection: connection,
                credentialStore: this.credentialStore
            });

            // Create Adb instance from transport
            this.adb = new Adb(transport);

            // Get device info using getProp
            const deviceInfo = {
                model: await this.adb.getProp('ro.product.model'),
                androidVersion: await this.adb.getProp('ro.build.version.release'),
                manufacturer: await this.adb.getProp('ro.product.manufacturer'),
                serial: this.backend.serial
            };

            console.log('[LiveLogcat] Connected to device:', deviceInfo);
            this._updateStatus('connected', deviceInfo);

            return deviceInfo;
        } catch (error) {
            console.error('[LiveLogcat] Connection error:', error);
            this._updateStatus('error', { message: error.message });
            throw error;
        }
    }

    /**
     * Disconnect from device
     */
    async disconnectDevice() {
        try {
            if (this.isStreaming) {
                await this.stopLogcat();
            }

            if (this.adb) {
                await this.adb.close();
                this.adb = null;
            }

            this.backend = null;
            console.log('[LiveLogcat] Disconnected from device');
            this._updateStatus('disconnected');
        } catch (error) {
            console.error('[LiveLogcat] Disconnect error:', error);
            throw error;
        }
    }

    /**
     * Start logcat streaming
     * @param {Object} options - Logcat options
     */
    async startLogcat(options = {}) {
        if (!this.adb) {
            throw new Error('No device connected');
        }

        if (this.isStreaming) {
            console.warn('[LiveLogcat] Already streaming');
            return;
        }

        try {
            console.log('[LiveLogcat] Starting logcat stream...');

            // Clear previous logs
            this.capturedLogs = [];

            // Build logcat command arguments
            const args = ['-v', 'threadtime']; // Use threadtime format

            // Start logcat process using shellProtocol
            const logcat = await this.adb.subprocess.shellProtocol.spawn(['logcat', ...args]);
            this.logcatProcess = logcat;
            this.isStreaming = true;
            this.isPaused = false;

            // Setup file writer if requested
            if (options.saveToFile) {
                await this._initializeFileWriter();
            }

            // Start auto-save timer
            if (options.autoSave !== false) {
                this._startAutoSave();
            }

            console.log('[LiveLogcat] Logcat stream started');
            this._updateStatus('streaming');

            // Read and process log stream
            this._processLogStream(logcat.stdout);

        } catch (error) {
            console.error('[LiveLogcat] Start logcat error:', error);
            this.isStreaming = false;
            this._updateStatus('error', { message: error.message });
            throw error;
        }
    }

    /**
     * Stop logcat streaming
     */
    async stopLogcat() {
        if (!this.isStreaming) {
            return;
        }

        try {
            console.log('[LiveLogcat] Stopping logcat stream...');

            // Stop auto-save timer
            this._stopAutoSave();

            // Kill logcat process
            if (this.logcatProcess) {
                await this.logcatProcess.kill();
                this.logcatProcess = null;
            }

            // Close file writer
            if (this.fileWriter) {
                await this._closeFileWriter();
            }

            this.isStreaming = false;
            this.isPaused = false;

            console.log('[LiveLogcat] Logcat stream stopped');
            this._updateStatus('stopped');
        } catch (error) {
            console.error('[LiveLogcat] Stop logcat error:', error);
            throw error;
        }
    }

    /**
     * Pause logcat streaming (stop displaying but keep capturing)
     */
    pauseLogcat() {
        if (!this.isStreaming || this.isPaused) {
            return;
        }

        this.isPaused = true;
        console.log('[LiveLogcat] Logcat stream paused');
        this._updateStatus('paused');
    }

    /**
     * Resume logcat streaming
     */
    resumeLogcat() {
        if (!this.isStreaming || !this.isPaused) {
            return;
        }

        this.isPaused = false;
        console.log('[LiveLogcat] Logcat stream resumed');
        this._updateStatus('streaming');
    }

    /**
     * Save captured logs to file
     * @param {string} filename - Optional filename
     */
    async saveToFile(filename) {
        if (this.capturedLogs.length === 0) {
            throw new Error('No logs to save');
        }

        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T');
            const defaultFilename = `logcat_${timestamp[0]}_${timestamp[1].split('-')[0]}.txt`;
            const finalFilename = filename || defaultFilename;

            // Try File System Access API first (Chrome 86+)
            if ('showSaveFilePicker' in window) {
                await this._saveViaFileSystemAPI(finalFilename);
            } else {
                // Fallback to download
                this._saveViaDownload(finalFilename);
            }

            console.log('[LiveLogcat] Logs saved to file:', finalFilename);
        } catch (error) {
            console.error('[LiveLogcat] Save to file error:', error);
            throw error;
        }
    }

    /**
     * Clear captured logs buffer
     */
    clearBuffer() {
        this.capturedLogs = [];
        console.log('[LiveLogcat] Buffer cleared');
    }

    /**
     * Set callback for log events
     * @param {Function} callback - Called with each log line
     */
    onLog(callback) {
        this.onLogCallback = callback;
    }

    /**
     * Set callback for status changes
     * @param {Function} callback - Called with status updates
     */
    onStatus(callback) {
        this.onStatusCallback = callback;
    }

    // Private methods

    /**
     * Process log stream from logcat
     */
    async _processLogStream(stdout) {
        const reader = stdout.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
            while (this.isStreaming) {
                const { value, done } = await reader.read();

                if (done) {
                    console.log('[LiveLogcat] Stream ended');
                    break;
                }

                // Decode chunk and add to buffer
                buffer += decoder.decode(value, { stream: true });

                // Process complete lines
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer

                for (const line of lines) {
                    if (line.trim()) {
                        await this._processLogLine(line);
                    }
                }
            }
        } catch (error) {
            if (this.isStreaming) {
                console.error('[LiveLogcat] Stream processing error:', error);
                this._updateStatus('error', { message: error.message });
            }
        } finally {
            reader.releaseLock();
        }
    }

    /**
     * Process a single log line
     */
    async _processLogLine(line) {
        // Add to buffer
        this.capturedLogs.push(line);

        // Enforce buffer size limit
        if (this.capturedLogs.length > this.maxBufferSize) {
            this.capturedLogs.shift(); // Remove oldest
        }

        // Write to file if enabled
        if (this.fileWriter) {
            await this._writeToFile(line + '\n');
        }

        // Callback for display (if not paused)
        if (!this.isPaused && this.onLogCallback) {
            this.onLogCallback(line);
        }
    }

    /**
     * Initialize file writer using File System Access API
     */
    async _initializeFileWriter() {
        if (!('showSaveFilePicker' in window)) {
            console.warn('[LiveLogcat] File System Access API not available, file writing disabled');
            return;
        }

        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T');
            const filename = `logcat_${timestamp[0]}_${timestamp[1].split('-')[0]}.txt`;

            this.fileHandle = await window.showSaveFilePicker({
                suggestedName: filename,
                types: [{
                    description: 'Text Files',
                    accept: { 'text/plain': ['.txt'] }
                }]
            });

            const writable = await this.fileHandle.createWritable();
            this.fileWriter = writable;

            console.log('[LiveLogcat] File writer initialized:', filename);
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('[LiveLogcat] File writer initialization error:', error);
            }
        }
    }

    /**
     * Write data to file
     */
    async _writeToFile(data) {
        if (this.fileWriter) {
            try {
                await this.fileWriter.write(data);
            } catch (error) {
                // Ignore error if stream is closing - this happens during stop
                if (error.message && error.message.includes('closing writable stream')) {
                    return;
                }
                console.error('[LiveLogcat] File write error:', error);
            }
        }
    }

    /**
     * Close file writer
     */
    async _closeFileWriter() {
        if (this.fileWriter) {
            try {
                await this.fileWriter.close();
                this.fileWriter = null;
                this.fileHandle = null;
                console.log('[LiveLogcat] File writer closed');
            } catch (error) {
                // Ignore error if stream is already closed/closing
                if (error.message && (error.message.includes('closing') || error.message.includes('closed'))) {
                    this.fileWriter = null;
                    return;
                }
                console.error('[LiveLogcat] File writer close error:', error);
            }
        }
    }

    /**
     * Save logs via File System Access API
     */
    async _saveViaFileSystemAPI(filename) {
        const fileHandle = await window.showSaveFilePicker({
            suggestedName: filename,
            types: [{
                description: 'Text Files',
                accept: { 'text/plain': ['.txt'] }
            }]
        });

        const writable = await fileHandle.createWritable();
        await writable.write(this.capturedLogs.join('\n'));
        await writable.close();
    }

    /**
     * Save logs via download (fallback)
     */
    _saveViaDownload(filename) {
        const blob = new Blob([this.capturedLogs.join('\n')], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Start auto-save timer
     */
    _startAutoSave() {
        this._stopAutoSave(); // Clear any existing timer

        this.autoSaveTimer = setInterval(async () => {
            if (this.capturedLogs.length > 0) {
                console.log('[LiveLogcat] Auto-saving logs...');
                try {
                    await this.saveToFile();
                } catch (error) {
                    console.error('[LiveLogcat] Auto-save error:', error);
                }
            }
        }, this.autoSaveInterval);
    }

    /**
     * Stop auto-save timer
     */
    _stopAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
    }

    /**
     * Update status and trigger callback
     */
    _updateStatus(status, data = {}) {
        if (this.onStatusCallback) {
            this.onStatusCallback({ status, ...data });
        }
    }
}
