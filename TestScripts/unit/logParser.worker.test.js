import { describe, it, expect, vi } from 'vitest';
import { processLogFile } from '../../Production/src/infra/workers/logParser.worker.js';

describe('logParser.worker.js', () => {
    const createMockFile = (content) => ({
        stream: () => {
            const encoder = new TextEncoder();
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(encoder.encode(content));
                    controller.close();
                }
            });
            return stream;
        }
    });

    it('should parse standard logcat lines correctly', async () => {
        const sampleLog = `
01-01 12:00:00.123  1000  1001 I UnitTest: Hello World
01-01 12:00:00.124  1000  1001 D UnitTest: Debug Message
`;
        const postMessageSpy = vi.fn();
        await processLogFile({ file: createMockFile(sampleLog), path: 'test.log' }, postMessageSpy);

        const successCall = postMessageSpy.mock.calls.find(call => call[0].status === 'success');
        expect(successCall).toBeDefined();
        const successData = successCall[0];

        expect(successData.stats.total).toBe(2);
        expect(successData.stats.I).toBe(1);
        expect(successData.stats.D).toBe(1);
    });

    it('should extract CCC messages correctly', async () => {
        const sampleLog = `
01-01 12:00:00.123  1000  1001 I BleConnection/11:22:33:44:55:66: Log msg
01-01 12:00:00.124  1000  1001 I BleConnection/11:22:33:44:55:66: Sending: [00010203]
`;
        const postMessageSpy = vi.fn();
        await processLogFile({ file: createMockFile(sampleLog), path: 'test.log' }, postMessageSpy);

        const successCall = postMessageSpy.mock.calls.find(call => call[0].status === 'success');
        const successData = successCall[0];

        expect(successData.cccMessages.length).toBe(1);
        expect(successData.cccMessages[0].fullHex).toBe('00010203');
        expect(successData.cccMessages[0].peerAddress).toBe('11:22:33:44:55:66');
    });

    it('should detect services status', async () => {
        const sampleLog = `
01-01 12:00:00.123  1000  1001 I Tag: Bluetooth is on
01-01 12:00:00.124  1000  1001 I Tag: WiFi is on
`;
        const postMessageSpy = vi.fn();
        await processLogFile({ file: createMockFile(sampleLog), path: 'test.log' }, postMessageSpy);

        const successCall = postMessageSpy.mock.calls.find(call => call[0].status === 'success');
        const highlights = successCall[0].highlights;

        expect(highlights.deviceEvents.some(e => e.event === 'Bluetooth Status' && e.detail === 'On')).toBe(true);
        expect(highlights.deviceEvents.some(e => e.event === 'Wi-Fi Status' && e.detail === 'On')).toBe(true);
    });

    it('should parse Thermal and Battery info', async () => {
        const sampleLog = `
01-01 12:00:00.123  1000  1001 I Thermal : SIOP:: AP:330 SKIN:310
01-01 12:00:00.124  1000  1001 I Battery : level: 85 scale: 100
`;
        const postMessageSpy = vi.fn();
        await processLogFile({ file: createMockFile(sampleLog), path: 'test.log' }, postMessageSpy);

        const successCall = postMessageSpy.mock.calls.find(call => call[0].status === 'success');
        const data = successCall[0];

        // Battery
        expect(data.batteryDataPoints.length).toBe(1);
        expect(data.batteryDataPoints[0].level).toBe(85);

        // Thermal
        expect(data.thermalDataPoints.length).toBe(1);
        // data.thermalDataPoints[0] should be object { AP: 330, SKIN: 310 ... }
        expect(data.thermalDataPoints[0].AP).toBe(330);
        expect(data.thermalDataPoints[0].SKIN).toBe(310);
    });

    it('should parse Weaver log format', async () => {
        const sampleLog = `[12-31 23:59:59.123][1000][WeaverTag] Weaver Message content`;
        const postMessageSpy = vi.fn();
        await processLogFile({ file: createMockFile(sampleLog), path: 'test.log' }, postMessageSpy);

        const chunkCall = postMessageSpy.mock.calls.find(call => call[0].status === 'chunk');
        expect(chunkCall).toBeDefined();
        const line = chunkCall[0].parsedLines[0]; // First line might be meta, check lines
        const weaverLine = chunkCall[0].parsedLines.find(l => !l.isMeta);

        expect(weaverLine).toBeDefined();
        expect(weaverLine.tag).toBe('WeaverTag');
        expect(weaverLine.message).toBe('Weaver Message content');
        expect(weaverLine.timestamp).toContain('12-31 23:59:59.123');
    });

    it('should parse GPS/Custom log format', async () => {
        // Date Time PID Hex Tag Message
        const sampleLog = `01-02 10:00:00.500 9999 AABBCC GPS_Tag +Message content`;
        const postMessageSpy = vi.fn();
        await processLogFile({ file: createMockFile(sampleLog), path: 'test.log' }, postMessageSpy);

        const chunkCall = postMessageSpy.mock.calls.find(call => call[0].status === 'chunk');
        const logLine = chunkCall[0].parsedLines.find(l => !l.isMeta);

        expect(logLine).toBeDefined();
        // Regex captures tag before spaces. In 'GPS_Tag +Message...', tag is 'GPS_Tag'
        expect(logLine.tag).toBe('GPS_Tag');
        expect(logLine.tid).toBe('AABBCC'); // Mapped to TID/Extra
        expect(logLine.timestamp).toContain('01-02 10:00:00.500');
    });

    it('should parse Process Status (ps) lines', async () => {
        // PID TID User ... Tag
        // 123 456 root ... init
        const sampleLog = `123 456 root 0 0 init`;
        const postMessageSpy = vi.fn();
        await processLogFile({ file: createMockFile(sampleLog), path: 'test.log' }, postMessageSpy);

        const chunkCall = postMessageSpy.mock.calls.find(call => call[0].status === 'chunk');
        const logLine = chunkCall[0].parsedLines.find(l => !l.isMeta);

        expect(logLine).toBeDefined();
        expect(logLine.pid).toBe('123');
        expect(logLine.tid).toBe('456');
        expect(logLine.uid).toBe('root');
        expect(logLine.tag).toBe('init');
    });

    it('should extract App Versions', async () => {
        const sampleLog = `Package [com.example.app] (12345):
    userId=1000
    versionName=1.2.3
`;
        const postMessageSpy = vi.fn();
        await processLogFile({ file: createMockFile(sampleLog), path: 'test.log' }, postMessageSpy);

        const successCall = postMessageSpy.mock.calls.find(call => call[0].status === 'success');
        const appVersions = successCall[0].appVersions; // Array of [pkg, ver]

        // It returns array from Map
        const found = appVersions.find(([pkg, ver]) => pkg === 'com.example.app' && ver === '1.2.3');
        expect(found).toBeDefined();
    });

    it('should handle continuation lines by inheriting timestamp', async () => {
        const sampleLog = `
01-01 12:00:00.123  1000  1001 D Tag: Header Line
Continuation Line 1
Continuation Line 2
01-01 12:00:01.000  1000  1001 D Tag: Next Header Line
`;
        const postMessageSpy = vi.fn();
        await processLogFile({ file: createMockFile(sampleLog), path: 'test.log' }, postMessageSpy);

        const chunkCall = postMessageSpy.mock.calls.find(call => call[0].status === 'chunk');
        expect(chunkCall).toBeDefined();
        const lines = chunkCall[0].parsedLines.filter(l => !l.isMeta);

        expect(lines.length).toBe(4);

        // Check Header Line
        expect(lines[0].message).toBe('Header Line');
        expect(lines[0].timestamp).toContain('12:00:00.123');

        // Check Continuation Line 1
        expect(lines[1].originalText).toContain('Continuation Line 1');
        expect(lines[1].timestamp).toBe(lines[0].timestamp); // Should inherit
        expect(lines[1].date).toBe(lines[0].date);
        expect(lines[1].time).toBe(lines[0].time);
        expect(lines[1].level).toBe('V');

        // Check Continuation Line 2
        expect(lines[2].originalText).toContain('Continuation Line 2');
        expect(lines[2].timestamp).toBe(lines[0].timestamp); // Should inherit
        expect(lines[2].level).toBe('V');
    });
});

