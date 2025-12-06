/**
 * Table Column Resize Utility
 * Makes table columns resizable by adding drag handles to headers
 */

function makeTableResizable(tableId) {
    const table = document.getElementById(tableId);
    if (!table) {
        console.warn(`Table with ID "${tableId}" not found`);
        return;
    }

    const thead = table.querySelector('thead');
    if (!thead) {
        console.warn(`Table "${tableId}" has no thead`);
        return;
    }

    const headerRow = thead.querySelector('tr:not(.filter-row)');
    if (!headerRow) {
        console.warn(`Table "${tableId}" has no header row`);
        return;
    }

    // Add resize handles to each th
    const headers = headerRow.querySelectorAll('th');
    headers.forEach((th, index) => {
        // Skip if already has a resize handle
        if (th.querySelector('.resize-handle-col')) return;

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
        `;
        th.appendChild(handle);
    });

    // Resize logic
    let thBeingResized = null;
    let startX = 0;
    let startWidth = 0;

    headerRow.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('resize-handle-col')) {
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

                    // Update all tbody cells in this column
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
                                cell.style.overflow = 'hidden';
                                cell.style.textOverflow = 'ellipsis';
                            }
                        });
                    }
                }
            };

            const onMouseUp = () => {
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

// Export for use in main.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { makeTableResizable };
}
