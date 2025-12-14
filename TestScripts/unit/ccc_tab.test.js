import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setup, render, reset, CCC_CONSTANTS } from '../../Production/src/ui/tabs/CccTab.js';

describe('CccTab', () => {
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

    describe('render', () => {
        it('should render CCC messages', async () => {
            const messages = [
                {
                    timestamp: '12:00:00.000',
                    line: 1,
                    direction: 'H->C',
                    type: 0x00, // Framework
                    subtype: 0x04,
                    payload: 'AABBCC', // Add payload for decodePayload
                    fullHex: 'AABBCC',
                    data: 'AABBCC',
                    summary: 'Data PDU',
                    innerMsg: 'Data PDU',
                    params: 'AA BB CC'
                }
            ];

            render(messages);
            vi.runAllTimers();

            // Query table body after render updates DOM
            const tableBody = document.querySelector('#cccStatsTable tbody');
            expect(tableBody).not.toBeNull();

            // Check if rows added
            expect(tableBody.children.length).toBe(1);
            const row = tableBody.children[0];
            expect(row.cells[0].textContent).toBe('12:00:00.000');
            expect(row.cells[2].textContent).toBe('H->C');
            expect(row.cells[3].textContent).toContain('Framework'); // Category
            expect(row.cells[5].textContent).toContain('Data PDU'); // innerMessage from decodePayload
        });

        it('should handle empty messages', () => {
            render([]);
            vi.runAllTimers();

            const tableBody = document.querySelector('#cccStatsTable tbody');
            expect(tableBody).not.toBeNull();
            expect(tableBody.children.length).toBe(1);
            expect(tableBody.textContent).toContain('No data available');
        });
    });

    describe('setup', () => {
        it('should initialize and attach listeners', () => {
            const ensureBtsnoopProcessed = vi.fn();
            const mockConnectionMap = new Map();

            setup([], mockConnectionMap, ensureBtsnoopProcessed, false);
            expect(ensureBtsnoopProcessed).toHaveBeenCalled();
        });

        it('should setup with existing messages', () => {
            const messages = [{ timestamp: '12:00:00.000', type: 0x00 }];
            setup(messages, new Map(), vi.fn(), true);
            vi.runAllTimers();

            const tableBody = document.querySelector('#cccStatsTable tbody');
            expect(tableBody).not.toBeNull();
            expect(tableBody.children.length).toBeGreaterThan(0);
        });
    });
});
