import { describe, it, expect, vi } from 'vitest';
import { processLogFile } from '../../Production/src/infra/workers/logParser.worker.js';

describe('logParser.worker.js', () => {
    it('should parse standard logcat lines correctly', async () => {
        const sampleLog = `
01-01 12:00:00.123  1000  1001 I UnitTest: Hello World
01-01 12:00:00.124  1000  1001 D UnitTest: Debug Message
`;
        // Mock Blob/File behavior (simple stream mock)
        const mockFile = {
            stream: () => {
                const encoder = new TextEncoder();
                const stream = new ReadableStream({
                    start(controller) {
                        controller.enqueue(encoder.encode(sampleLog));
                        controller.close();
                    }
                });
                return stream;
            }
        };

        const postMessageSpy = vi.fn();
        await processLogFile({ file: mockFile, path: 'test.log' }, postMessageSpy);

        // Expect multiple calls: chunks, debug, success
        // Filter for the success message to check stats
        const successCall = postMessageSpy.mock.calls.find(call => call[0].status === 'success');
        expect(successCall).toBeDefined();
        const successData = successCall[0];

        expect(successData.stats.total).toBe(2);
        expect(successData.stats.I).toBe(1);
        expect(successData.stats.D).toBe(1);
        expect(successData.highlights).toBeDefined();
    });

    it('should extract CCC messages correctly', async () => {
        const sampleLog = `
01-01 12:00:00.123  1000  1001 I BleConnection/11:22:33:44:55:66: Log msg
01-01 12:00:00.124  1000  1001 I BleConnection/11:22:33:44:55:66: Sending: [00010203]
`;
        const mockFile = {
            stream: () => {
                const encoder = new TextEncoder();
                const stream = new ReadableStream({
                    start(controller) {
                        controller.enqueue(encoder.encode(sampleLog));
                        controller.close();
                    }
                });
                return stream;
            }
        };

        const postMessageSpy = vi.fn();
        await processLogFile({ file: mockFile, path: 'test.log' }, postMessageSpy);

        const successCall = postMessageSpy.mock.calls.find(call => call[0].status === 'success');
        expect(successCall).toBeDefined();
        const successData = successCall[0];

        expect(successData.cccMessages).toBeDefined();
        expect(successData.cccMessages.length).toBe(1);
        expect(successData.cccMessages[0].fullHex).toBe('00010203');
        expect(successData.cccMessages[0].peerAddress).toBe('11:22:33:44:55:66');
    });

    it('should detect services status', async () => {
        const sampleLog = `
01-01 12:00:00.123  1000  1001 I Tag: Bluetooth is on
01-01 12:00:00.124  1000  1001 I Tag: WiFi is on
`;
        const mockFile = {
            stream: () => {
                const encoder = new TextEncoder();
                const stream = new ReadableStream({
                    start(controller) {
                        controller.enqueue(encoder.encode(sampleLog));
                        controller.close();
                    }
                });
                return stream;
            }
        };

        const postMessageSpy = vi.fn();
        await processLogFile({ file: mockFile, path: 'test.log' }, postMessageSpy);

        const successCall = postMessageSpy.mock.calls.find(call => call[0].status === 'success');
        const highlights = successCall[0].highlights;

        const btEvent = highlights.deviceEvents.find(e => e.event === 'Bluetooth Status' && e.detail === 'On');
        const wifiEvent = highlights.deviceEvents.find(e => e.event === 'Wi-Fi Status' && e.detail === 'On');

        expect(btEvent).toBeDefined();
        expect(wifiEvent).toBeDefined();
    });
});
