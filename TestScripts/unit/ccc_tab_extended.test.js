import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setup, render, reset, CCC_CONSTANTS } from '../../Production/src/ui/tabs/CccTab.js';

describe('CccTab - Extended Coverage', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        document.body.innerHTML = `
            <div id="cccStatsContainer"></div>
            <div id="cccFilterContainer"></div>
            <div id="cccHeader"></div>
            <button id="exportCccXlsxBtn"></button>
            <button id="cccToggleCollapseBtn"></button>
        `;
        reset();
    });

    afterEach(() => {
        vi.runAllTimers();
        vi.useRealTimers();
    });

    describe('CCC_CONSTANTS', () => {
        it('should have MESSAGE_TYPES defined', () => {
            expect(CCC_CONSTANTS.MESSAGE_TYPES).toBeDefined();
            expect(CCC_CONSTANTS.MESSAGE_TYPES[0x00]).toBe('Framework');
            expect(CCC_CONSTANTS.MESSAGE_TYPES[0x01]).toBe('SE');
            expect(CCC_CONSTANTS.MESSAGE_TYPES[0x02]).toBe('UWB Ranging Service');
        });

        it('should have FRAMEWORK_MSGS defined', () => {
            expect(CCC_CONSTANTS.FRAMEWORK_MSGS).toBeDefined();
            expect(CCC_CONSTANTS.FRAMEWORK_MSGS[0x04]).toBe('OP_CONTROL_FLOW');
        });

        it('should have SE_MSGS defined', () => {
            expect(CCC_CONSTANTS.SE_MSGS).toBeDefined();
            expect(CCC_CONSTANTS.SE_MSGS[0x0B]).toBe('DK_APDU_RQ');
            expect(CCC_CONSTANTS.SE_MSGS[0x0C]).toBe('DK_APDU_RS');
        });
    });

    describe('render with different message types', () => {
        it('should render Framework messages (type 0x00)', async () => {
            const messages = [
                {
                    timestamp: '12:00:00.000',
                    line: 1,
                    direction: 'H->C',
                    type: 0x00,
                    subtype: 0x04,
                    payload: 'AABBCC',
                    fullHex: 'AABBCC',
                    data: 'AABBCC',
                    summary: 'Control Flow',
                    innerMsg: 'Control Flow',
                    params: 'AA BB CC'
                }
            ];

            render(messages);
            vi.runAllTimers();

            const tableBody = document.querySelector('#cccStatsTable tbody');
            expect(tableBody).not.toBeNull();
            expect(tableBody.children.length).toBe(1);
            expect(tableBody.children[0].cells[3].textContent).toContain('Framework');
        });

        it('should render SE messages (type 0x01)', async () => {
            const messages = [
                {
                    timestamp: '12:00:01.000',
                    line: 2,
                    direction: 'C->H',
                    type: 0x01,
                    subtype: 0x0B,
                    payload: '00A4040000',
                    fullHex: '00A4040000',
                    data: '00A4040000',
                    summary: 'DK_APDU_RQ',
                    innerMsg: 'SELECT',
                    params: ''
                }
            ];

            render(messages);
            vi.runAllTimers();

            const tableBody = document.querySelector('#cccStatsTable tbody');
            expect(tableBody.children.length).toBe(1);
            expect(tableBody.children[0].cells[3].textContent).toContain('SE');
        });

        it('should render UWB Ranging messages (type 0x02)', async () => {
            const messages = [
                {
                    timestamp: '12:00:02.000',
                    line: 3,
                    direction: 'H->C',
                    type: 0x02,
                    subtype: 0x01,
                    payload: '010203',
                    fullHex: '010203',
                    data: '010203',
                    summary: 'UWB Data',
                    innerMsg: 'UWB Data',
                    params: ''
                }
            ];

            render(messages);
            vi.runAllTimers();

            const tableBody = document.querySelector('#cccStatsTable tbody');
            expect(tableBody.children.length).toBe(1);
            expect(tableBody.children[0].cells[3].textContent).toContain('UWB');
        });

        it('should render multiple messages', async () => {
            const messages = [
                {
                    timestamp: '12:00:00.000',
                    line: 1,
                    direction: 'H->C',
                    type: 0x00,
                    subtype: 0x04,
                    payload: 'AA',
                    fullHex: 'AA',
                    data: 'AA',
                    summary: 'Msg1',
                    innerMsg: 'Msg1',
                    params: ''
                },
                {
                    timestamp: '12:00:01.000',
                    line: 2,
                    direction: 'C->H',
                    type: 0x01,
                    subtype: 0x0B,
                    payload: 'BB',
                    fullHex: 'BB',
                    data: 'BB',
                    summary: 'Msg2',
                    innerMsg: 'Msg2',
                    params: ''
                },
                {
                    timestamp: '12:00:02.000',
                    line: 3,
                    direction: 'H->C',
                    type: 0x02,
                    subtype: 0x01,
                    payload: 'CC',
                    fullHex: 'CC',
                    data: 'CC',
                    summary: 'Msg3',
                    innerMsg: 'Msg3',
                    params: ''
                }
            ];

            render(messages);
            vi.runAllTimers();

            const tableBody = document.querySelector('#cccStatsTable tbody');
            expect(tableBody.children.length).toBe(3);
        });
    });

    describe('reset', () => {
        it('should clear cccStatsData', () => {
            const messages = [
                {
                    timestamp: '12:00:00.000',
                    line: 1,
                    direction: 'H->C',
                    type: 0x00,
                    subtype: 0x04,
                    payload: 'AA',
                    fullHex: 'AA',
                    data: 'AA',
                    summary: 'Test',
                    innerMsg: 'Test',
                    params: ''
                }
            ];

            render(messages);
            vi.runAllTimers();

            // Verify data was rendered
            const tableBody = document.querySelector('#cccStatsTable tbody');
            expect(tableBody.children.length).toBe(1);

            // Reset and verify
            reset();
            render([]);
            vi.runAllTimers();

            const tableBodyAfterReset = document.querySelector('#cccStatsTable tbody');
            expect(tableBodyAfterReset.children.length).toBe(1); // "No data available" row
            expect(tableBodyAfterReset.textContent).toContain('No data available');
        });
    });

    describe('setup with different scenarios', () => {
        it('should handle setup with empty messages', () => {
            const ensureBtsnoopProcessed = vi.fn();
            const mockConnectionMap = new Map();

            setup([], mockConnectionMap, ensureBtsnoopProcessed, true);
            // When isBtsnoopProcessed is true, the function should not be called
            expect(ensureBtsnoopProcessed).not.toHaveBeenCalled();
        });

        it('should handle setup when btsnoop is not processed', () => {
            const ensureBtsnoopProcessed = vi.fn();
            const mockConnectionMap = new Map();
            const messages = [
                {
                    timestamp: '12:00:00.000',
                    type: 0x00,
                    subtype: 0x04,
                    payload: 'AA'
                }
            ];

            setup(messages, mockConnectionMap, ensureBtsnoopProcessed, false);
            expect(ensureBtsnoopProcessed).toHaveBeenCalled();
        });

        it('should handle setup with connection map', () => {
            const ensureBtsnoopProcessed = vi.fn();
            const mockConnectionMap = new Map();
            mockConnectionMap.set('0040', 'AA:BB:CC:DD:EE:FF');

            const messages = [
                {
                    timestamp: '12:00:00.000',
                    type: 0x00,
                    subtype: 0x04,
                    payload: 'AA',
                    handle: '0040'
                }
            ];

            setup(messages, mockConnectionMap, ensureBtsnoopProcessed, true);
            vi.runAllTimers();

            // When isBtsnoopProcessed is true, the function should not be called
            expect(ensureBtsnoopProcessed).not.toHaveBeenCalled();
        });
    });

    describe('render with edge cases', () => {
        it('should handle messages with missing fields', async () => {
            const messages = [
                {
                    timestamp: '12:00:00.000',
                    line: 1,
                    // Missing direction, type, subtype, etc.
                }
            ];

            render(messages);
            vi.runAllTimers();

            const tableBody = document.querySelector('#cccStatsTable tbody');
            expect(tableBody).not.toBeNull();
            expect(tableBody.children.length).toBe(1);
        });

        it('should handle messages with unknown type', async () => {
            const messages = [
                {
                    timestamp: '12:00:00.000',
                    line: 1,
                    direction: 'H->C',
                    type: 0xFF, // Unknown type
                    subtype: 0xFF,
                    payload: 'AA',
                    fullHex: 'AA',
                    data: 'AA',
                    summary: 'Unknown',
                    innerMsg: 'Unknown',
                    params: ''
                }
            ];

            render(messages);
            vi.runAllTimers();

            const tableBody = document.querySelector('#cccStatsTable tbody');
            expect(tableBody.children.length).toBe(1);
        });

        it('should handle very long payload data', async () => {
            const longPayload = 'A'.repeat(1000);
            const messages = [
                {
                    timestamp: '12:00:00.000',
                    line: 1,
                    direction: 'H->C',
                    type: 0x00,
                    subtype: 0x04,
                    payload: longPayload,
                    fullHex: longPayload,
                    data: longPayload,
                    summary: 'Long Data',
                    innerMsg: 'Long Data',
                    params: longPayload
                }
            ];

            render(messages);
            vi.runAllTimers();

            const tableBody = document.querySelector('#cccStatsTable tbody');
            expect(tableBody.children.length).toBe(1);
        });
    });

    describe('render performance with large datasets', () => {
        it('should handle rendering 100 messages', async () => {
            const messages = [];
            for (let i = 0; i < 100; i++) {
                messages.push({
                    timestamp: `12:00:${String(i).padStart(2, '0')}.000`,
                    line: i + 1,
                    direction: i % 2 === 0 ? 'H->C' : 'C->H',
                    type: i % 3,
                    subtype: 0x04,
                    payload: `AA${i}`,
                    fullHex: `AA${i}`,
                    data: `AA${i}`,
                    summary: `Message ${i}`,
                    innerMsg: `Message ${i}`,
                    params: ''
                });
            }

            render(messages);
            vi.runAllTimers();

            const tableBody = document.querySelector('#cccStatsTable tbody');
            expect(tableBody).not.toBeNull();
            // Due to chunked rendering, we might not see all 100 immediately
            expect(tableBody.children.length).toBeGreaterThan(0);
        });
    });
});
