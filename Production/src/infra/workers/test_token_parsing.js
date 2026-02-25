import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read actual file content
const filePath = path.resolve(__dirname, '../../../TestData/fixtures/bugreport-caiman-BP3A.250905.014-2025-09-24-10-26-57.txt');
const fileContent = fs.readFileSync(filePath, 'utf-8');

// Extract just the lines with token logs
const lines = fileContent.split('\n');
const tokenLines = lines.filter(line => line.includes('token:'));

console.log(`Found ${tokenLines.length} lines with 'token:'\n`);

// Show first 5 token lines
console.log('First 5 token log lines:');
tokenLines.slice(0, 5).forEach((line, idx) => {
    console.log(`${idx + 1}. ${line}`);
});

// Now test the regex
const logcatRegex = new RegExp(
    '^\\s*(?:' +
    '(?<logcatDate>\\d{2}-\\d{2})\\s(?<logcatTime>\\d{2}:\\d{2}:\\d{2}\\.\\d{3,})' +
    '\\s+' +
    '(?:' +
    '(?<pid2>\\d+)\\s+(?<tid2>\\d+)\\s+(?<level2>[A-Z])\\s+(?<tag2>[^:\\s]+?)\\s*:\\s+' +
    '|' +
    '(?<pid>[\\w-]+)\\s+(?<tid>[\\w-]+)\\s+(?<uid>[\\w-]+)\\s+(?<level>[A-Z])\\s+(?<tag>[^\\s]+?)\\s*:\\s+' +
    '|' +
    '(?<pid3>\\d+)\\s+(?<level3>[A-Z])\\s+(?<tag3>[^\\s|]+?)(?:\\||:)\\s*' +
    ')' +
    '(?<message>(?!.*Date: \\d{4}).*)' +
    '|' +
    'Date:\\s(?<customFullDate>\\d{4}-\\d{2}-\\d{2})\\s(?<customTime>\\d{2}:\\d{2}:\\d{2})' +
    '(?<customMessage>\\|.*)' +
    '|' +
    '\\[(?<weaverDate>\\d{2}-\\d{2})\\s(?<weaverTime>\\d{2}:\\d{2}:\\d{2}\\.\\d+)\\]' +
    '\\[(?<weaverPid>\\d+)\\]\\[(?<weaverTag>[^\\]]+)\\]\\s*(?<weaverMessage>.*)' +
    '|' +
    '(?<pipeDate>\\d{2}-\\d{2})\\s(?<pipeTime>\\d{2}:\\d{2}:\\d{2}[:.]\\d{3,})\\s+\\|\\s+' +
    '(?<pipeTag>[^:]+?):\\s+(?<pipeMessage>.+)' +
    '|' +
    '(?<simpleDate>\\d{2}-\\d{2})\\s(?<simpleTime>\\d{2}:\\d{2}:\\d{2}[:.]\\d{3,})\\s+' +
    '(?<simpleTag>[^:]+?)\\s*:\\s+(?<simpleMessage>.+)' +
    '|' +
    '(?<psPid>\\d+)\\s+(?<psTid>\\d+)\\s+(?<psUser>[\\w._]+)\\s+(?:(?<psPr>[\\d-]+)\\s+)?(?:(?<psNi>[\\d-]+)\\s+)?.*?(?<psTag>[^\\s]+)$' +
    '|' +
    '(?<gpsDate>\\d{2}-\\d{2})\\s+(?<gpsTime>\\d{2}:\\d{2}:\\d{2}\\.\\d{3})\\s+(?<gpsPid>\\d+)\\s+(?<gpsExtra>[a-fA-F0-9]+)\\s+(?<gpsTag>\\+?[^\\s]+)\\s+(?<gpsMessage>.*)' +
    ')',
    'm'
);

console.log('\n\nTesting regex on first 3 token lines:\n');
tokenLines.slice(0, 3).forEach((line, idx) => {
    console.log(`\n--- Line ${idx + 1} ---`);
    console.log(`Original: ${line}`);
    const match = logcatRegex.exec(line);
    if (match && match.groups.pipeDate) {
        console.log('✓ MATCHED pipeDate branch');
        console.log(`  Date: ${match.groups.pipeDate}`);
        console.log(`  Time: ${match.groups.pipeTime}`);
        console.log(`  Tag: "${match.groups.pipeTag}"`);
        console.log(`  Message: "${match.groups.pipeMessage.substring(0, 50)}..."`);
    } else if (match) {
        console.log('✓ MATCHED other branch');
        console.log(`  Groups: ${Object.keys(match.groups).filter(k => match.groups[k]).join(', ')}`);
    } else {
        console.log('✗ NO MATCH');
    }
});
