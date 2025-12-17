/**
 * Export Manager Module
 * Handles all export operations for logs and statistics
 */

/**
 * Calculates log level distribution
 * @param {Array} lines - Log lines to analyze
 * @returns {Object} Log level counts
 */
export function calculateLogLevels(lines) {
    const counts = { V: 0, D: 0, I: 0, W: 0, E: 0 };

    for (const line of lines) {
        if (line.level && counts.hasOwnProperty(line.level)) {
            counts[line.level]++;
        }
    }

    return counts;
}


/**
 * Helper to auto-fit columns based on content
 * @param {Object} ws - The worksheet object
 */
function autoFitColumns(ws) {
    if (!ws || !ws['!ref']) {
        return;
    }

    const range = XLSX.utils.decode_range(ws['!ref']);
    const colWidths = [];

    for (let C = range.s.c; C <= range.e.c; ++C) {
        let maxLen = 0;
        for (let R = range.s.r; R <= range.e.r; ++R) {
            const cellAddress = { c: C, r: R };
            const cellRef = XLSX.utils.encode_cell(cellAddress);
            const cell = ws[cellRef];
            if (cell && cell.v) {
                const cellLen = String(cell.v).length;
                if (cellLen > maxLen) {
                    maxLen = cellLen;
                }
            }
        }
        // Add buffer
        colWidths[C] = { wch: Math.min(maxLen + 2, 50) }; // Cap at 50 chars
    }
    ws['!cols'] = colWidths;
}

/**
 * Helper to apply styles (borders, headers, wrapping)
 * @param {Object} ws - The worksheet object
 */
function applyStyles(ws) {
    if (!ws || !ws['!ref']) {
        return;
    }

    const range = XLSX.utils.decode_range(ws['!ref']);
    const thinBorder = { style: 'thin', color: { rgb: '000000' } };
    const borderStyle = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

    for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellRef = XLSX.utils.encode_cell({ c: C, r: R });
            if (!ws[cellRef]) {
                continue;
            }

            // Base style for all cells
            const style = {
                font: { name: 'Arial', sz: 10 },
                border: borderStyle,
                alignment: { vertical: 'top', wrapText: true }
            };

            // Header Row (Row 0)
            if (R === 0) {
                style.font = { name: 'Arial', sz: 10, bold: true, color: { rgb: '000000' } };
                style.fill = { fgColor: { rgb: 'E0E0E0' } }; // Light Gray
                style.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
            }

            ws[cellRef].s = style;
        }
    }
}

/**
 * Exports statistics to Excel file
 * @param {Object} config - Export configuration
 * ... (existing JSDoc)
 */
export function exportStatsToExcel(config) {
    const {
        logLines = [],
        minLogDate = null,
        maxLogDate = null,
        filename = 'android_log_stats.xlsx'
    } = config;

    if (typeof XLSX === 'undefined') {
        throw new Error('SheetJS (XLSX) library not loaded!');
    }

    const wb = XLSX.utils.book_new();

    // Sheet 1: Log Summary
    const summaryData = [
        ['Analysis Generated', new Date().toLocaleString()],
        ['Total Log Lines', logLines.length],
        ['Start Time', minLogDate ? minLogDate.toISOString() : 'N/A'],
        ['End Time', maxLogDate ? maxLogDate.toISOString() : 'N/A'],
        [],
        ['Log Level Distribution'],
        ['Level', 'Count'], // Add explicit header for styling to pick up
        ...Object.entries(calculateLogLevels(logLines))
    ];

    // Add error distribution
    summaryData.push([], ['Error Tag Distribution'], ['Tag', 'Count']);
    const errorCounts = {};
    logLines.filter(l => l.level === 'E').forEach(l => {
        if (l.tag) {
            errorCounts[l.tag] = (errorCounts[l.tag] || 0) + 1;
        }
    });

    Object.entries(errorCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .forEach(([tag, count]) => summaryData.push([tag, count]));

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    autoFitColumns(wsSummary);
    applyStyles(wsSummary); // Apply styles
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    // Sheet 2: Accounts
    const highlightAccounts = document.getElementById('accountsList');
    if (highlightAccounts) {
        const accounts = Array.from(highlightAccounts.querySelectorAll('li')).map(li => [li.textContent]);
        if (accounts.length > 0) {
            const wsAccounts = XLSX.utils.aoa_to_sheet([['Discovered Accounts'], ...accounts]);
            autoFitColumns(wsAccounts);
            applyStyles(wsAccounts);
            XLSX.utils.book_append_sheet(wb, wsAccounts, 'Accounts');
        }
    }

    // Sheet 3: Device Events
    const deviceTable = document.getElementById('deviceEventsTable');
    if (deviceTable) {
        const wsDevice = XLSX.utils.table_to_sheet(deviceTable);
        autoFitColumns(wsDevice);
        applyStyles(wsDevice);
        XLSX.utils.book_append_sheet(wb, wsDevice, 'Device Events');
    }

    // Sheet 4: BLE Keys
    const bleKeysTable = document.getElementById('bleKeysTable');
    if (bleKeysTable) {
        const wsKeys = XLSX.utils.table_to_sheet(bleKeysTable);
        autoFitColumns(wsKeys);
        applyStyles(wsKeys);
        XLSX.utils.book_append_sheet(wb, wsKeys, 'BLE Keys');
    }

    // Sheet 5: BTSnoop Events
    const btConnectionTable = document.getElementById('btsnoopConnectionEventsTable');
    if (btConnectionTable) {
        const wsBtEvents = XLSX.utils.table_to_sheet(btConnectionTable);
        autoFitColumns(wsBtEvents);
        applyStyles(wsBtEvents);
        XLSX.utils.book_append_sheet(wb, wsBtEvents, 'Connection Events');
    }

    // Sheet 6: App Versions
    const appTable = document.getElementById('appVersionsTable');
    if (appTable) {
        const wsApps = XLSX.utils.table_to_sheet(appTable);
        autoFitColumns(wsApps);
        applyStyles(wsApps);
        XLSX.utils.book_append_sheet(wb, wsApps, 'App Versions');
    }

    // Write file with styling option enabled (implied by xlsx-js-style but good to check docs, usually standard writeFile works)
    XLSX.writeFile(wb, filename);
}

/**
 * Exports table to Excel
 * @param {string} tableId - ID of the table to export
 * @param {string} filename - Output filename
 */
export function exportTableToExcel(tableId, filename = 'export.xlsx') {
    if (typeof XLSX === 'undefined') {
        throw new Error('SheetJS (XLSX) library not loaded!');
    }

    const table = document.getElementById(tableId);
    if (!table) {
        throw new Error(`Table not found: ${tableId}`);
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.table_to_sheet(table);
    autoFitColumns(ws);
    applyStyles(ws);
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, filename);
}

/**
 * Exports log lines to text file
 * @param {Array} logLines - Log lines to export
 * @param {string} filename - Output filename
 * @param {string} zipFileName - Optional zip file name prefix
 */
export function exportLogsToText(logLines, filename, zipFileName = null) {
    if (!logLines || logLines.length === 0) {
        throw new Error('No logs to export.');
    }

    // Prepend the zip file name if it exists
    const finalFilename = zipFileName
        ? `${zipFileName.replace('.zip', '')}_${filename}`
        : filename;

    const content = logLines.map(line => line.originalText || line.text).join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = finalFilename;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the URL object
    setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Exports data to JSON file
 * @param {Object|Array} data - Data to export
 * @param {string} filename - Output filename
 */
export function exportToJson(data, filename = 'export.json') {
    const content = JSON.stringify(data, null, 2);
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Exports data to CSV file
 * @param {Array} data - Array of objects to export
 * @param {string} filename - Output filename
 */
export function exportToCsv(data, filename = 'export.csv') {
    if (!data || data.length === 0) {
        throw new Error('No data to export.');
    }

    // Get headers from first object
    const headers = Object.keys(data[0]);

    // Create CSV content
    const csvContent = [
        headers.join(','),
        ...data.map(row =>
            headers.map(header => {
                const value = row[header] || '';
                // Escape quotes and wrap in quotes if contains comma
                const escaped = String(value).replace(/"/g, '""');
                return escaped.includes(',') ? `"${escaped}"` : escaped;
            }).join(',')
        )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => URL.revokeObjectURL(url), 100);
}
