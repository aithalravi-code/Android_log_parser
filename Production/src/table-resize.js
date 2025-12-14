/**
 * Table Column Resize Utility
 * Makes table columns resizable by adding drag handles to headers
 */

function makeTableResizable(tableId) {
    console.log(`[makeTableResizable] Called for table: ${tableId}`);
    const table = document.getElementById(tableId);
    if (!table) {
        console.warn(`Table with ID "${tableId}" not found`);
        return;
    }
    console.log(`[makeTableResizable] Table element found:`, table);

    const thead = table.querySelector('thead');
    if (!thead) {
        console.warn(`Table "${tableId}" has no thead`);
        return;
    }
    console.log(`[makeTableResizable] thead found:`, thead);

    const headerRow = thead.querySelector('tr:not(.filter-row)');
    if (!headerRow) {
        console.warn(`Table "${tableId}" has no header row`);
        return;
    }
    console.log(`[makeTableResizable] headerRow found:`, headerRow);

    // Add resize handles to each th
    const headers = headerRow.querySelectorAll('th');
    console.log(`[makeTableResizable] Found ${headers.length} header cells`);
    headers.forEach((th, index) => {
        // Skip if already has a resize handle
        if (th.querySelector('.resize-handle-col')) {
            console.log(`[makeTableResizable] Column ${index} already has resize handle, skipping`);
            return;
        }

        // Make th position relative for absolute positioning of handle
        th.style.position = 'relative';

        // Create resize handle
        const handle = document.createElement('div');
        handle.className = 'resize-handle-col';
        handle.style.cssText = `
            position: absolute;
            top: 0;
            right: 0;
            width: 5px;
            height: 100%;
            cursor: col-resize;
            user-select: none;
            z-index: 10;
            background-color: rgba(255, 0, 0, 0.2);
        `;
        th.appendChild(handle);
        console.log(`[makeTableResizable] Added resize handle to column ${index}`);
    });

    // Resize logic
    let thBeingResized = null;
    let startX = 0;
    let startWidth = 0;

    headerRow.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('resize-handle-col')) {
            console.log(`[makeTableResizable] Resize handle clicked on table ${tableId}`);
            e.preventDefault();
            thBeingResized = e.target.parentElement;
            startX = e.pageX;
            startWidth = thBeingResized.offsetWidth;

            const onMouseMove = (moveEvent) => {
                if (thBeingResized) {
                    const diffX = moveEvent.pageX - startX;
                    const newWidth = Math.max(50, startWidth + diffX);
                    thBeingResized.style.width = `${newWidth}px`;
                    thBeingResized.style.minWidth = `${newWidth}px`;

                    // Update corresponding filter row cell if it exists
                    const filterRow = thead.querySelector('.filter-row');
                    if (filterRow) {
                        const headerCells = Array.from(headerRow.children);
                        const cellIndex = headerCells.indexOf(thBeingResized);
                        const filterCell = filterRow.children[cellIndex];

                        if (filterCell) {
                            filterCell.style.width = `${newWidth}px`;
                            filterCell.style.minWidth = `${newWidth}px`;

                            // Update input width
                            const filterInput = filterCell.querySelector('input');
                            if (filterInput) {
                                filterInput.style.width = '100%';
                                filterInput.style.boxSizing = 'border-box';
                            }
                        }
                    }

                    // Check if table uses CSS Grid (for appVersionsTable)
                    const tableStyle = window.getComputedStyle(table);
                    const isGridTable = tableStyle.display === 'grid';

                    if (isGridTable) {
                        // Build new grid-template-columns from all header widths
                        const allHeaders = Array.from(headerRow.children);
                        const columnWidths = allHeaders.map(th => {
                            const w = th.style.width || `${th.offsetWidth}px`;
                            return w;
                        });
                        const gridColumns = columnWidths.join(' ');

                        // Update table's grid-template-columns (for display: contents headers)
                        table.style.gridTemplateColumns = gridColumns;

                        // Update all tbody rows' grid-template-columns
                        const tbody = table.querySelector('tbody');
                        if (tbody) {
                            const rows = tbody.querySelectorAll('tr');
                            rows.forEach(row => {
                                row.style.gridTemplateColumns = gridColumns;
                            });
                        }
                    } else {
                        // Traditional table: update all tbody cells in this column
                        const tbody = table.querySelector('tbody');
                        if (tbody) {
                            const rows = tbody.querySelectorAll('tr');
                            const headerCells = Array.from(headerRow.children);
                            const cellIndex = headerCells.indexOf(thBeingResized);

                            rows.forEach(row => {
                                const cell = row.children[cellIndex];
                                if (cell) {
                                    cell.style.width = `${newWidth}px`;
                                    cell.style.minWidth = `${newWidth}px`;
                                    cell.style.maxWidth = `${newWidth}px`;
                                    // For flex-based layouts, also set flex properties
                                    cell.style.flex = `0 0 ${newWidth}px`;
                                    cell.style.flexBasis = `${newWidth}px`;
                                    cell.style.overflow = 'hidden';
                                    cell.style.textOverflow = 'ellipsis';
                                }
                            });
                        }

                        // Also update the header cell flex properties
                        thBeingResized.style.flex = `0 0 ${newWidth}px`;
                        thBeingResized.style.flexBasis = `${newWidth}px`;
                    }
                }
            };

            const onMouseUp = () => {
                console.log(`[makeTableResizable] Resize complete for table ${tableId}`);
                thBeingResized = null;
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        }
    });

    console.log(`Table "${tableId}" is now resizable`);
}

// Export as ES6 module
export { makeTableResizable };

// Also expose globally for backward compatibility
if (typeof window !== 'undefined') {
    window.makeTableResizable = makeTableResizable;
}
