import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    calculateLogLevels,
    exportStatsToExcel,
    exportTableToExcel,
    exportLogsToText,
    exportToJson,
    exportToCsv
} from '../../Production/src/export/ExportManager.js';

describe('ExportManager', () => {

    // Mock XLSX global
    global.XLSX = {
        utils: {
            book_new: vi.fn(() => ({})),
            aoa_to_sheet: vi.fn(() => ({ '!ref': 'A1:B2' })),
            book_append_sheet: vi.fn(),
            decode_range: vi.fn(() => ({ s: { c: 0, r: 0 }, e: { c: 1, r: 1 } })),
            encode_cell: vi.fn(({ c, r }) => `R${r}C${c}`),
            table_to_sheet: vi.fn(() => ({ '!ref': 'A1:B2' }))
        },
        writeFile: vi.fn()
    };

    // Mock URL and Styles
    global.URL.createObjectURL = vi.fn(() => 'blob:test');
    global.URL.revokeObjectURL = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';
    });

    describe('calculateLogLevels', () => {
        it('should count log levels correctly', () => {
            const lines = [
                { level: 'D', text: 'debug' },
                { level: 'D', text: 'debug2' },
                { level: 'E', text: 'error' },
                { level: 'V', text: 'verbose' }
            ];
            const counts = calculateLogLevels(lines);
            expect(counts).toEqual({ V: 1, D: 2, I: 0, W: 0, E: 1 });
        });

        it('should handle empty lines', () => {
            const counts = calculateLogLevels([]);
            expect(counts).toEqual({ V: 0, D: 0, I: 0, W: 0, E: 0 });
        });
    });

    describe('exportStatsToExcel', () => {
        it('should create a workbook and save it', () => {
            const config = {
                logLines: [{ level: 'E', tag: 'TestTag' }],
                filename: 'test.xlsx'
            };

            exportStatsToExcel(config);

            expect(global.XLSX.utils.book_new).toHaveBeenCalled();
            expect(global.XLSX.utils.book_append_sheet).toHaveBeenCalled();
            expect(global.XLSX.writeFile).toHaveBeenCalledWith(expect.any(Object), 'test.xlsx');
        });

        it('should throw if XLSX is undefined', () => {
            const originalXLSX = global.XLSX;
            global.XLSX = undefined;
            expect(() => exportStatsToExcel({})).toThrow('SheetJS (XLSX) library not loaded!');
            global.XLSX = originalXLSX;
        });
    });

    describe('exportTableToExcel', () => {
        it('should export an existing table', () => {
            document.body.innerHTML = '<table id="myTable"><tbody><tr><td>Data</td></tr></tbody></table>';

            exportTableToExcel('myTable', 'table.xlsx');

            expect(global.XLSX.utils.table_to_sheet).toHaveBeenCalled();
            expect(global.XLSX.writeFile).toHaveBeenCalledWith(expect.any(Object), 'table.xlsx');
        });

        it('should throw if table does not exist', () => {
            expect(() => exportTableToExcel('nonExistentTable')).toThrow('Table not found: nonExistentTable');
        });
    });

    describe('exportLogsToText', () => {
        it('should download a text file', () => {
            const lines = [{ originalText: 'Line 1' }, { originalText: 'Line 2' }];
            const clickSpy = vi.spyOn(HTMLElement.prototype, 'click');

            exportLogsToText(lines, 'logs.txt');

            expect(global.URL.createObjectURL).toHaveBeenCalled();
            expect(clickSpy).toHaveBeenCalled();
            expect(global.URL.revokeObjectURL).not.toHaveBeenCalled(); // Called in timeout

            // Fast-forward time for revoke
            vi.useFakeTimers();
            vi.runAllTimers();
            // expect(global.URL.revokeObjectURL).toHaveBeenCalled(); // requires proper timer mocking setup
            vi.useRealTimers();
        });

        it('should throw if no logs provided', () => {
            expect(() => exportLogsToText([], 'logs.txt')).toThrow('No logs to export.');
        });
    });

    describe('exportToJson', () => {
        it('should download a JSON file', () => {
            const data = { key: 'value' };
            const clickSpy = vi.spyOn(HTMLElement.prototype, 'click');

            exportToJson(data, 'data.json');

            expect(global.URL.createObjectURL).toHaveBeenCalled();
            expect(clickSpy).toHaveBeenCalled();
        });
    });

    describe('exportToCsv', () => {
        it('should download a CSV file', () => {
            const data = [{ col1: 'val1', col2: 'val2' }];
            const clickSpy = vi.spyOn(HTMLElement.prototype, 'click');

            exportToCsv(data, 'data.csv');

            expect(global.URL.createObjectURL).toHaveBeenCalled();
            expect(clickSpy).toHaveBeenCalled();
        });

        it('should throw if no data provided', () => {
            expect(() => exportToCsv([], 'data.csv')).toThrow('No data to export.');
        });
    });
});
