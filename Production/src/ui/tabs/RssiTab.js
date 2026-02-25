// RssiTab.js - RSSI Tracking and Visualization Module
import { formatParam } from '../../utils/html.js';
import Chart from 'chart.js/auto';
import zoomPlugin from 'chartjs-plugin-zoom';

Chart.register(zoomPlugin);

let rssiDeviceData = [];
let rssiChart = null;
let selectedDevices = new Set();
let lastRssiDataPoints = null;
let lastIrksLength = 0;

/**
 * Resolve a Resolvable Private Address (RPA) using an IRK.
 * BT Core Spec Vol 3, Part H, Sec 2.2.2: ah(k, r) = AES-128(k, r')[0:3]
 * where r' = 0x000000000000000000000000 || r (13 zero bytes + prand in LE order).
 * IRK from SMP wire format is little-endian → reverse before AES.
 */
async function resolveRPA(addressStr, irkHex) {
    try {
        const b = addressStr.split(':').map(x => parseInt(x, 16));
        // Must be RPA: top 2 bits of MSB = 01 (0b01xxxxxx)
        if ((b[0] & 0xC0) !== 0x40) return false;

        // prand (display MSB first): b[0], b[1], b[2]
        // hash (display MSB first): b[3], b[4], b[5]
        const storedHash = b.slice(3, 6);

        // Plaintext: [0×13, prand_LSB, prand_MID, prand_MSB] (BlueZ smp_ah order)
        const pt = new Uint8Array(16);
        pt[13] = b[2]; pt[14] = b[1]; pt[15] = b[0];

        // IRK from SMP is LE on wire → reverse to get AES key in BE
        const irkBytes = new Uint8Array(irkHex.match(/../g).map(x => parseInt(x, 16)).reverse());
        const iv = new Uint8Array(16); // zero IV → CBC block 1 = ECB
        const key = await crypto.subtle.importKey('raw', irkBytes, { name: 'AES-CBC' }, false, ['encrypt']);
        const enc = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, key, pt));
        return enc[0] === storedHash[0] && enc[1] === storedHash[1] && enc[2] === storedHash[2];
    } catch { return false; }
}

/**
 * Try to resolve all RPAs in rssiDeviceData against supplied IRKs,
 * then merge resolved entries under their static identity address.
 */
async function resolveAndMergeAddresses(irks) {
    if (!irks || irks.length === 0) return;
    const uniqueIrks = [...new Map(irks.map(i => [i.irk, i])).values()];
    const toIdentity = new Map();

    for (const device of rssiDeviceData) {
        if ((device.addrType & 1) !== 1) continue; // skip non-random
        const msb = parseInt(device.address.split(':')[0], 16);
        if ((msb & 0xC0) !== 0x40) continue; // skip non-RPA
        for (const { irk, identityAddress } of uniqueIrks) {
            if (await resolveRPA(device.address, irk)) {
                toIdentity.set(device.address, identityAddress);
                break;
            }
        }
    }

    if (toIdentity.size === 0) return;

    const mergedMap = new Map();
    const resolved = new Set(toIdentity.keys());

    for (const device of rssiDeviceData) {
        const identity = toIdentity.get(device.address);
        if (!identity) continue;
        if (!mergedMap.has(identity)) {
            mergedMap.set(identity, { address: identity, points: [], addrType: 0, resolved: true, rpaAddresses: [] });
        }
        const m = mergedMap.get(identity);
        m.points.push(...device.points);
        m.rpaAddresses.push(device.address);
    }

    rssiDeviceData = rssiDeviceData.filter(d => !resolved.has(d.address));
    for (const m of mergedMap.values()) {
        m.points.sort((a, b) => a.timestampMs - b.timestampMs);
        const rssiValues = m.points.map(p => p.rssi);
        m.minRssi = Math.min(...rssiValues);
        m.maxRssi = Math.max(...rssiValues);
        m.avgRssi = (rssiValues.reduce((s, v) => s + v, 0) / rssiValues.length).toFixed(1);
        m.count = m.points.length;
        rssiDeviceData.unshift(m);
    }
}

export async function setup(deps) {
    const { rssiDataPoints, irks = [] } = deps;

    if (!rssiDataPoints || rssiDataPoints.length === 0) {
        showNoDataMessage();
        return;
    }

    // Preserve tab state if data hasn't changed (user just switched tabs)
    if (lastRssiDataPoints === rssiDataPoints && lastIrksLength === irks.length) {
        return;
    }

    lastRssiDataPoints = rssiDataPoints;
    lastIrksLength = irks.length;

    // Group RSSI data by device address
    const deviceMap = new Map();
    for (const point of rssiDataPoints) {
        if (!deviceMap.has(point.address)) { deviceMap.set(point.address, []); }
        deviceMap.get(point.address).push(point);
    }

    rssiDeviceData = Array.from(deviceMap.entries()).map(([address, points]) => {
        const rssiValues = points.map(p => p.rssi);
        const sortedPoints = points.sort((a, b) => a.timestampMs - b.timestampMs);
        return {
            address, points: sortedPoints,
            minRssi: Math.min(...rssiValues), maxRssi: Math.max(...rssiValues),
            avgRssi: (rssiValues.reduce((s, v) => s + v, 0) / rssiValues.length).toFixed(1),
            count: points.length, addrType: points[0].addrType
        };
    });

    rssiDeviceData.sort((a, b) => b.count - a.count);

    // Resolve RPAs using IRKs (async, may take a moment for many addresses)
    await resolveAndMergeAddresses(irks);

    selectedDevices.clear();
    renderDeviceTable();
    showPlotPrompt();
    attachEventListeners();
}

function showNoDataMessage() {
    const content = document.getElementById('rssiTab');
    if (content) {
        content.innerHTML = `
            <div class="no-data-message">
                <p>📶 No RSSI data available.</p>
                <p style="font-size: 0.9em; opacity: 0.7;">To see RSSI charts, load a ZIP or BTSnoop log file (<code>btsnoop_hci.log</code>) that contains BLE Advertising packets (LE Advertising Reports).</p>
            </div>`;
    }
}

function showPlotPrompt() {
    const canvas = document.getElementById('rssiChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (rssiChart) {
        rssiChart.destroy();
        rssiChart = null;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '14px Arial';
    ctx.fillStyle = '#999';
    ctx.textAlign = 'center';
    ctx.fillText('Select devices and click "Plot Selected" to render', canvas.width / 2, canvas.height / 2);
}

function renderDeviceTable() {
    const tbody = document.querySelector('#rssiDeviceTable tbody');
    if (!tbody) return;

    const addrTypeMap = {
        0: 'Public',
        1: 'Random',
        2: 'Public (ID)',
        3: 'Random (ID)'
    };

    tbody.innerHTML = rssiDeviceData.map((device, idx) => {
        const checked = selectedDevices.has(device.address) ? 'checked' : '';
        const color = getDeviceColor(idx);
        const addrLabel = device.resolved
            ? `${device.address} <span title="Resolved from: ${device.rpaAddresses?.join(', ')}" style="color:#81c995; font-size:10px;">[IRK ✓]</span>`
            : device.address;
        const typeLabel = device.resolved ? 'Identity' : (addrTypeMap[device.addrType] || device.addrType);
        const rowClass = device.resolved ? 'class="resolved-row"' : '';

        return `
            <tr data-address="${device.address}" ${rowClass}>
                <td style="text-align: center;">
                    <input type="checkbox" class="device-checkbox" data-address="${device.address}" ${checked}>
                    <span class="color-indicator" style="background-color: ${color};"></span>
                </td>
                <td class="addr-cell">${addrLabel}</td>
                <td>${typeLabel}</td>
                <td style="text-align: center;">${device.minRssi} ~ ${device.maxRssi}</td>
                <td style="text-align: center;">${device.avgRssi}</td>
                <td style="text-align: center;">${device.count.toLocaleString()}</td>
            </tr>
        `;
    }).join('');
}

function formatDateTimeTick(value) {
    const date = new Date(value);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    const secs = String(date.getSeconds()).padStart(2, '0');
    const ms = String(date.getMilliseconds()).padStart(3, '0');
    return `${month}/${day} ${hours}:${mins}:${secs}.${ms}`;
}

function renderChart() {
    const canvas = document.getElementById('rssiChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Destroy previous chart
    if (rssiChart) {
        rssiChart.destroy();
        rssiChart = null;
    }

    // Only plot selected devices
    const selectedData = rssiDeviceData.filter(d => selectedDevices.has(d.address));

    if (selectedData.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '14px Arial';
        ctx.fillStyle = '#999';
        ctx.textAlign = 'center';
        ctx.fillText('No devices selected', canvas.width / 2, canvas.height / 2);
        return;
    }

    /**
     * Build a Chart.js data array for a device, inserting null points wherever
     * advertisements are missing (gap > 3× median interval) so the line breaks
     * instead of interpolating across silence.
     */
    function buildDataWithGaps(points) {
        if (points.length < 2) {
            return points.map(p => ({ x: p.timestampMs, y: p.rssi }));
        }

        // Compute inter-advertisement intervals
        const intervals = [];
        for (let i = 1; i < points.length; i++) {
            intervals.push(points[i].timestampMs - points[i - 1].timestampMs);
        }

        // Median interval — more robust than mean for noisy data
        const sorted = [...intervals].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        const gapThreshold = Math.max(median * 3, 500); // at least 500ms

        const result = [];
        result.push({ x: points[0].timestampMs, y: points[0].rssi });

        for (let i = 1; i < points.length; i++) {
            const gap = points[i].timestampMs - points[i - 1].timestampMs;
            if (gap > gapThreshold) {
                // Break the line — insert a null in the middle of the gap
                result.push({ x: (points[i - 1].timestampMs + points[i].timestampMs) / 2, y: null });
            }
            result.push({ x: points[i].timestampMs, y: points[i].rssi });
        }

        return result;
    }

    const datasets = selectedData.map((device) => ({
        label: device.address,
        data: buildDataWithGaps(device.points),
        borderColor: getDeviceColor(rssiDeviceData.indexOf(device)),
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        pointRadius: 1,
        pointHoverRadius: 5,
        tension: 0,       // No Bezier interpolation — straight lines only
        spanGaps: false   // Don't draw across null gaps
    }));

    rssiChart = new Chart(ctx, {
        type: 'line',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false, // Disable animation for large datasets
            scales: {
                x: {
                    type: 'linear',
                    position: 'bottom',
                    title: { display: true, text: 'Date / Time' },
                    ticks: {
                        maxTicksLimit: 8,
                        callback: function (value) {
                            return formatDateTimeTick(value);
                        }
                    }
                },
                y: {
                    title: { display: true, text: 'RSSI (dBm)' },
                    // No fixed min/max — auto-fit and zoom control the range
                },
            },
            plugins: {
                legend: { display: true, position: 'top' },
                tooltip: {
                    callbacks: {
                        title: function (context) {
                            const date = new Date(context[0].parsed.x);
                            return formatDateTimeTick(date.getTime());
                        },
                        label: function (context) {
                            return `${context.dataset.label}: ${context.parsed.y} dBm`;
                        }
                    }
                },
                zoom: {
                    limits: {
                        x: { min: 'original', max: 'original' },
                        y: { min: -120, max: 10 }
                    },
                    zoom: {
                        // Drag on chart to box-select a zoom region (X axis)
                        drag: {
                            enabled: true,
                            backgroundColor: 'rgba(54, 162, 235, 0.15)',
                            borderColor: 'rgba(54, 162, 235, 0.8)',
                            borderWidth: 1,
                            modifierKey: null
                        },
                        // Ctrl + wheel → zoom X axis
                        wheel: { enabled: true, modifierKey: 'ctrl' },
                        pinch: { enabled: true },
                        mode: 'x'
                    },
                    pan: {
                        enabled: true,
                        // Regular wheel → pan Y axis; Shift+drag → pan X axis
                        mode: 'xy',
                        modifierKey: 'shift'
                    }
                }
            }
        }
    });
}

function attachEventListeners() {
    // Device checkbox toggles (just update selectedDevices, don't auto-render)
    document.querySelectorAll('.device-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const address = e.target.dataset.address;
            if (e.target.checked) {
                selectedDevices.add(address);
            } else {
                selectedDevices.delete(address);
            }
        });
    });

    // Select/Deselect all buttons
    const selectAllBtn = document.getElementById('rssiSelectAll');
    const deselectAllBtn = document.getElementById('rssiDeselectAll');

    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
            rssiDeviceData.forEach(d => selectedDevices.add(d.address));
            document.querySelectorAll('.device-checkbox').forEach(cb => cb.checked = true);
        });
    }

    if (deselectAllBtn) {
        deselectAllBtn.addEventListener('click', () => {
            selectedDevices.clear();
            document.querySelectorAll('.device-checkbox').forEach(cb => cb.checked = false);
        });
    }

    // Plot button — renders the chart with current selection
    const plotBtn = document.getElementById('rssiPlot');
    if (plotBtn) {
        plotBtn.addEventListener('click', () => {
            renderChart();
        });
    }

    // Reset zoom button
    const resetZoomBtn = document.getElementById('rssiResetZoom');
    if (resetZoomBtn) {
        resetZoomBtn.addEventListener('click', () => {
            if (rssiChart) rssiChart.resetZoom();
        });
    }

    // Auto Fit Y button — rescale Y axis to visible data range
    const autoFitYBtn = document.getElementById('rssiAutoFitY');
    if (autoFitYBtn) {
        autoFitYBtn.addEventListener('click', () => {
            if (!rssiChart) return;
            const selectedData = rssiDeviceData.filter(d => selectedDevices.has(d.address));
            if (selectedData.length === 0) return;

            // Get the current visible X range from the chart
            const xScale = rssiChart.scales.x;
            const xMin = xScale.min;
            const xMax = xScale.max;

            // Collect all Y values within the visible X range
            let allRssi = [];
            for (const device of selectedData) {
                for (const p of device.points) {
                    if (p.timestampMs >= xMin && p.timestampMs <= xMax && p.rssi !== null) {
                        allRssi.push(p.rssi);
                    }
                }
            }

            if (allRssi.length === 0) return;

            const minY = Math.min(...allRssi);
            const maxY = Math.max(...allRssi);
            const padding = Math.max(5, (maxY - minY) * 0.15);

            rssiChart.options.scales.y.min = Math.floor(minY - padding);
            rssiChart.options.scales.y.max = Math.ceil(maxY + padding);
            rssiChart.update();
        });
    }

    // Auto Fit X button — rescale X axis to fit the loaded points of selected devices
    const autoFitXBtn = document.getElementById('rssiAutoFitX');
    if (autoFitXBtn) {
        autoFitXBtn.addEventListener('click', () => {
            if (!rssiChart) return;
            const selectedData = rssiDeviceData.filter(d => selectedDevices.has(d.address));
            if (selectedData.length === 0) return;

            let minX = Infinity;
            let maxX = -Infinity;

            for (const device of selectedData) {
                for (const p of device.points) {
                    if (p.timestampMs < minX) minX = p.timestampMs;
                    if (p.timestampMs > maxX) maxX = p.timestampMs;
                }
            }

            if (minX !== Infinity && maxX !== -Infinity) {
                const padding = Math.max(1000, (maxX - minX) * 0.05); // 5% padding or at least 1s
                rssiChart.options.scales.x.min = Math.floor(minX - padding);
                rssiChart.options.scales.x.max = Math.ceil(maxX + padding);
                rssiChart.update();
            }
        });
    }

    // Search filter
    const searchInput = document.getElementById('rssiSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            document.querySelectorAll('#rssiDeviceTable tbody tr').forEach(row => {
                const address = row.dataset.address.toLowerCase();
                row.style.display = address.includes(query) ? '' : 'none';
            });
        });
    }

    // Export CSV button
    const exportBtn = document.getElementById('rssiExport');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const selectedData = rssiDeviceData.filter(d => selectedDevices.has(d.address));
            if (selectedData.length === 0) {
                alert('Please select at least one device to export.');
                return;
            }

            const rows = [['Timestamp', 'Timestamp (ms)', 'Device Address', 'RSSI (dBm)', 'Event Type', 'Raw Event Code']];
            const allPoints = [];

            // Flatten all selected points
            for (const device of selectedData) {
                for (const p of device.points) {
                    allPoints.push({ ...p, deviceAddress: device.address });
                }
            }

            // Sort chronologically
            allPoints.sort((a, b) => a.timestampMs - b.timestampMs);

            // Map event codes to readable names
            const eventMap = {
                0x02: 'LE Adv Report (Legacy)',
                0x0d: 'LE Ext Adv Report',
                0x1405: 'Read RSSI Complete'
            };

            for (const p of allPoints) {
                const eventName = eventMap[p.eventType] || 'Unknown';
                const eventCodeHex = p.eventType !== undefined ? `0x${p.eventType.toString(16).padStart(2, '0')}` : 'N/A';
                rows.push([
                    p.timestamp,
                    p.timestampMs.toFixed(3),
                    p.deviceAddress,
                    p.rssi,
                    eventName,
                    eventCodeHex
                ]);
            }

            const csvContent = rows.map(r => r.join(',')).join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `rssi_export_${Date.now()}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }
}

function getDeviceColor(index) {
    const colors = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
        '#FF9F40', '#FF8C42', '#C9CBCF', '#4BC0C0', '#EA526F',
        '#25CED1', '#FCEADE', '#FF8A5B', '#FBFFE4', '#6B4226'
    ];
    return colors[index % colors.length];
}

export function reset() {
    rssiDeviceData = [];
    selectedDevices.clear();
    lastRssiDataPoints = null;
    lastIrksLength = 0;
    if (rssiChart) {
        rssiChart.destroy();
        rssiChart = null;
    }
    console.log('[RssiTab] State reset');
}
