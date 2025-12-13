/**
 * Makes a table sortable.
 * Assumes headers are in <thead > and rows in <tbody >.
 * 
 * @param {string} tableId - The ID of the table to sort.
 * @param {number|null} defaultSortColumn - The index of the column to sort by default.
 * @param {string} defaultSortOrder - 'asc' or 'desc'.
 */
export function makeSortable(tableId, defaultSortColumn = null, defaultSortOrder = 'desc') {
    const table = document.getElementById(tableId);
    if (!table) {
        console.warn(`[Sorting] Table not found: ${tableId} `);
        return;
    }

    const thead = table.querySelector('thead');
    if (!thead) {
        console.warn(`[Sorting] No thead found for table: ${tableId} `);
        return;
    }

    // Find the header row (first row that doesn't have inputs)
    const rows = Array.from(thead.querySelectorAll('tr'));
    let headerRow = null;

    for (const row of rows) {
        const hasInputs = row.querySelector('input') !== null;
        if (!hasInputs) {
            headerRow = row;
            break;
        }
    }

    if (!headerRow) {
        console.warn(`[Sorting] No header row without inputs found for table: ${tableId} `);
        return;
    }

    const headers = headerRow.querySelectorAll('th');
    if (headers.length === 0) {
        console.warn(`[Sorting] No < th > elements found in header row for table: ${tableId} `);
        return;
    }

    console.log(`[Sorting] Making table sortable: ${tableId}, ${headers.length} columns`);

    headers.forEach((header, index) => {
        header.style.cursor = 'pointer';
        header.classList.add('sortable');
        header.title = 'Click to sort';

        header.addEventListener('click', (e) => {
            // Don't sort if clicking on or within resize handle
            if (e.target.classList.contains('resize-handle-col') ||
                e.target.closest('.resize-handle-col')) {
                console.log(`[Sort] Ignoring click on resize handle`);
                return;
            }
            console.log(`[Sort] Header clicked: ${tableId}, column ${index}, text = "${header.textContent.trim()}"`);
            sortTable(tableId, index);
        });
    });

    // Apply default sort
    if (defaultSortColumn !== null) {
        console.log(`[Sort] Applying default sort: ${tableId}, column ${defaultSortColumn}, order ${defaultSortOrder} `);
        sortTable(tableId, defaultSortColumn, defaultSortOrder);
    }
}

function sortTable(tableId, columnIndex, order = null) {
    console.log(`[Sort] sortTable called: table = ${tableId}, column = ${columnIndex}, order = ${order} `);

    const table = document.getElementById(tableId);
    if (!table) {
        console.error(`[Sort] Table not found: ${tableId} `);
        return;
    }

    const tbody = table.querySelector('tbody');
    // const headerRow = table.querySelector('thead tr:first-child'); 
    // Wait, headerRow logic should mirror makeSortable's discovery logic or assume 
    // headers store sort state. 
    // We need to find the headers again to update indicators.

    // We'll reuse logic to find header row:
    const thead = table.querySelector('thead');
    const rows = Array.from(thead.querySelectorAll('tr'));
    let headerRow = null;
    for (const row of rows) {
        if (!row.querySelector('input')) {
            headerRow = row;
            break;
        }
    }
    if (!headerRow) return;

    const headers = headerRow.querySelectorAll('th');

    if (!tbody) {
        console.error(`[Sort] No tbody found for ${tableId}`);
        return;
    }

    const rowsArray = Array.from(tbody.querySelectorAll('tr'));
    const isAscending = order ? order === 'asc' : !headers[columnIndex].classList.contains('asc');
    const newOrder = isAscending ? 'asc' : 'desc';

    // Update header classes
    headers.forEach(h => h.classList.remove('asc', 'desc'));
    headers[columnIndex].classList.add(newOrder);

    // Sort rows
    rowsArray.sort((a, b) => {
        const aCell = a.children[columnIndex];
        const bCell = b.children[columnIndex];

        if (!aCell || !bCell) return 0;

        // Extract text content only (ignore tooltips etc)
        // Or usage data-log-text if available (better for formatted cells)
        let aValue = aCell.dataset.logText || aCell.textContent.trim();
        let bValue = bCell.dataset.logText || bCell.textContent.trim();

        // Check if values look like timestamps (contain colons or dashes)
        const looksLikeTimestamp = (val) => /\d{1,2}[-:]\d{1,2}/.test(val);

        if (looksLikeTimestamp(aValue) && looksLikeTimestamp(bValue)) {
            // Direct string comparison works well for timestamps in consistent format
            // But if format varies, Date.parse might be needed. 
            // Assuming ISO-ish or consistently formatted log timestamps.
            const result = newOrder === 'asc'
                ? aValue.localeCompare(bValue)
                : bValue.localeCompare(aValue);

            return result;
        }

        // Try parsing as number (for packet numbers, etc)
        const aNum = parseFloat(aValue.replace(/[^0-9.-]/g, ''));
        const bNum = parseFloat(bValue.replace(/[^0-9.-]/g, ''));

        if (!isNaN(aNum) && !isNaN(bNum)) {
            return newOrder === 'asc' ? aNum - bNum : bNum - aNum;
        }

        // String comparison
        return newOrder === 'asc'
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
    });

    // Re-append sorted rows
    rowsArray.forEach(row => tbody.appendChild(row));

    // Restore scroll position and selection after sorting
    if (window.selectedTableRows) {
        const selectedRowId = window.selectedTableRows.get(tableId);
        if (selectedRowId) {
            const selectedRow = tbody.querySelector(`tr[data-row-id="${selectedRowId}"]`);
            if (selectedRow) {
                // Restore selected class
                selectedRow.classList.add('selected');
                // Scroll into view
                selectedRow.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                console.log(`[Sort] Restored selection for ${tableId} -> ${selectedRowId}`);
            }
        }
    }

    console.log(`[Sort] ✓ Sorted ${tableId} successfully`);
}
