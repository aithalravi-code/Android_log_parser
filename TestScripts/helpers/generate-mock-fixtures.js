#!/usr/bin/env node
/**
 * generate-mock-fixtures.js
 * Generates a rich mock bugreport zip file for CI testing.
 *
 * Output: TestData/mock-data/bugreport-caiman-BP3A.250905.014-2025-09-24-10-26-57.zip
 *
 * Run: node TestScripts/helpers/generate-mock-fixtures.js
 */

import { createWriteStream, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../..');

// ---- Helper: Build a minimal valid BTSnoop binary ----
function buildBtsnoopBinary() {
    // BTSnoop file header: magic (8 bytes) + version (4 bytes) + datalink type (4 bytes)
    const MAGIC = Buffer.from('6274736e6f6f700000000001', 'hex'); // 'btsnoop\0' + version 1
    const DATALINK = Buffer.from('000003ea', 'hex'); // HCI UART

    // One minimal HCI packet record
    // Original length (4), included length (4), flags (4), drops (4), timestamp (8), data
    const hciData = Buffer.from('040e0401030c00', 'hex'); // HCI event: Command Complete
    const origLen = Buffer.alloc(4); origLen.writeUInt32BE(hciData.length);
    const inclLen = Buffer.alloc(4); inclLen.writeUInt32BE(hciData.length);
    const flags = Buffer.alloc(4);   // 0 = received
    const drops = Buffer.alloc(4);
    const ts = Buffer.alloc(8);      // epoch offset timestamp
    ts.writeBigInt64BE(0n);

    return Buffer.concat([MAGIC, DATALINK, origLen, inclLen, flags, drops, ts, hciData]);
}

// ---- Helper: Build synthetic Android bugreport text ----
function buildBugreportText() {
    const lines = [];
    lines.push('========================================================');
    lines.push('== dumpstate: 2025-09-24 10:26:57');
    lines.push('========================================================');
    lines.push('');
    lines.push('Build: test-build-BP3A.250905.014');
    lines.push("Build fingerprint: 'google/caiman/caiman:15/BP3A.250905.014/12345678:user/release-keys'");
    lines.push('Bootloader: TestBootloader-2.0');
    lines.push('Radio: TestRadio-2.0');
    lines.push('Network: TestCarrier');
    lines.push('');
    lines.push('------ SYSTEM LOG (logcat -v threadtime -v printable -v uid -d *:v) ------');
    lines.push('--------- beginning of main');

    const levels = ['V', 'D', 'I', 'W', 'E'];
    const tags = ['ActivityManager', 'BluetoothAdapter', 'PackageManager', 'SystemUI', 'WindowManager',
        'bt_stack', 'bt_btif', 'bt_hci', 'BluetoothAdapterService', 'BluetoothManagerService'];

    let second = 0;
    let ms = 0;
    let pid = 1234;

    // Generate 500 standard log lines spread through the day
    for (let i = 0; i < 500; i++) {
        second = (second + 1) % 60;
        ms = (ms + 13) % 1000;
        if (second === 0) pid++;
        const hh = String(10 + Math.floor(i / 360)).padStart(2, '0');
        const mm = String(Math.floor((i % 360) / 6)).padStart(2, '0');
        const ss = String(second).padStart(2, '0');
        const msStr = String(ms).padStart(3, '0');
        const level = levels[i % levels.length];
        const tag = tags[i % tags.length];
        lines.push(`09-24 ${hh}:${mm}:${ss}.${msStr}  1000  ${pid}  ${pid + 1} ${level} ${tag}: Log message ${i} for testing`);
    }

    // --- CCC messages (required by ccc_extraction_test, ccc_level_check, ccc_log_level_filter) ---
    lines.push('');
    lines.push('-- CCC / Digital Car Key related log entries --');
    const cccDirections = ['SENT', 'RECEIVED'];
    const cccTypes = ['SELECT', 'AUTHENTICATE', 'GET_CHALLENGE', 'CREATE_KEY', 'SIGN'];
    for (let i = 0; i < 50; i++) {
        const ss = String(i % 60).padStart(2, '0');
        const msStr = String((i * 17) % 1000).padStart(3, '0');
        const level = levels[i % levels.length];
        const direction = cccDirections[i % 2];
        const type = cccTypes[i % cccTypes.length];
        // CCC pattern: [BleConnection/...] directive that the parser extracts
        lines.push(`09-24 10:${String(27 + Math.floor(i / 60)).padStart(2, '0')}:${ss}.${msStr}  1000  5000  5001 ${level} [BleConnection/CCC]: ${direction} APDU type=${type} seq=${i}`);
    }

    // --- Token log lines (required by token_logs, token_logs_verification) ---
    lines.push('');
    lines.push('-- Token / pipe-separated log entries --');
    for (let i = 0; i < 30; i++) {
        const ss = String(i % 60).padStart(2, '0');
        const msStr = String((i * 33) % 1000).padStart(3, '0');
        const level = levels[i % levels.length];
        // Token log pattern: pipe-separated with "token:" keyword
        lines.push(`09-24 10:30:${ss}.${msStr}  1000  6000  6001 ${level} KeystoreService: key_id=0x${(i + 1).toString(16).padStart(4, '0')} | token: ${i * 100 + 42} | status: OK`);
    }

    // --- Bluetooth connectivity events (for btsnoop tests) ---
    lines.push('');
    lines.push('-- Bluetooth connectivity events --');
    for (let i = 0; i < 20; i++) {
        const mac = `AA:BB:CC:DD:EE:${String(i + 1).padStart(2, '0')}`;
        lines.push(`09-24 10:26:${String(57 + i).padStart(2, '0')}.001  1000  1234  5678 I bt_btif: bta_dm_acl_up: Device connected: ${mac}`);
        lines.push(`09-24 10:26:${String(58 + i).padStart(2, '0')}.050  1000  1234  5678 I bt_btif: btif_dm_upstreams_evt: ACL_UP event for ${mac}`);
    }

    lines.push('');
    lines.push('[persist.bluetooth.device_class]: [0x200404]');
    lines.push('');
    return lines.join('\n') + '\n';
}

// ---- Main: Build zip using JSZip-compatible format via raw bytes ----
// We use Node's built-in zlib to avoid external deps
import { deflateRawSync } from 'zlib';

function crc32(buf) {
    const table = (() => {
        const t = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            t[i] = c;
        }
        return t;
    })();
    let crc = 0xFFFFFFFF;
    for (const byte of buf) crc = table[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function dosDateTime() {
    // 2025-09-24 10:26:57 encoded as DOS date/time
    const date = ((2025 - 1980) << 9) | (9 << 5) | 24; // year, month, day
    const time = (10 << 11) | (26 << 5) | (57 >> 1);   // hour, min, sec/2
    return [time & 0xFF, (time >> 8) & 0xFF, date & 0xFF, (date >> 8) & 0xFF];
}

function buildZipEntry(filename, data) {
    const nameBytes = Buffer.from(filename, 'utf8');
    const compressed = deflateRawSync(data, { level: 6 });
    const crc = crc32(data);
    const dt = dosDateTime();

    // Local file header
    const lfh = Buffer.alloc(30 + nameBytes.length);
    lfh.writeUInt32LE(0x04034b50, 0);  // signature
    lfh.writeUInt16LE(20, 4);           // version needed
    lfh.writeUInt16LE(0, 6);            // flags
    lfh.writeUInt16LE(8, 8);            // compression (deflate)
    dt.forEach((b, i) => lfh.writeUInt8(b, 10 + i)); // mod time/date
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(compressed.length, 18);
    lfh.writeUInt32LE(data.length, 22);
    lfh.writeUInt16LE(nameBytes.length, 26);
    lfh.writeUInt16LE(0, 28);           // extra field length
    nameBytes.copy(lfh, 30);

    return { lfh, data: compressed, nameBytes, crc, origSize: data.length, compSize: compressed.length };
}

function buildZip(entries) {
    const parts = [];
    const cdEntries = [];
    let offset = 0;

    for (const { name, data } of entries) {
        const entry = buildZipEntry(name, data);
        parts.push(entry.lfh);
        parts.push(entry.data);

        // Central directory entry
        const cd = Buffer.alloc(46 + entry.nameBytes.length);
        cd.writeUInt32LE(0x02014b50, 0); // CD signature
        cd.writeUInt16LE(20, 4);          // version made by
        cd.writeUInt16LE(20, 6);          // version needed
        cd.writeUInt16LE(0, 8);           // flags
        cd.writeUInt16LE(8, 10);          // compression
        const dt = dosDateTime();
        dt.forEach((b, i) => cd.writeUInt8(b, 12 + i));
        cd.writeUInt32LE(entry.crc, 16);
        cd.writeUInt32LE(entry.compSize, 20);
        cd.writeUInt32LE(entry.origSize, 24);
        cd.writeUInt16LE(entry.nameBytes.length, 28);
        cd.writeUInt16LE(0, 30);          // extra
        cd.writeUInt16LE(0, 32);          // comment
        cd.writeUInt16LE(0, 34);          // disk start
        cd.writeUInt16LE(0, 36);          // int file attr
        cd.writeUInt32LE(0, 38);          // ext file attr
        cd.writeUInt32LE(offset, 42);     // relative offset
        entry.nameBytes.copy(cd, 46);
        cdEntries.push(cd);

        offset += entry.lfh.length + entry.compSize;
    }

    const cdBuffer = Buffer.concat(cdEntries);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);   // EOCD signature
    eocd.writeUInt16LE(0, 4);             // disk number
    eocd.writeUInt16LE(0, 6);             // CD start disk
    eocd.writeUInt16LE(entries.length, 8);
    eocd.writeUInt16LE(entries.length, 10);
    eocd.writeUInt32LE(cdBuffer.length, 12);
    eocd.writeUInt32LE(offset, 16);
    eocd.writeUInt16LE(0, 20);            // comment length

    return Buffer.concat([...parts, cdBuffer, eocd]);
}

// ---- Build and write fixture ----
const BUGREPORT_NAME = 'bugreport-caiman-BP3A.250905.014-2025-09-24-10-26-57';

const entries = [
    {
        name: `${BUGREPORT_NAME}.txt`,
        data: Buffer.from(buildBugreportText(), 'utf8')
    },
    {
        name: 'version.txt',
        data: Buffer.from('15\n', 'utf8')
    },
    {
        name: 'FS/data/misc/bluetooth/logs/btsnoop_hci.log',
        data: buildBtsnoopBinary()
    }
];

const outputDir = resolve(projectRoot, 'TestData', 'mock-data');
if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

const outputPath = resolve(outputDir, `${BUGREPORT_NAME}.zip`);
const zipBuffer = buildZip(entries);

import { writeFileSync } from 'fs';
writeFileSync(outputPath, zipBuffer);

const bugreportTxtPath = resolve(outputDir, `${BUGREPORT_NAME}.txt`);
writeFileSync(bugreportTxtPath, Buffer.from(buildBugreportText(), 'utf8'));

console.log(`✅ Mock fixtures generated:`);
console.log(`   ${outputPath} (${(zipBuffer.length / 1024).toFixed(1)} KB)`);
console.log(`   ${bugreportTxtPath}`);
console.log(`   Entries in zip: ${entries.map(e => e.name).join(', ')}`);
