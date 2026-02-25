
// Mock logger
const logger = {
    worker: (...args) => { },
    error: (...args) => console.error('[Error]', ...args),
};

const fileContent = `
    09-23 17:41:16.488 | token: UNLOCK | properties: AuthInteractionProperties(vibrationAttributes=VibrationAttributes{mUsage=COMMUNICATION_REQUEST, mAudioUsage= USAGE_UNKNOWN, mFlags=0})
    2025-09-23 17:41:16.488 | token: UNLOCK_YEAR | properties: With Year Prefix
09-23 17:41:16.490 1000 1234 I System: Normal Log
    09-23 17:41:17.100 | token: LOCK | properties: AuthInteractionProperties(vibrationAttributes=VibrationAttributes{mUsage=COMMUNICATION_REQUEST})
09-23 17:41:16.488 1000 D Bluetooth: Sending [00]
2024-09-23 17:41:17.123 12 34 I UwbTransport: Some DCK log
`;

// Regex from logParser.worker.js (Updated with new keywords)
const dckKeywords = ['DigitalCarKey', 'CarKey', 'UwbTransport', 'Dck', 'UWB', 'nearby', 'token', 'AuthInteractionProperties'];
const dckRegex = new RegExp(`\\b(${dckKeywords.join('|')})\\b`, 'i');

const lines = fileContent.trim().split('\n');

lines.forEach(lineText => {
    console.log(`\nProcessing: "${lineText}"`);

    // Test DCK Detection
    if (dckRegex.test(lineText) || lineText.indexOf('| token:') !== -1) {
        console.log("-> DCK Detection: MATCHED (isDck = true)");
    } else {
        console.log("-> DCK Detection: FAILED (isDck = false)");
    }
});
