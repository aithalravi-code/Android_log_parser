import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeTableResizable } from '../../Production/src/table-resize.js';

describe('table-resize - Extended Coverage', () => {
    let mockTable;

    beforeEach(() => {
        // Create a complete table structure
        document.body.innerHTML = `
            <table id="testTable">
                <thead>
                    <tr>
                        <th>Column 1</th>
                        <th>Column 2</th>
                        <th>Column 3</th>
                    </tr>
                    <tr class="filter-row">
                        <th><input type="text" /></th>
                        <th><input type="text" /></th>
                        <th><input type="text" /></th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Data 1</td>
                        <td>Data 2</td>
                        <td>Data 3</td>
                    </tr>
                    <tr>
                        <td>Data 4</td>
                        <td>Data 5</td>
                        <td>Data 6</td>
                    </tr>
                </tbody>
            </table>
            <table id="tableWithoutThead">
                <tbody>
                    <tr><td>No thead</td></tr>
                </tbody>
            </table>
            <table id="tableWithoutHeaderRow">
                <thead></thead>
                <tbody>
                    <tr><td>No header row</td></tr>
                </tbody>
            </table>
        `;
        mockTable = document.getElementById('testTable');
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    describe('makeTableResizable', () => {
        it('should add resize handles to all header cells', () => {
            makeTableResizable('testTable');

            const headers = mockTable.querySelectorAll('thead tr:not(.filter-row) th');
            expect(headers.length).toBe(3);

            headers.forEach((th) => {
                const handle = th.querySelector('.resize-handle-col');
                expect(handle).not.toBeNull();
                expect(th.style.position).toBe('relative');
            });
        });

        it('should not add duplicate resize handles', () => {
            makeTableResizable('testTable');
            makeTableResizable('testTable'); // Call again

            const headers = mockTable.querySelectorAll('thead tr:not(.filter-row) th');
            headers.forEach((th) => {
                const handles = th.querySelectorAll('.resize-handle-col');
                expect(handles.length).toBe(1); // Should still be only 1
            });
        });

        it('should handle table without thead', () => {
            const consoleSpy = vi.spyOn(console, 'warn');
            makeTableResizable('tableWithoutThead');
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('has no thead'));
            consoleSpy.mockRestore();
        });

        it('should handle table without header row', () => {
            const consoleSpy = vi.spyOn(console, 'warn');
            makeTableResizable('tableWithoutHeaderRow');
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('has no header row'));
            consoleSpy.mockRestore();
        });

        it('should handle non-existent table', () => {
            const consoleSpy = vi.spyOn(console, 'warn');
            makeTableResizable('nonExistentTable');
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('not found'));
            consoleSpy.mockRestore();
        });

        it('should resize column on drag', () => {
            makeTableResizable('testTable');

            const headers = mockTable.querySelectorAll('thead tr:not(.filter-row) th');
            const firstHeader = headers[0];
            const handle = firstHeader.querySelector('.resize-handle-col');

            const initialWidth = firstHeader.offsetWidth;

            // Simulate mousedown
            const mousedownEvent = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                pageX: 100
            });
            Object.defineProperty(mousedownEvent, 'target', {
                value: handle,
                writable: false
            });
            handle.dispatchEvent(mousedownEvent);

            // Simulate mousemove
            const mousemoveEvent = new MouseEvent('mousemove', {
                bubbles: true,
                cancelable: true,
                pageX: 150 // Move 50px to the right
            });
            document.dispatchEvent(mousemoveEvent);

            // Check if width was updated
            expect(firstHeader.style.width).toBeTruthy();

            // Simulate mouseup
            const mouseupEvent = new MouseEvent('mouseup', {
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(mouseupEvent);
        });

        it('should enforce minimum width of 50px', () => {
            makeTableResizable('testTable');

            const headers = mockTable.querySelectorAll('thead tr:not(.filter-row) th');
            const firstHeader = headers[0];
            const handle = firstHeader.querySelector('.resize-handle-col');

            // Simulate mousedown
            const mousedownEvent = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                pageX: 100
            });
            Object.defineProperty(mousedownEvent, 'target', {
                value: handle,
                writable: false
            });
            handle.dispatchEvent(mousedownEvent);

            // Simulate mousemove to very small width
            const mousemoveEvent = new MouseEvent('mousemove', {
                bubbles: true,
                cancelable: true,
                pageX: 10 // Try to make it very small
            });
            document.dispatchEvent(mousemoveEvent);

            // Width should be at least 50px
            const width = parseInt(firstHeader.style.width);
            expect(width).toBeGreaterThanOrEqual(50);

            // Cleanup
            document.dispatchEvent(new MouseEvent('mouseup'));
        });

        it('should update filter row cell width when resizing', () => {
            makeTableResizable('testTable');

            const headers = mockTable.querySelectorAll('thead tr:not(.filter-row) th');
            const firstHeader = headers[0];
            const handle = firstHeader.querySelector('.resize-handle-col');

            const filterRow = mockTable.querySelector('.filter-row');
            const firstFilterCell = filterRow.children[0];

            // Simulate resize
            const mousedownEvent = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                pageX: 100
            });
            Object.defineProperty(mousedownEvent, 'target', {
                value: handle,
                writable: false
            });
            handle.dispatchEvent(mousedownEvent);

            const mousemoveEvent = new MouseEvent('mousemove', {
                bubbles: true,
                cancelable: true,
                pageX: 200
            });
            document.dispatchEvent(mousemoveEvent);

            // Filter cell should have width set
            expect(firstFilterCell.style.width).toBeTruthy();

            document.dispatchEvent(new MouseEvent('mouseup'));
        });

        it('should update tbody cell widths when resizing', () => {
            makeTableResizable('testTable');

            const headers = mockTable.querySelectorAll('thead tr:not(.filter-row) th');
            const firstHeader = headers[0];
            const handle = firstHeader.querySelector('.resize-handle-col');

            const tbody = mockTable.querySelector('tbody');
            const firstRow = tbody.children[0];
            const firstCell = firstRow.children[0];

            // Simulate resize
            const mousedownEvent = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                pageX: 100
            });
            Object.defineProperty(mousedownEvent, 'target', {
                value: handle,
                writable: false
            });
            handle.dispatchEvent(mousedownEvent);

            const mousemoveEvent = new MouseEvent('mousemove', {
                bubbles: true,
                cancelable: true,
                pageX: 200
            });
            document.dispatchEvent(mousemoveEvent);

            // Cell should have width, overflow, and text-overflow set
            expect(firstCell.style.width).toBeTruthy();
            expect(firstCell.style.overflow).toBe('hidden');
            expect(firstCell.style.textOverflow).toBe('ellipsis');

            document.dispatchEvent(new MouseEvent('mouseup'));
        });

        it('should clean up event listeners on mouseup', () => {
            makeTableResizable('testTable');

            const headers = mockTable.querySelectorAll('thead tr:not(.filter-row) th');
            const handle = headers[0].querySelector('.resize-handle-col');

            const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

            // Start resize
            const mousedownEvent = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                pageX: 100
            });
            Object.defineProperty(mousedownEvent, 'target', {
                value: handle,
                writable: false
            });
            handle.dispatchEvent(mousedownEvent);

            // End resize
            document.dispatchEvent(new MouseEvent('mouseup'));

            // Should have removed both mousemove and mouseup listeners
            expect(removeEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
            expect(removeEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));

            removeEventListenerSpy.mockRestore();
        });

        it('should expose makeTableResizable globally', () => {
            expect(window.makeTableResizable).toBeDefined();
            expect(typeof window.makeTableResizable).toBe('function');
        });
    });

    describe('edge cases', () => {
        it('should handle table with no tbody', () => {
            document.body.innerHTML = `
                <table id="noTbodyTable">
                    <thead>
                        <tr>
                            <th>Column 1</th>
                        </tr>
                    </thead>
                </table>
            `;

            makeTableResizable('noTbodyTable');

            const table = document.getElementById('noTbodyTable');
            const handle = table.querySelector('.resize-handle-col');
            expect(handle).not.toBeNull();

            // Should not throw error when resizing
            const mousedownEvent = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                pageX: 100
            });
            Object.defineProperty(mousedownEvent, 'target', {
                value: handle,
                writable: false
            });

            expect(() => {
                handle.dispatchEvent(mousedownEvent);
                document.dispatchEvent(new MouseEvent('mousemove', { pageX: 150 }));
                document.dispatchEvent(new MouseEvent('mouseup'));
            }).not.toThrow();
        });

        it('should handle table with no filter row', () => {
            document.body.innerHTML = `
                <table id="noFilterTable">
                    <thead>
                        <tr>
                            <th>Column 1</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td>Data</td></tr>
                    </tbody>
                </table>
            `;

            makeTableResizable('noFilterTable');

            const table = document.getElementById('noFilterTable');
            const handle = table.querySelector('.resize-handle-col');

            // Should not throw error when resizing without filter row
            const mousedownEvent = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                pageX: 100
            });
            Object.defineProperty(mousedownEvent, 'target', {
                value: handle,
                writable: false
            });

            expect(() => {
                handle.dispatchEvent(mousedownEvent);
                document.dispatchEvent(new MouseEvent('mousemove', { pageX: 150 }));
                document.dispatchEvent(new MouseEvent('mouseup'));
            }).not.toThrow();
        });
    });
});
