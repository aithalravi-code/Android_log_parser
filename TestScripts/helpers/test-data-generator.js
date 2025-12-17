/**
 * Test Data Generator
 * Programmatically generate mock test data for E2E tests
 */

/**
 * Generate a mock Android logcat file
 * @param {number} lineCount - Number of log lines to generate
 * @param {Object} options - Configuration options
 * @param {string[]} options.levels - Log levels to include (default: all)
 * @param {string[]} options.tags - Tags to use (default: random)
 * @param {boolean} options.includeTimestamps - Include timestamps (default: true)
 * @param {boolean} options.includeCCC - Include CCC messages (default: false)
 * @param {boolean} options.includeThermal - Include thermal data (default: false)
 * @returns {string} - Mock log file content
 */
export function generateMockLogFile(lineCount, options = {}) {
    const {
        levels = ['V', 'D', 'I', 'W', 'E'],
        tags = ['TestTag', 'SystemUI', 'ActivityManager', 'PackageManager', 'WindowManager'],
        includeTimestamps = true,
        includeCCC = false,
        includeThermal = false
    } = options;

    const lines = [];
    const baseDate = new Date('2024-09-23T12:00:00');

    // Add header
    lines.push('--------- beginning of system');

    for (let i = 0; i < lineCount; i++) {
        const timestamp = new Date(baseDate.getTime() + i * 1000);
        const month = String(timestamp.getMonth() + 1).padStart(2, '0');
        const day = String(timestamp.getDate()).padStart(2, '0');
        const hours = String(timestamp.getHours()).padStart(2, '0');
        const minutes = String(timestamp.getMinutes()).padStart(2, '0');
        const seconds = String(timestamp.getSeconds()).padStart(2, '0');
        const millis = String(timestamp.getMilliseconds()).padStart(3, '0');

        const level = levels[Math.floor(Math.random() * levels.length)];
        const tag = tags[Math.floor(Math.random() * tags.length)];
        const pid = 1000 + Math.floor(Math.random() * 1000);
        const tid = 2000 + Math.floor(Math.random() * 1000);
        const uid = 10000 + Math.floor(Math.random() * 1000);

        const message = `Log message ${i} - ${tag} activity`;

        if (includeTimestamps) {
            lines.push(`${month}-${day} ${hours}:${minutes}:${seconds}.${millis} ${pid} ${tid} ${uid} ${level} ${tag} : ${message}`);
        } else {
            lines.push(`${level}/${tag}(${pid}): ${message}`);
        }
    }

    // Add CCC messages if requested
    if (includeCCC) {
        const cccMessages = [
            '09-23 12:31:00.000 1000 1000 I CCC_LOG : OUTGOING: 020700',
            '09-23 12:31:01.000 1000 1000 I CCC_LOG : INCOMING: 030800',
            '09-23 12:31:02.000 1000 1000 I CCC_LOG : OUTGOING: 040900'
        ];
        lines.push(...cccMessages);
    }

    // Add thermal data if requested
    if (includeThermal) {
        for (let i = 0; i < 50; i++) {
            const temp = 300 + i * 1;
            lines.push(`09-23 12:30:${String(i).padStart(2, '0')}.000 1000 1000 0 I Thermal : SIOP:: AP:${temp} SKIN:${temp - 20}`);
        }
        lines.push('09-23 12:30:10.000 1000 1000 0 I Thermal : temperature: 35000');
    }

    return lines.join('\n');
}

/**
 * Generate mock BTSnoop packet data
 * @param {number} packetCount - Number of packets to generate
 * @returns {Buffer} - Mock BTSnoop file buffer
 */
export function generateMockBTSnoopFile(packetCount = 100) {
    // BTSnoop file format:
    // Header: "btsnoop\0" + version (4 bytes) + datalink type (4 bytes)
    const header = Buffer.from('btsnoop\0');
    const version = Buffer.alloc(4);
    version.writeUInt32BE(1, 0);
    const datalinkType = Buffer.alloc(4);
    datalinkType.writeUInt32BE(1001, 0); // HCI UART (H4)

    const packets = [header, version, datalinkType];

    // Generate packets
    for (let i = 0; i < packetCount; i++) {
        // Packet record: original length (4) + included length (4) + flags (4) + drops (4) + timestamp (8) + data
        const packetData = Buffer.from([0x01, 0x03, 0x0C, 0x00]); // HCI Reset command
        const originalLength = Buffer.alloc(4);
        originalLength.writeUInt32BE(packetData.length, 0);
        const includedLength = Buffer.alloc(4);
        includedLength.writeUInt32BE(packetData.length, 0);
        const flags = Buffer.alloc(4);
        flags.writeUInt32BE(0x02, 0); // Sent
        const drops = Buffer.alloc(4);
        const timestamp = Buffer.alloc(8);
        const ts = BigInt(Date.now() * 1000 + i * 1000);
        timestamp.writeBigUInt64BE(ts, 0);

        packets.push(originalLength, includedLength, flags, drops, timestamp, packetData);
    }

    return Buffer.concat(packets);
}

/**
 * Generate mock CCC log messages
 * @param {number} messageCount - Number of CCC messages to generate
 * @returns {string} - Mock log file with CCC messages
 */
export function generateMockCCCLogs(messageCount = 50) {
    const lines = ['--------- beginning of system'];
    const baseDate = new Date('2024-09-23T12:00:00');

    const cccMessageTypes = [
        '020700', // Framework message
        '030800', // SE message
        '040900', // UWB message
        '050A00', // Another message type
    ];

    for (let i = 0; i < messageCount; i++) {
        const timestamp = new Date(baseDate.getTime() + i * 1000);
        const month = String(timestamp.getMonth() + 1).padStart(2, '0');
        const day = String(timestamp.getDate()).padStart(2, '0');
        const hours = String(timestamp.getHours()).padStart(2, '0');
        const minutes = String(timestamp.getMinutes()).padStart(2, '0');
        const seconds = String(timestamp.getSeconds()).padStart(2, '0');
        const millis = String(timestamp.getMilliseconds()).padStart(3, '0');

        const direction = i % 2 === 0 ? 'OUTGOING' : 'INCOMING';
        const message = cccMessageTypes[Math.floor(Math.random() * cccMessageTypes.length)];

        lines.push(`${month}-${day} ${hours}:${minutes}:${seconds}.${millis} 1000 1000 I CCC_LOG : ${direction}: ${message}`);
    }

    return lines.join('\n');
}

/**
 * Generate a minimal mock bugreport structure
 * @returns {Object} - Object with file paths and contents for a mock bugreport
 */
export function generateMockBugreport() {
    return {
        'bugreport-test.txt': generateMockLogFile(1000, {
            includeTimestamps: true,
            includeCCC: true,
            includeThermal: true
        }),
        'FS/data/misc/bluetooth/logs/btsnoop_hci.log': 'mock_btsnoop_data',
        'dumpstate_board.txt': 'Mock dumpstate data\nDevice: TestDevice\nBuild: TEST123'
    };
}

/**
 * Generate mock connectivity logs (BLE, NFC, UWB, Wallet)
 * @param {number} lineCount - Number of lines per category
 * @returns {string} - Mock log file with connectivity data
 */
export function generateMockConnectivityLogs(lineCount = 100) {
    const lines = ['--------- beginning of system'];
    const baseDate = new Date('2024-09-23T12:00:00');

    const categories = [
        { tag: 'BluetoothAdapter', keywords: ['BLE', 'GATT', 'scan'] },
        { tag: 'NfcService', keywords: ['NFC', 'tag', 'reader'] },
        { tag: 'UwbService', keywords: ['UWB', 'ranging', 'session'] },
        { tag: 'WalletService', keywords: ['payment', 'card', 'transaction'] }
    ];

    categories.forEach((category, catIndex) => {
        for (let i = 0; i < lineCount; i++) {
            const timestamp = new Date(baseDate.getTime() + (catIndex * lineCount + i) * 1000);
            const month = String(timestamp.getMonth() + 1).padStart(2, '0');
            const day = String(timestamp.getDate()).padStart(2, '0');
            const hours = String(timestamp.getHours()).padStart(2, '0');
            const minutes = String(timestamp.getMinutes()).padStart(2, '0');
            const seconds = String(timestamp.getSeconds()).padStart(2, '0');
            const millis = String(timestamp.getMilliseconds()).padStart(3, '0');

            const keyword = category.keywords[Math.floor(Math.random() * category.keywords.length)];
            const message = `${keyword} event ${i}`;

            lines.push(`${month}-${day} ${hours}:${minutes}:${seconds}.${millis} 1000 2000 10000 I ${category.tag} : ${message}`);
        }
    });

    return lines.join('\n');
}

/**
 * Generate mock device events
 * @param {number} eventCount - Number of events to generate
 * @returns {string} - Mock log file with device events
 */
export function generateMockDeviceEvents(eventCount = 50) {
    const lines = ['--------- beginning of system'];
    const baseDate = new Date('2024-09-23T12:00:00');

    const events = [
        'Screen turned on',
        'Screen turned off',
        'Battery level changed',
        'Network connected',
        'Network disconnected',
        'App installed',
        'App uninstalled',
        'Boot completed'
    ];

    for (let i = 0; i < eventCount; i++) {
        const timestamp = new Date(baseDate.getTime() + i * 10000);
        const month = String(timestamp.getMonth() + 1).padStart(2, '0');
        const day = String(timestamp.getDate()).padStart(2, '0');
        const hours = String(timestamp.getHours()).padStart(2, '0');
        const minutes = String(timestamp.getMinutes()).padStart(2, '0');
        const seconds = String(timestamp.getSeconds()).padStart(2, '0');
        const millis = String(timestamp.getMilliseconds()).padStart(3, '0');

        const event = events[Math.floor(Math.random() * events.length)];

        lines.push(`${month}-${day} ${hours}:${minutes}:${seconds}.${millis} 1000 2000 10000 I SystemEvents : ${event}`);
    }

    return lines.join('\n');
}

/**
 * Generate large mock log file for performance testing
 * @param {number} sizeInMB - Target size in megabytes
 * @returns {string} - Large mock log file
 */
export function generateLargeMockLogFile(sizeInMB = 100) {
    const targetBytes = sizeInMB * 1024 * 1024;
    const lines = ['--------- beginning of system'];
    let currentSize = lines[0].length + 1; // +1 for newline

    let lineNum = 0;
    while (currentSize < targetBytes) {
        const line = `09-23 12:${String(Math.floor(lineNum / 60) % 60).padStart(2, '0')}:${String(lineNum % 60).padStart(2, '0')}.000 1000 2000 10000 I TestTag : This is log line ${lineNum} with some additional content to make it realistic`;
        lines.push(line);
        currentSize += line.length + 1;
        lineNum++;
    }

    return lines.join('\n');
}
