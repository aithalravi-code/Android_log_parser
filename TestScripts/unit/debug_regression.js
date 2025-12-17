const batteryRegex = /(?:level|l)[:=]\s*(\d+).*?(?:scale|s)[:=]\s*(\d+)|(?:level|l)[:=]\s*(\d+)/i;

const logs = [
    'BatteryService: level: 100, scale: 100, status: 2',
    'HealthService: battery l=95',
    'level:80',
    'Something: level: 50', // ambiguous?
    'Batt: level: 100',
    'level: 100'
];

console.log('--- Regex Tests ---');
logs.forEach(log => {
    const match = log.match(batteryRegex);
    if (match) {
        const level = match[1] || match[3];
        const scale = match[2] || '100 (default)';
        console.log(`PASS: "${log}" -> Level: ${level}, Scale: ${scale}`);
    } else {
        console.log(`FAIL: "${log}"`);
    }
});

// Mock BLE Logic
console.log('\n--- BLE Logic Tests ---');
const connectionEvents = []; // No BTSnoop
const textKeys = new Map();
textKeys.set('AA:BB:CC', { type: 'LTK', key: '112233' });

const keyEvents = connectionEvents.filter(e => e.keyType); // Should be []
const textKeyEvents = [];
if (textKeys && textKeys.size > 0) {
    textKeys.forEach((keyInfo, address) => {
        let keyType = 'LTK';
        let keyValue = keyInfo;
        if (typeof keyInfo === 'object') {
            keyType = keyInfo.type || 'LTK';
            keyValue = keyInfo.key || keyInfo.value;
        }
        textKeyEvents.push({
            peerAddress: address,
            keyType: keyType,
            keyValue: keyValue
        });
    });
}
const allKeys = [...keyEvents, ...textKeyEvents];
console.log(`All Keys: ${allKeys.length}`);
allKeys.forEach(k => console.log(k));
