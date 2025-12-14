import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { makeSortable } from '../../Production/src/table-sort.js';

describe('Table Sort - Extended Coverage', () => {
    beforeEach(() => {
        // Clear any global state
        window.selectedTableRows = new Map();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        delete window.selectedTableRows;
    });

    describe('Edge Cases - Table Structure', () => {
        it('should handle table without thead', () => {
            document.body.innerHTML = `
                <table id="noThead">
                    <tbody>
                        <tr><td>Data</td></tr>
                    </tbody>
                </table>
            `;

            expect(() => makeSortable('noThead')).not.toThrow();
        });

        it('should handle thead with only input rows', () => {
            document.body.innerHTML = `
                <table id="onlyInputs">
                    <thead>
                        <tr><th><input type="text"></th></tr>
                        <tr><th><input type="text"></th></tr>
                    </thead>
                    <tbody>
                        <tr><td>Data</td></tr>
                    </tbody>
                </table>
            `;

            expect(() => makeSortable('onlyInputs')).not.toThrow();
        });

        it('should handle thead with no th elements', () => {
            document.body.innerHTML = `
                <table id="noHeaders">
                    <thead>
                        <tr><td>Not a header</td></tr>
                    </thead>
                    <tbody>
                        <tr><td>Data</td></tr>
                    </tbody>
                </table>
            `;

            expect(() => makeSortable('noHeaders')).not.toThrow();
        });

        it('should find header row without inputs', () => {
            document.body.innerHTML = `
                <table id="mixedRows">
                    <thead>
                        <tr><th><input type="text"></th></tr>
                        <tr><th>Name</th><th>Age</th></tr>
                    </thead>
                    <tbody>
                        <tr><td>Alice</td><td>25</td></tr>
                    </tbody>
                </table>
            `;

            makeSortable('mixedRows');
            const headers = document.querySelectorAll('#mixedRows thead tr:nth-child(2) th');
            expect(headers[0].classList.contains('sortable')).toBe(true);
        });
    });

    describe('Resize Handle Interaction', () => {
        it('should ignore clicks on resize handle', () => {
            document.body.innerHTML = `
                <table id="withResize">
                    <thead>
                        <tr>
                            <th>Name<div class="resize-handle-col"></div></th>
                            <th>Age</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td>Bob</td><td>30</td></tr>
                        <tr><td>Alice</td><td>25</td></tr>
                    </tbody>
                </table>
            `;

            makeSortable('withResize');

            const resizeHandle = document.querySelector('.resize-handle-col');
            resizeHandle.click();

            // Table should not be sorted
            const rows = document.querySelectorAll('#withResize tbody tr');
            expect(rows[0].children[0].textContent).toBe('Bob'); // Still in original order
        });

        it('should ignore clicks within resize handle', () => {
            document.body.innerHTML = `
                <table id="withNestedResize">
                    <thead>
                        <tr>
                            <th>Name<div class="resize-handle-col"><span>|</span></div></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td>Bob</td></tr>
                        <tr><td>Alice</td></tr>
                    </tbody>
                </table>
            `;

            makeSortable('withNestedResize');

            const innerSpan = document.querySelector('.resize-handle-col span');
            innerSpan.click();

            const rows = document.querySelectorAll('#withNestedResize tbody tr');
            expect(rows[0].children[0].textContent).toBe('Bob');
        });
    });

    describe('Sorting with data-log-text', () => {
        it('should use data-log-text attribute when available', () => {
            document.body.innerHTML = `
                <table id="withDataAttr">
                    <thead>
                        <tr><th>Value</th></tr>
                    </thead>
                    <tbody>
                        <tr><td data-log-text="3">Three (3)</td></tr>
                        <tr><td data-log-text="1">One (1)</td></tr>
                        <tr><td data-log-text="2">Two (2)</td></tr>
                    </tbody>
                </table>
            `;

            makeSortable('withDataAttr');
            const header = document.querySelector('#withDataAttr thead th');
            header.click();

            const rows = document.querySelectorAll('#withDataAttr tbody tr');
            expect(rows[0].children[0].dataset.logText).toBe('1');
            expect(rows[1].children[0].dataset.logText).toBe('2');
            expect(rows[2].children[0].dataset.logText).toBe('3');
        });
    });

    describe('Timestamp Sorting', () => {
        it('should detect and sort timestamps with colons', () => {
            document.body.innerHTML = `
                <table id="timeTable">
                    <thead>
                        <tr><th>Time</th></tr>
                    </thead>
                    <tbody>
                        <tr><td>10:30:00</td></tr>
                        <tr><td>09:15:30</td></tr>
                        <tr><td>11:45:15</td></tr>
                    </tbody>
                </table>
            `;

            makeSortable('timeTable');
            const header = document.querySelector('#timeTable thead th');
            header.click();

            const rows = document.querySelectorAll('#timeTable tbody tr');
            expect(rows[0].children[0].textContent).toBe('09:15:30');
            expect(rows[1].children[0].textContent).toBe('10:30:00');
            expect(rows[2].children[0].textContent).toBe('11:45:15');
        });

        it('should detect and sort timestamps with dashes', () => {
            document.body.innerHTML = `
                <table id="dateTable">
                    <thead>
                        <tr><th>Date</th></tr>
                    </thead>
                    <tbody>
                        <tr><td>2023-12-15</td></tr>
                        <tr><td>2023-12-10</td></tr>
                        <tr><td>2023-12-20</td></tr>
                    </tbody>
                </table>
            `;

            makeSortable('dateTable');
            const header = document.querySelector('#dateTable thead th');
            header.click();

            const rows = document.querySelectorAll('#dateTable tbody tr');
            expect(rows[0].children[0].textContent).toBe('2023-12-10');
            expect(rows[1].children[0].textContent).toBe('2023-12-15');
            expect(rows[2].children[0].textContent).toBe('2023-12-20');
        });

        it('should sort timestamps descending', () => {
            document.body.innerHTML = `
                <table id="timeDesc">
                    <thead>
                        <tr><th>Time</th></tr>
                    </thead>
                    <tbody>
                        <tr><td>10:30:00</td></tr>
                        <tr><td>09:15:30</td></tr>
                    </tbody>
                </table>
            `;

            makeSortable('timeDesc');
            const header = document.querySelector('#timeDesc thead th');
            header.click(); // ASC
            header.click(); // DESC

            const rows = document.querySelectorAll('#timeDesc tbody tr');
            expect(rows[0].children[0].textContent).toBe('10:30:00');
            expect(rows[1].children[0].textContent).toBe('09:15:30');
        });
    });

    describe('Number Sorting with Special Characters', () => {
        it('should extract and sort numbers with units', () => {
            document.body.innerHTML = `
                <table id="unitsTable">
                    <thead>
                        <tr><th>Size</th></tr>
                    </thead>
                    <tbody>
                        <tr><td>100 KB</td></tr>
                        <tr><td>50 KB</td></tr>
                        <tr><td>200 KB</td></tr>
                    </tbody>
                </table>
            `;

            makeSortable('unitsTable');
            const header = document.querySelector('#unitsTable thead th');
            header.click();

            const rows = document.querySelectorAll('#unitsTable tbody tr');
            expect(rows[0].children[0].textContent).toBe('50 KB');
            expect(rows[1].children[0].textContent).toBe('100 KB');
            expect(rows[2].children[0].textContent).toBe('200 KB');
        });

        it('should handle negative numbers', () => {
            document.body.innerHTML = `
                <table id="negativeTable">
                    <thead>
                        <tr><th>Value</th></tr>
                    </thead>
                    <tbody>
                        <tr><td>-5</td></tr>
                        <tr><td>10</td></tr>
                        <tr><td>-15</td></tr>
                    </tbody>
                </table>
            `;

            makeSortable('negativeTable');
            const header = document.querySelector('#negativeTable thead th');
            header.click();

            const rows = document.querySelectorAll('#negativeTable tbody tr');
            expect(rows[0].children[0].textContent).toBe('-15');
            expect(rows[1].children[0].textContent).toBe('-5');
            expect(rows[2].children[0].textContent).toBe('10');
        });

        it('should handle decimal numbers', () => {
            document.body.innerHTML = `
                <table id="decimalTable">
                    <thead>
                        <tr><th>Value</th></tr>
                    </thead>
                    <tbody>
                        <tr><td>3.14</td></tr>
                        <tr><td>1.5</td></tr>
                        <tr><td>2.7</td></tr>
                    </tbody>
                </table>
            `;

            makeSortable('decimalTable');
            const header = document.querySelector('#decimalTable thead th');
            header.click();

            const rows = document.querySelectorAll('#decimalTable tbody tr');
            expect(rows[0].children[0].textContent).toBe('1.5');
            expect(rows[1].children[0].textContent).toBe('2.7');
            expect(rows[2].children[0].textContent).toBe('3.14');
        });
    });

    describe('Scroll Restoration', () => {
        it('should restore selected row after sorting', () => {
            document.body.innerHTML = `
                <table id="scrollTable">
                    <thead>
                        <tr><th>Name</th></tr>
                    </thead>
                    <tbody>
                        <tr data-row-id="row1"><td>Charlie</td></tr>
                        <tr data-row-id="row2" class="selected"><td>Alice</td></tr>
                        <tr data-row-id="row3"><td>Bob</td></tr>
                    </tbody>
                </table>
            `;

            window.selectedTableRows = new Map([['scrollTable', 'row2']]);
            // Mock scrollIntoView
            Element.prototype.scrollIntoView = () => {};

            makeSortable('scrollTable');
            const header = document.querySelector('#scrollTable thead th');
            header.click();

            const selectedRow = document.querySelector('#scrollTable tbody tr.selected');
            expect(selectedRow).not.toBeNull();
            expect(selectedRow.dataset.rowId).toBe('row2');
        });

        it('should handle missing selected row gracefully', () => {
            document.body.innerHTML = `
                <table id="noSelectedTable">
                    <thead>
                        <tr><th>Name</th></tr>
                    </thead>
                    <tbody>
                        <tr data-row-id="row1"><td>Alice</td></tr>
                    </tbody>
                </table>
            `;

            window.selectedTableRows = new Map([['noSelectedTable', 'nonexistent']]);

            makeSortable('noSelectedTable');
            const header = document.querySelector('#noSelectedTable thead th');

            expect(() => header.click()).not.toThrow();
        });

        it('should handle no selectedTableRows global', () => {
            document.body.innerHTML = `
                <table id="noGlobalTable">
                    <thead>
                        <tr><th>Name</th></tr>
                    </thead>
                    <tbody>
                        <tr><td>Alice</td></tr>
                    </tbody>
                </table>
            `;

            delete window.selectedTableRows;

            makeSortable('noGlobalTable');
            const header = document.querySelector('#noGlobalTable thead th');

            expect(() => header.click()).not.toThrow();
        });
    });

    describe('Empty and Missing Cells', () => {
        it('should handle rows with missing cells', () => {
            document.body.innerHTML = `
                <table id="missingCells">
                    <thead>
                        <tr><th>Col1</th><th>Col2</th></tr>
                    </thead>
                    <tbody>
                        <tr><td>A</td><td>1</td></tr>
                        <tr><td>B</td></tr>
                        <tr><td>C</td><td>3</td></tr>
                    </tbody>
                </table>
            `;

            makeSortable('missingCells');
            const header = document.querySelector('#missingCells thead th:nth-child(2)');

            expect(() => header.click()).not.toThrow();
        });

        it('should handle empty cell content', () => {
            document.body.innerHTML = `
                <table id="emptyCells">
                    <thead>
                        <tr><th>Value</th></tr>
                    </thead>
                    <tbody>
                        <tr><td>B</td></tr>
                        <tr><td></td></tr>
                        <tr><td>A</td></tr>
                    </tbody>
                </table>
            `;

            makeSortable('emptyCells');
            const header = document.querySelector('#emptyCells thead th');
            header.click();

            const rows = document.querySelectorAll('#emptyCells tbody tr');
            expect(rows[0].children[0].textContent).toBe('');
            expect(rows[1].children[0].textContent).toBe('A');
            expect(rows[2].children[0].textContent).toBe('B');
        });
    });

    describe('Default Sort Order', () => {
        it('should apply descending default sort', () => {
            document.body.innerHTML = `
                <table id="descDefault">
                    <thead>
                        <tr><th>Value</th></tr>
                    </thead>
                    <tbody>
                        <tr><td>1</td></tr>
                        <tr><td>3</td></tr>
                        <tr><td>2</td></tr>
                    </tbody>
                </table>
            `;

            makeSortable('descDefault', 0, 'desc');

            const rows = document.querySelectorAll('#descDefault tbody tr');
            expect(rows[0].children[0].textContent).toBe('3');
            expect(rows[1].children[0].textContent).toBe('2');
            expect(rows[2].children[0].textContent).toBe('1');
        });

        it('should handle null default column', () => {
            document.body.innerHTML = `
                <table id="nullDefault">
                    <thead>
                        <tr><th>Value</th></tr>
                    </thead>
                    <tbody>
                        <tr><td>B</td></tr>
                        <tr><td>A</td></tr>
                    </tbody>
                </table>
            `;

            makeSortable('nullDefault', null, 'asc');

            // Should not sort automatically
            const rows = document.querySelectorAll('#nullDefault tbody tr');
            expect(rows[0].children[0].textContent).toBe('B');
        });
    });
});
