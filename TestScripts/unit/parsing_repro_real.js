
// Simulation of the worker parsing logic to reproduce the issue
// Based on Production/src/infra/workers/logParser.worker.js content

// 1. Define the Regex (Exact copy from worker.js)
const logcatRegex = new RegExp(
    '^\\s*(?:' + // Allow optional leading whitespace
    '(?<logcatDate>\\d{2}-\\d{2})\\s(?<logcatTime>\\d{2}:\\d{2}:\\d{2}\\.\\d{3,})' + // MM-DD HH:mm:ss.SSS
    '\\s+' + // Separator
    '(?:' + // Start PID/TID/UID group
    '(?<pid>[\\w-]+)\\s+(?<tid>\\d+)\\s+(?:(?<uid>[\\w-]+)\\s+)?(?<level>[A-Z])\\s+(?<tag>[^\\s]+?)\\s*:\\s+' + // PID TID [UID] Level Tag :
    '|' + // OR
    '(?<pid2>\\d+)\\s+(?<level2>[A-Z])\\s+(?<tag2>[^\\s|]+?)(?:\\||:)\\s*' + // PID Level Tag| or Tag:
    ')' + // End PID/TID/UID group
    '(?<message>(?!.*Date: \\d{4}).+)' + // Message
    '|' +
    'Date:\\s(?<customFullDate>\\d{4}-\\d{2}-\\d{2})\\s(?<customTime>\\d{2}:\\d{2}:\\d{2})' + // Date: YYYY-MM-DD HH:mm:ss
    '(?<customMessage>\\|.*)' + // The rest of the custom log line, must start with a pipe
    '|' +
    '\\[(?<weaverDate>\\d{2}-\\d{2})\\s(?<weaverTime>\\d{2}:\\d{2}:\\d{2}\\.\\d+)\\]' + // Weaver log format [MM-DD HH:mm:ss.SSSSSS]
    '\\[(?<weaverPid>\\d+)\\]\\[(?<weaverTag>[^\\]]+)\\]\\s*(?<weaverMessage>.*)' + // Weaver PID, Tag, and Message
    '|' +
    '(?<simpleDate>\\d{2}-\\d{2})\\s(?<simpleTime>\\d{2}:\\d{2}:\\d{2}[:.]\\d{3,})\\s+' + // Simple format: MM-DD HH:mm:ss:SSS (colon or dot)
    '(?<simpleTag>[^:]+?)\\s*:\\s+(?<simpleMessage>.+)' + // Tag : Message (Level implied/missing)
    '|' +
    // Process Status Line (ps/top output) - No Date/Time, mainly PID/TID/User/Process
    '(?<psPid>\\d+)\\s+(?<psTid>\\d+)\\s+(?<psUser>[\\w._]+)\\s+(?:(?<psPr>[\\d-]+)\\s+)?(?:(?<psNi>[\\d-]+)\\s+)?.*?(?<psTag>[^\\s]+)$' +
    '|' +
    // GPS/Kernel Custom Line - Date Time PID Hex Tag Message
    '(?<gpsDate>\\d{2}-\\d{2})\\s+(?<gpsTime>\\d{2}:\\d{2}:\\d{2}\\.\\d{3})\\s+(?<gpsPid>\\d+)\\s+(?<gpsExtra>[a-fA-F0-9]+)\\s+(?<gpsTag>\\+?[^\\s]+)\\s+(?<gpsMessage>.*)' +
    ')',
    'm' // Use 'm' (multiline) for ^, but NOT 'g' (global) with exec() in a loop
);

// 2. Mock Data with unmatched continuation lines
const testContent = `
01-01 12:00:00.000  1000  1000 D Tag : Header Line
Continuation Line 1
Continuation Line 2
01-01 12:00:01.000  1000  1000 D Tag : Next Header Line
`;

// 3. Parser Logic (Condensed from worker, focusing on loop and state)
function parse(content) {
    const lines = content.split('\n');
    const parsedLines = [];
    const stats = { V: 0 };

    // State variables (The fix we implemented)
    let lastValidDateObj = null;
    let lastValidDate = 'N/A';
    let lastValidTime = 'N/A';
    let lastValidTimestamp = '';

    for (let i = 0; i < lines.length; i++) {
        const lineText = lines[i];
        if (!lineText.trim()) {
            continue;
        }

        const match = logcatRegex.exec(lineText);
        let parsedLine = null;
        let lineDateObj = null;

        if (match) {
            // ... (Simplified match block, assuming standard logcat match for test) ...
            if (match.groups.logcatDate) {
                const { logcatDate, logcatTime, level, tag, message } = match.groups;
                const fullTimestamp = logcatDate + ' ' + logcatTime;
                lineDateObj = { mocked: true, ts: fullTimestamp }; // Mock Date obj

                // Update state
                lastValidDateObj = lineDateObj;
                lastValidDate = logcatDate;
                lastValidTime = logcatTime;
                lastValidTimestamp = fullTimestamp;

                parsedLine = { isMeta: false, timestamp: fullTimestamp, message: message.trim(), originalText: lineText };
            }
            // ... (Ignore other types for this simple test) ...
        } else {
            // Unmatched line logic (The Fix)
            const levelMatch = lineText.match(/\s([VDIWE])\s/);
            const level = levelMatch ? levelMatch[1] : 'V';

            const date = lastValidDate !== 'N/A' ? lastValidDate : 'N/A';
            const time = lastValidTime !== 'N/A' ? lastValidTime : 'N/A';
            const timestamp = lastValidTimestamp !== '' ? lastValidTimestamp : '';
            const dateObj = lastValidDateObj;

            parsedLine = { isMeta: false, dateObj, date, time, timestamp, originalText: lineText, level, lineNumber: i + 1 };
        }

        if (parsedLine) {
            parsedLines.push(parsedLine);
        }
    }
    return parsedLines;
}

// 4. Run Test
const results = parse(testContent);
console.log('Parsed Lines:', JSON.stringify(results, null, 2));

// 5. Assertions
const continuationLine1 = results.find(l => l.originalText.includes('Continuation Line 1'));
if (continuationLine1 && continuationLine1.timestamp === '01-01 12:00:00.000') {
    console.log('PASS: Continuation Line 1 inherited timestamp correctly.');
} else {
    console.log('FAIL: Continuation Line 1 did NOT inherit timestamp. Got: ' + (continuationLine1 ? continuationLine1.timestamp : 'undefined'));
    process.exit(1);
}
