import { escapeHtml } from '../../utils/html.js';
import { makeSortable } from '../../table-sort.js';
import { makeTableResizable } from '../../table-resize.js';

let deviceEventsData = [];

/**
 * Renders the Device Events table based on the provided events.
 * @param {Array} events - List of device events to render.
 * @param {HTMLElement} tableElement - The table element (or tbody) to render into.
 */
export function renderDeviceEvents(events, tableElement) {
    if (!tableElement) {
        return;
    }

    tableElement.innerHTML = '';
    deviceEventsData = events || [];

    if (!deviceEventsData || deviceEventsData.length === 0) {
        tableElement.innerHTML = '<tr><td colspan="6">No specific device or setting events found.</td></tr>';
        return;
    }

    // Sort events by timestamp to process them in chronological order
    deviceEventsData.sort((a, b) => {
        if (!a.timestamp || !b.timestamp) {
            return 0;
        }
        return a.timestamp.localeCompare(b.timestamp);
    });

    const lastState = new Map(); // Tracks the last value for each event type
    let tableHtml = '';

    deviceEventsData.forEach(event => {
        const lastValue = lastState.get(event.event);
        // Add to table if it's the first time we see this event, or if its value has changed.
        if (lastValue === undefined || lastValue.value !== event.detail) {
            const previousValue = lastValue ? lastValue.value : 'N/A';

            // Generate unique row ID
            const rowId = `dev-evt-${event.timestamp ? event.timestamp.replace(/[^a-zA-Z0-9]/g, '') : 'na'}-${event.event.replace(/[^a-zA-Z0-9]/g, '')}`;

            const rowData = [event.date || 'N/A', event.time || 'N/A', event.event, event.detail, previousValue, event.originalText].join('  ');
            tableHtml += `<tr data-row-id="${rowId}" style="position: relative;">
                    <td class="copy-cell" data-log-text="${event.date || ''}">${event.date || 'N/A'}</td>
                    <td class="copy-cell" data-log-text="${event.time || ''}">${event.time || 'N/A'}</td>
                    <td class="copy-cell" data-log-text="${escapeHtml(event.event)}">${escapeHtml(event.event)}</td>
                    <td class="copy-cell" data-log-text="${escapeHtml(event.detail)}">${escapeHtml(event.detail)}</td>
                    <td class="copy-cell" data-log-text="${escapeHtml(previousValue)}">${escapeHtml(previousValue)}</td>
                    <td class="copy-cell log-line-cell" data-log-text="${escapeHtml(event.originalText)}">${escapeHtml(event.originalText)}</td>
                    <td style="width: 40px; text-align: center;"><button class="copy-log-btn" data-log-text="${rowData.replace(/"/g, '&quot;')}">📋</button></td>
                </tr>`;
            lastState.set(event.event, { value: event.detail });
        }
    });
    tableElement.innerHTML = tableHtml;
}

/**
 * Sets up the Device Events tab (filters, sorting, resizing).
 * @param {string} tableId - The ID of the table element.
 */
export function setupDeviceEventsTab(tableId = 'deviceEventsTable') {
    makeSortable(tableId, 0, 'desc'); // Sort by Timestamp

    if (document.getElementById(tableId)) {
        makeTableResizable(tableId);
    }
}
