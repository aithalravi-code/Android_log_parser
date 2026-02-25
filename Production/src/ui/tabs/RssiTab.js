// RssiTab.js - RSSI Tracking and Visualization Module
import { formatParam } from '../../utils/html.js';
import Chart from 'chart.js/auto';
import zoomPlugin from 'chartjs-plugin-zoom';

Chart.register(zoomPlugin);

let rssiDeviceData = [];
let rssiChart = null;
let selectedDevices = new Set();

export function setup(deps) {
    const { rssiDataPoints } = deps;

    if (!rssiDataPoints || rssiDataPoints.length === 0) {
        showNoDataMessage();
        return;
    }

    // Group RSSI data by device address
    const deviceMap = new Map();
    for (const point of rssiDataPoints) {
        if (!deviceMap.has(point.address)) {
            deviceMap.set(point.address, []);
        }
        deviceMap.get(point.address).push(point);
    }

    // Calculate statistics per device
    rssiDeviceData = Array.from(deviceMap.entries()).map(([address, points]) => {
        const rssiValues = points.map(p => p.rssi);
        const sortedPoints = points.sort((a, b) => a.timestampMs - b.timestampMs);

        return {
            address,
            points: sortedPoints,
            minRssi: Math.min(...rssiValues),
            maxRssi: Math.max(...rssiValues),
            avgRssi: (rssiValues.reduce((sum, v) => sum + v, 0) / rssiValues.length).toFixed(1),
            count: points.length,
            addrType: points[0].addrType
        };
    });

    // Sort by address
    rssiDeviceData.sort((a, b) => a.address.localeCompare(b.address));

    // Select all devices by default
    rssiDeviceData.forEach(d => selectedDevices.add(d.address));

    renderDeviceTable();
    renderChart();
    attachEventListeners();
}

function showNoDataMessage() {
    const content = document.getElementById('rssiTab');
    if (content) {
        content.innerHTML = '<div class="no-data-message"><p>No RSSI data available. BTSnoop file may not contain LE Advertising Reports.</p></div>';
    }
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

        return `
            <tr data-address="${device.address}">
                <td style="text-align: center;">
                    <input type="checkbox" class="device-checkbox" data-address="${device.address}" ${checked}>
                    <span class="color-indicator" style="background-color: ${color};"></span>
                </td>
                <td class="addr-cell" title="${device.address}">${device.address}</td>
                <td>${addrTypeMap[device.addrType] || device.addrType}</td>
                <td style="text-align: center;">${device.minRssi} ~ ${device.maxRssi}</td>
                <td style="text-align: center;">${device.avgRssi}</td>
                <td style="text-align: center;">${device.count.toLocaleString()}</td>
            </tr>
        `;
    }).join('');
}

function renderChart() {
    const canvas = document.getElementById('rssiChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Destroy previous chart
    if (rssiChart) {
        rssiChart.destroy();
    }

    // Filter selected devices
    const selectedData = rssiDeviceData.filter(d => selectedDevices.has(d.address));

    if (selectedData.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '14px Arial';
        ctx.fillStyle = '#999';
        ctx.textAlign = 'center';
        ctx.fillText('No devices selected', canvas.width / 2, canvas.height / 2);
        return;
    }

    const datasets = selectedData.map((device, idx) => ({
        label: device.address,
        data: device.points.map(p => ({ x: p.timestampMs, y: p.rssi })),
        borderColor: getDeviceColor(rssiDeviceData.indexOf(device)),
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 1,
        pointHoverRadius: 4,
        tension: 0.1
    }));

    rssiChart = new Chart(ctx, {
        type: 'line',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'linear',
                    position: 'bottom',
                    title: { display: true, text: 'Time (ms)' },
                    ticks: {
                        callback: function (value) {
                            const date = new Date(value);
                            return date.toLocaleTimeString();
                        }
                    }
                },
                y: {
                    title: { display: true, text: 'RSSI (dBm)' },
                    min: -100,
                    max: 0
                }
            },
            plugins: {
                legend: { display: true, position: 'top' },
                tooltip: {
                    callbacks: {
                        title: function (context) {
                            const date = new Date(context[0].parsed.x);
                            return date.toLocaleString();
                        },
                        label: function (context) {
                            return `${context.dataset.label}: ${context.parsed.y} dBm`;
                        }
                    }
                },
                zoom: {
                    zoom: {
                        wheel: { enabled: true },
                        pinch: { enabled: true },
                        mode: 'x'
                    },
                    pan: {
                        enabled: true,
                        mode: 'x'
                    }
                }
            }
        }
    });
}

function attachEventListeners() {
    // Device checkbox toggles
    document.querySelectorAll('.device-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const address = e.target.dataset.address;
            if (e.target.checked) {
                selectedDevices.add(address);
            } else {
                selectedDevices.delete(address);
            }
            renderChart();
        });
    });

    // Select/Deselect all buttons
    const selectAllBtn = document.getElementById('rssiSelectAll');
    const deselectAllBtn = document.getElementById('rssiDeselectAll');

    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
            selectedDevices.clear();
            rssiDeviceData.forEach(d => selectedDevices.add(d.address));
            document.querySelectorAll('.device-checkbox').forEach(cb => cb.checked = true);
            renderChart();
        });
    }

    if (deselectAllBtn) {
        deselectAllBtn.addEventListener('click', () => {
            selectedDevices.clear();
            document.querySelectorAll('.device-checkbox').forEach(cb => cb.checked = false);
            renderChart();
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
}

function getDeviceColor(index) {
    const colors = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
        '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384'
    ];
    return colors[index % colors.length];
}

export function reset() {
    rssiDeviceData = [];
    selectedDevices.clear();
    if (rssiChart) {
        rssiChart.destroy();
        rssiChart = null;
    }
    console.log('[RssiTab] State reset');
}
