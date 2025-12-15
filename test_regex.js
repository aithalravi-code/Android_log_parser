// Test MANDATORY UID PID TID format
const testLines = [
    '02-22 16:08:26.143  root     0     0 I trusty  : boot args 0x*** 0x*** 0x6 0x0',
    '02-22 16:18:43.056 10146  2814 13873 I NetworkScheduler.Stats: Task com.google.android.gms',
    '02-22 16:18:43.082 shell 12010 12010 D dumpstate: Duration of APP PROVIDERS',
    '02-22 16:18:43.079  1000  1561  3800 D ActivityManager: freezer override set to false'
];

// NEW regex with MANDATORY UID
const logcatRegex = new RegExp(
    '^\\s*(?:' +
    '(?<logcatDate>\\d{2}-\\d{2})\\s(?<logcatTime>\\d{2}:\\d{2}:\\d{2}\\.\\d{3,})' +
    '\\s+' +
    '(?:' +
    '(?<pid>[\\w-]+)\\s+(?<tid>[\\w-]+)\\s+(?<uid>[\\w-]+)\\s+(?<level>[A-Z])\\s+(?<tag>[^\\s]+?)\\s*:\\s+' + // UID PID TID mandatory
    '|' +
    '(?<pid2>\\d+)\\s+(?<level2>[A-Z])\\s+(?<tag2>[^\\s|]+?)(?:\\||:)\\s*' +
    ')' +
    '(?<message>(?!.*Date: \\d{4}).+)' +
    ')',
    'm'
);

console.log('Testing MANDATORY UID PID TID format:\n');

testLines.forEach((line, idx) => {
    console.log(`\nLine ${idx + 1}:`);
    console.log(`Input: "${line}"`);

    const match = logcatRegex.exec(line);

    if (match) {
        console.log('✓ MATCHED!');
        console.log('Captured:', {
            date: match.groups.logcatDate,
            time: match.groups.logcatTime,
            uid: match.groups.pid,  // These are swapped in the capture!
            pid: match.groups.tid,
            tid: match.groups.uid,
            level: match.groups.level,
            tag: match.groups.tag
        });
    } else {
        console.log('✗ NO MATCH');
    }
});
