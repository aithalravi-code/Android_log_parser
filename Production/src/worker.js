import {
    bleTagRegex,
    bleMessageRegex,
    nfcTagRegex,
    nfcMessageRegex,
    dckRegex,
    walletRegex,
    kernelRegex,
    logcatRegex,
    dumpsysPackageRegex,
    customVersionRegex,
    sdhmsMatchRegex,
    parseThermalLine
} from './parser-utils.js';

self.onmessage = async (event) => {
    const { file, blob, path } = event.data;

    let fileContent = '';

    async function streamToString(stream) {
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let result = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            result += decoder.decode(value, { stream: false });
        }
        return result;
    }

    if (file) { fileContent = await streamToString(file.stream()); }
    else if (blob) { fileContent = await streamToString(blob.stream()); }

    console.log(`[Worker] Processing ${path}, Content Length: ${fileContent.length}`);
    if (fileContent.length > 0) {
        console.log(`[Worker] First 100 chars: ${fileContent.substring(0, 100)}`);
    }

    let parsedLines = [];
    const tagSet = new Set();
    let minTimestamp, maxTimestamp;
    const workerDebugLogs = [];
    const thermalStats = [];

    const stats = { total: 0, E: 0, W: 0, I: 0, D: 0, V: 0 };
    const services = {
        'Bluetooth': { on: /(bluetooth is on|Bluetooth.*Turning On)/i, off: /(bluetooth is off|Bluetooth.*Turning Off)/i, history: [] },
        'Wi-Fi': { on: /wifi is on/i, off: /wifi is off/i, history: [] },
        'Airplane Mode': { on: /(airplane mode is on|Airplane Mode: ON)/i, off: /(airplane mode is off|Airplane Mode: OFF)/i, history: [] },
        'NFC': { on: /NFC is on/i, off: /NFC is off/i, history: [] }
    };
    const highlights = { accounts: new Set(), deviceEvents: [], walletEvents: [] };
    const accountRegex = new RegExp('(?:account:)?Account {name=([^,]+), type=[^}]+}', 'g');
    const lockRegex = /KeyguardUpdateMonitor.*Device.*policy:\\s*1/;
    const unlockRegex = /KeyguardUpdateMonitor.*Device.*policy:\\s*2/;
    // Regex for BT connection events
    const btConnectRegex = /(?:onConnectionStateChange|CONNECT|connectionStateChange).*status=0.*?newState=(?:2|CONNECTED)/i;
    const btDisconnectRegex = /(?:onConnectionStateChange|DISCONNECT|connectionStateChange).*?newState=(?:0|DISCONNECTED)/i;
    const btAddressRegex = /([0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2})/i;

    const batteryRegex = /level: (\\d+).*scale: (\\d+)/;
    const batteryDataPoints = [];
    const cccMessages = [];
    const cccRegex = /(?:Sending|Received):\s*\[([0-9a-fA-F]+)\]/;
    const versionRegex = new RegExp('Package\\s+\\[([^\\]]+)\\].*?versionName=([^\\s\\n,]+)');
    const appVersions = new Map();
    const localAddressRegex = /Read BD_ADDR.*return: (([0-9A-F]{2}:){5}[0-9A-F]{2})/i;

    // Regex for multi-line dumpsys package format
    let dumpsysMatch;
    while ((dumpsysMatch = dumpsysPackageRegex.exec(fileContent)) !== null) {
        if (dumpsysMatch[1] && dumpsysMatch[2]) {
            appVersions.set(dumpsysMatch[1], dumpsysMatch[2]);
        }
    }

    const CHUNK_SIZE = 10000; // Number of lines to send back at a time

    const yearMatch = path.match(/(\d{4})-\d{2}-\d{2}/);
    const fileYear = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();

    parsedLines.push({ isMeta: true, text: '--- Log from ' + path + ' ---', originalText: '--- Log from ' + path + ' ---', level: 'M' });

    const lines = fileContent.split('\n');
    console.log(`[Worker] Split lines: ${lines.length}`);
    for (let i = 0; i < lines.length; i++) {
        const lineText = lines[i];
        if (!lineText.trim()) continue;
        stats.total++;

        let match = logcatRegex.exec(lineText);
        let parsedLine = { lineNumber: i + 1 }; // Add line number
        let lineDateObj = null;

        if (match) {
            if (match.groups.logcatDate) { // Standard logcat format
                const { logcatDate, logcatTime, level, tag, level2, tag2, message, tid, uid } = match.groups;
                const pid = match.groups.pid || match.groups.pid2;
                const [month, day] = logcatDate.split('-').map(Number);
                const [hours, minutes, seconds, milliseconds] = logcatTime.split(/[:.]/).map(Number);
                lineDateObj = new Date(Date.UTC(fileYear, month - 1, day, hours, minutes, seconds, milliseconds || 0));

                const fullTimestamp = logcatDate + ' ' + logcatTime;
                if (!minTimestamp || fullTimestamp < minTimestamp) minTimestamp = fullTimestamp;
                if (!maxTimestamp || fullTimestamp > maxTimestamp) maxTimestamp = fullTimestamp;

                const finalTag = (tag || tag2 || '').trim();
                tagSet.add(finalTag);
                const finalLevel = (level || level2 || '').trim();

                // FIX: Detect UID PID TID format (3 numbers) vs PID TID (2 numbers)
                // Current regex captures 1st->pid, 2nd->tid, 3rd->uid.
                // If 3rd (uid) is present, it's usually the UID PID TID format.
                // FIX: Trust the regex groups directly. 
                // The new regex correctly captures:
                // 1. PID TID (2 columns)
                // 2. PID TID UID (3 columns)
                // No swapping needed.
                let finalPid = pid;
                let finalTid = tid;
                let finalUid = uid;

                parsedLine = { isMeta: false, dateObj: lineDateObj, date: logcatDate, time: logcatTime, timestamp: fullTimestamp, level: finalLevel, pid: finalPid, tid: finalTid, uid: finalUid, tag: finalTag, message: message.trim(), originalText: lineText };
                if (stats[finalLevel] !== undefined) stats[finalLevel]++;
            } else if (match.groups.customFullDate) { // Custom YYYY-MM-DD format
                const { customFullDate, customTime, customMessage } = match.groups;
                const [year, month, day] = customFullDate.split('-').map(Number);
                const [hours, minutes, seconds] = customTime.split(':').map(Number);
                lineDateObj = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds, 0));

                const mmdd = customFullDate.substring(5);
                const timeWithMs = customTime + '.000';
                const fullTimestamp = mmdd + ' ' + timeWithMs;
                if (!minTimestamp || fullTimestamp < minTimestamp) minTimestamp = fullTimestamp;
                if (!maxTimestamp || fullTimestamp > maxTimestamp) maxTimestamp = fullTimestamp;

                parsedLine = { isMeta: false, dateObj: lineDateObj, date: mmdd, time: timeWithMs, timestamp: fullTimestamp, level: 'I', tag: 'CustomLog', message: customMessage.trim(), originalText: lineText };
                stats.I++;
            }
            else if (match.groups.weaverDate) { // Weaver log format
                const { weaverDate, weaverTime, weaverPid, weaverTag, weaverMessage } = match.groups;
                const [month, day] = weaverDate.split('-').map(Number);
                const [hours, minutes, seconds, milliseconds] = weaverTime.split(/[.:]/).map(Number);
                lineDateObj = new Date(Date.UTC(fileYear, month - 1, day, hours, minutes, seconds, Math.floor(milliseconds / 1000))); // Convert microseconds to ms

                const fullTimestamp = weaverDate + ' ' + weaverTime.slice(0, 12); // Trim to ms for consistency
                if (!minTimestamp || fullTimestamp < minTimestamp) minTimestamp = fullTimestamp;
                if (!maxTimestamp || fullTimestamp > maxTimestamp) maxTimestamp = fullTimestamp;

                parsedLine = { isMeta: false, dateObj: lineDateObj, date: weaverDate, time: weaverTime, timestamp: fullTimestamp, level: 'D', pid: weaverPid, tag: weaverTag.trim(), message: weaverMessage.trim(), originalText: lineText };
                stats.D++;
            }
            else if (match.groups.simpleDate) { // NEW: Simple Tag Log format
                const { simpleDate, simpleTime, simpleTag, simpleMessage } = match.groups;
                const [month, day] = simpleDate.split('-').map(Number);
                // Handle both colon and dot separators for milliseconds
                const [hours, minutes, seconds, milliseconds] = simpleTime.split(/[.:]/).map(Number);

                // Note: simpleTime might have 3 digits for ms
                lineDateObj = new Date(Date.UTC(fileYear, month - 1, day, hours, minutes, seconds, milliseconds || 0));

                // Standardize timestamp format to use dot for consistency in display/filtering
                const stdTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds || 0).padStart(3, '0')}`;
                const fullTimestamp = simpleDate + ' ' + stdTime;

                if (!minTimestamp || fullTimestamp < minTimestamp) minTimestamp = fullTimestamp;
                if (!maxTimestamp || fullTimestamp > maxTimestamp) maxTimestamp = fullTimestamp;

                parsedLine = {
                    isMeta: false,
                    dateObj: lineDateObj,
                    date: simpleDate,
                    time: stdTime,
                    timestamp: fullTimestamp,
                    level: 'D', // Default to Debug as level is missing
                    tag: simpleTag.trim(),
                    message: simpleMessage.trim(),
                    originalText: lineText
                };
                stats.D++;
            }
        } else { // Unmatched line logic
            const levelMatch = lineText.match(/\s([VDIWE])\s/);
            const level = levelMatch ? levelMatch[1] : 'V';
            parsedLine = { isMeta: false, dateObj: null, date: 'N/A', time: 'N/A', originalText: lineText, level: level, lineNumber: i + 1 };

            if (stats[level] !== undefined) {
                stats[level]++;
            } else {
                stats.V++; // Default to Verbose count if unknown
            }
        }

        if (parsedLine) parsedLine.lineNumber = i + 1;
        const textToSearchForHighlights = parsedLine.message || lineText;
        let accountMatch;
        while ((accountMatch = accountRegex.exec(textToSearchForHighlights)) !== null) {
            if (accountMatch[1]) highlights.accounts.add(accountMatch[1].trim());
        }

        const localAddrMatch = lineText.match(localAddressRegex);
        if (localAddrMatch && localAddrMatch[1]) {
            highlights.localBtAddress = localAddrMatch[1];
        }

        if (lockRegex.test(textToSearchForHighlights)) highlights.deviceEvents.push({ date: parsedLine.date, time: parsedLine.time, timestamp: parsedLine.timestamp, event: 'Device Locked', detail: '', originalText: lineText });
        if (unlockRegex.test(textToSearchForHighlights)) highlights.deviceEvents.push({ date: parsedLine.date, time: parsedLine.time, timestamp: parsedLine.timestamp, event: 'Device Unlocked', detail: '', originalText: lineText });

        for (const serviceName in services) {
            const service = services[serviceName];
            if (service.on.test(lineText)) highlights.deviceEvents.push({ date: parsedLine.date, time: parsedLine.time, timestamp: parsedLine.timestamp, event: serviceName + ' Status', detail: 'On', originalText: lineText });
            if (service.off.test(lineText)) highlights.deviceEvents.push({ date: parsedLine.date, time: parsedLine.time, timestamp: parsedLine.timestamp, event: serviceName + ' Status', detail: 'Off', originalText: lineText });
        }

        if (btConnectRegex.test(textToSearchForHighlights)) {
            const addressMatch = textToSearchForHighlights.match(btAddressRegex);
            highlights.deviceEvents.push({ date: parsedLine.date, time: parsedLine.time, timestamp: parsedLine.timestamp, event: 'Bluetooth Connected', detail: addressMatch ? addressMatch[1] : 'N/A', originalText: lineText });
        }
        if (btDisconnectRegex.test(textToSearchForHighlights)) {
            const addressMatch = textToSearchForHighlights.match(btAddressRegex);
            highlights.deviceEvents.push({ date: parsedLine.date, time: parsedLine.time, timestamp: parsedLine.timestamp, event: 'Bluetooth Disconnected', detail: addressMatch ? addressMatch[1] : 'N/A', originalText: lineText });
        }

        const versionMatch = lineText.match(versionRegex);
        if (versionMatch) {
            const packageName = versionMatch[1];
            const versionName = versionMatch[2];
            if (packageName && versionName) appVersions.set(packageName, versionName);
        }
        const customVersionMatch = lineText.match(customVersionRegex);
        if (customVersionMatch) {
            const componentName = customVersionMatch[1];
            const packageName = componentName.split('/')[0]; // Extract package name from component
            const versionCode = customVersionMatch[2];
            if (packageName && versionCode) appVersions.set(packageName, versionCode);
        }

        const batteryMatch = lineText.match(batteryRegex);
        if (batteryMatch && lineDateObj) {
            const level = parseInt(batteryMatch[1]);
            batteryDataPoints.push({ ts: lineDateObj, level: level });
        }

        // FIX: Extract CCC messages from text logs - ONLY from lines with [BleConnection/...] to avoid duplicates
        const cccMatch = lineText.match(cccRegex);
        if (cccMatch && parsedLine) {
            const hex = cccMatch[1];
            // Only process if this line has [BleConnection/...] to avoid duplicates
            const extractedAddress = (lineText.match(/BleConnection\/([0-9A-Fa-f:]+)/i) || [])[1] || null;
            if (hex.length >= 4 && extractedAddress) {
                const type = parseInt(hex.substring(0, 2), 16);
                const subtype = parseInt(hex.substring(2, 4), 16);
                const payload = hex.substring(4);
                cccMessages.push({
                    timestamp: parsedLine.timestamp,
                    direction: lineText.includes("Sending") ? "Host -> Controller" : "Controller -> Host",
                    type,
                    subtype,
                    payload,
                    fullHex: hex,
                    peerAddress: extractedAddress,
                    handle: null
                });
            }
        }

        // Thermal Parsing (Samsung SDHMS)
        if (parsedLine && parsedLine.tag && sdhmsMatchRegex.test(parsedLine.tag)) {
            // Trim leading colon if present in message (due to logcat parser idiosyncrasy)
            const cleanMsg = parsedLine.message.startsWith(':') ? parsedLine.message.substring(1) : parsedLine.message;
            const tData = parseThermalLine(cleanMsg);
            if (tData) {
                thermalStats.push({ ts: parsedLine.timestamp, temps: tData });
            }
        }

        parsedLines.push(parsedLine);

        if (parsedLines.length >= CHUNK_SIZE) {
            self.postMessage({ status: 'chunk', parsedLines: parsedLines, filePath: path });
            parsedLines = [];
        }
    }

    if (parsedLines.length > 0) {
        self.postMessage({ status: 'chunk', parsedLines: parsedLines, filePath: path });
    }

    self.postMessage({ status: 'success', parsedLines: [], tags: Array.from(tagSet), minTimestamp, maxTimestamp, filePath: path, stats, highlights: { ...highlights, accounts: Array.from(highlights.accounts) }, appVersions: Array.from(appVersions), batteryDataPoints, cccMessages, thermalStats });
};
