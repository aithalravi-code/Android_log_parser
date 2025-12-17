// Stats Tab Module - Handles all statistics processing and rendering
import { logcatToDate } from '../../utils/date.js';
import { makeTableResizable } from '../../table-resize.js';

/**
 * Process log lines to extract CPU, temperature, and battery statistics
 * @param {Array} originalLogLines - Array of parsed log line objects
 * @param {Array} batteryDataPoints - Array of battery data points ({ts, level}) from workers
 * @returns {Object} Statistics object with CPU, temp, and battery data
 */
export function processForDashboardStats(originalLogLines, batteryDataPoints = [], workerThermalData = []) {
    const cpuRegex = /(\d+)% user \+ (\d+)% kernel|\bLoad:\s+([\d.]+)\b/i;
    const tempRegex = /(?:temp(?:erature)?|tsens_tz_sensor\d+):?\s*[:=]\s*(\d+)/i;

    const cpuDataPoints = [];
    const allCpuLoads = [];
    const temperatureDataPoints = [];
    // Battery data now comes from workers via the parameter
    // This loop is necessary to calculate CPU and Temperature, which are not done by the workers.
    for (const line of originalLogLines) {
        if (line.isMeta) {
            continue;
        }

        // CPU Parsing
        const cpuMatch = line.originalText.match(cpuRegex);
        if (cpuMatch) {
            const totalLoad = cpuMatch[3]
                ? parseFloat(cpuMatch[3]) * 10 // Approximate percentage for "Load: x.xx" format
                : parseInt(cpuMatch[1]) + parseInt(cpuMatch[2]);

            allCpuLoads.push(totalLoad);
            if (line.timestamp) {
                cpuDataPoints.push({
                    ts: logcatToDate(line.timestamp),
                    load: totalLoad,
                    lineNumber: line.lineNumber
                });
            }
        }

        // Temperature Parsing
        const tempMatch = line.originalText.match(tempRegex);
        if (tempMatch) {
            let temp = parseInt(tempMatch[1]);
            if (temp > 1000) {
                temp /= 1000;
            } // Normalize from milli-Celsius (e.g., 45000)
            else if (temp > 100) {
                temp /= 10;
            } // Normalize from tenths of a degree (e.g., 350 for 35.0)
            if (temp > 0 && temp < 100) { // Sanity check
                if (line.timestamp) {
                    temperatureDataPoints.push({
                        ts: logcatToDate(line.timestamp),
                        temp: temp,
                        lineNumber: line.lineNumber
                    });
                }
            }
        }
    }


    // Merge worker thermal data (SIOP)
    // Convert SIOP points {ts, dateObj, AP, SKIN...} to {ts, temp}
    // We'll prioritize AP temperature if available, or SKIN
    if (workerThermalData && workerThermalData.length > 0) {
        workerThermalData.forEach(pt => {
            // Use AP or SKIN, normalize if needed (usually raw value e.g. 330 = 33.0C)
            let val = pt.AP || pt.SKIN;
            if (val !== undefined) {
                // SIOP usually in deci-degrees? e.g. 300 = 30.0C -> divide by 10
                // If test says "300 + i*1", and result is 30.0C..
                // Let's assume divide by 10
                val = val / 10;
                temperatureDataPoints.push({
                    ts: typeof pt.dateObj === 'string' ? new Date(pt.dateObj) : pt.dateObj, // Ensure it's a Date object
                    temp: val
                });
            }
        });
        // Sort by timestamp after merging
        temperatureDataPoints.sort((a, b) => a.ts - b.ts);
    }

    const tempsOnly = temperatureDataPoints.map(d => d.temp);
    const avgCpu = allCpuLoads.length > 0 ? (allCpuLoads.reduce((a, b) => a + b, 0) / allCpuLoads.length).toFixed(1) : 'N/A';
    const maxCpu = allCpuLoads.length > 0 ? Math.max(...allCpuLoads) : 'N/A';
    const minCpu = allCpuLoads.length > 0 ? Math.min(...allCpuLoads) : 'N/A';

    const avgTemp = tempsOnly.length > 0 ? (tempsOnly.reduce((a, b) => a + b, 0) / tempsOnly.length).toFixed(1) : 'N/A';
    const maxTemp = tempsOnly.length > 0 ? Math.max(...tempsOnly).toFixed(1) : 'N/A';
    const minTemp = tempsOnly.length > 0 ? Math.min(...tempsOnly).toFixed(1) : 'N/A';

    // Calculate battery stats from the data passed by workers
    const batteryLevels = batteryDataPoints.map(d => d.level);
    const avgBattery = batteryLevels.length > 0 ? (batteryLevels.reduce((a, b) => a + b, 0) / batteryLevels.length).toFixed(1) : 'N/A';
    const maxBattery = batteryLevels.length > 0 ? Math.max(...batteryLevels) : 'N/A';
    const minBattery = batteryLevels.length > 0 ? Math.min(...batteryLevels) : 'N/A';

    // Debug: Log first few data points with line numbers
    if (cpuDataPoints.length > 0) {
        console.log('[Stats Debug] First 3 CPU data points:', cpuDataPoints.slice(0, 3));
    }
    if (temperatureDataPoints.length > 0) {
        console.log('[Stats Debug] First 3 temperature data points:', temperatureDataPoints.slice(0, 3));
    }
    if (batteryDataPoints.length > 0) {
        console.log('[Stats Debug] First 3 battery data points:', batteryDataPoints.slice(0, 3));
    }

    return { avgCpu, maxCpu, minCpu, avgTemp, maxTemp, minTemp, avgBattery, maxBattery, minBattery, cpuDataPoints, temperatureDataPoints };
}

/**
 * Render dashboard statistics (CPU, temperature, battery)
 * @param {Object} stats - Statistics object from processForDashboardStats
 * @param {Object} elements - DOM elements for rendering
 */
export function renderDashboardStats(stats, elements) {
    const { cpuLoadStats, temperatureStats, batteryStats } = elements;

    if (cpuLoadStats) {
        cpuLoadStats.innerHTML = `<p>Average Total Load: <span class="stat-value">${stats.avgCpu}%</span></p><p>Max Total Load: <span class="stat-value">${stats.maxCpu}%</span></p>`;
    }
    if (temperatureStats) {
        temperatureStats.innerHTML = `<p>Avg: <span class="stat-value">${stats.avgTemp}°C</span></p><p>Min: <span class="stat-value">${stats.minTemp}°C</span></p><p>Max: <span class="stat-value">${stats.maxTemp}°C</span></p>`;
    }
    if (batteryStats) {
        batteryStats.innerHTML = `<p>Avg: <span class="stat-value">${stats.avgBattery}%</span></p><p>Min: <span class="stat-value">${stats.minBattery}%</span></p><p>Max: <span class="stat-value">${stats.maxBattery}%</span></p>`;
    }
}

/**
 * Render log level statistics and distribution chart
 * @param {Object} stats - Log level statistics
 */
export function renderStats(stats) {
    if (!stats) {
        return;
    }
    const total = stats.total || 0;
    const errorRate = total > 0 ? ((stats.E / total) * 100).toFixed(2) : 0;

    const html = `
        <div class="stat-item"><strong>Total Lines:</strong> ${total.toLocaleString()}</div>
        <div class="stat-item"><strong>Error Rate:</strong> ${errorRate}%</div>
        <div class="stat-item"><span class="log-level-E" style="color: #fff; background-color: #D32F2F; padding: 2px 6px; border-radius: 3px; font-weight: 500;">Errors:</span> ${stats.E.toLocaleString()}</div>
        <div class="stat-item"><span class="log-level-W" style="color: #000; background-color: #FBC02D; padding: 2px 6px; border-radius: 3px; font-weight: 500;">Warnings:</span> ${stats.W.toLocaleString()}</div>
        <div class="stat-item"><span class="log-level-I" style="color: #fff; background-color: #388E3C; padding: 2px 6px; border-radius: 3px; font-weight: 500;">Info:</span> ${stats.I.toLocaleString()}</div>
        <div class="stat-item"><span class="log-level-D" style="color: #fff; background-color: #1976D2; padding: 2px 6px; border-radius: 3px; font-weight: 500;">Debug:</span> ${stats.D.toLocaleString()}</div>
        <div class="stat-item"><span class="log-level-V" style="color: #fff; background-color: #757575; padding: 2px 6px; border-radius: 3px; font-weight: 500;">Verbose:</span> ${stats.V.toLocaleString()}</div>
    `;
    document.getElementById('logCounts').innerHTML = html;

    // Error distribution chart
    const errorDistData = [
        { label: 'Errors', value: stats.E, color: '#D32F2F' },
        { label: 'Warnings', value: stats.W, color: '#FBC02D' },
        { label: 'Info', value: stats.I, color: '#388E3C' },
        { label: 'Debug', value: stats.D, color: '#1976D2' },
        { label: 'Verbose', value: stats.V, color: '#9E9E9E' }
    ];

    // Simple bar chart for error distribution
    const maxVal = Math.max(...errorDistData.map(d => d.value));

    if (maxVal === 0) {
        document.getElementById('errorDistribution').innerHTML = '<p style="text-align: center; color: #666;">No log data available</p>';
    } else {
        const chartHeight = 120; // Total height in pixels
        const totalLogs = stats.total || 1; // Avoid division by zero
        let distHtml = `<div style="margin-top: 1rem; display: flex; height: ${chartHeight}px; min-height: ${chartHeight}px; align-items: flex-end; gap: 5px; width: 100%;">`;
        errorDistData.forEach(d => {
            const percentage = ((d.value / totalLogs) * 100).toFixed(1); // Calculate percentage of total
            const heightPx = Math.max(2, (d.value / totalLogs) * chartHeight); // Height based on percentage
            distHtml += `
                <div style="flex: 1; display: flex; flex-direction: column; align-items: center;">
                    <div style="width: 80%; background-color: ${d.color}; height: ${heightPx}px; border-radius: 2px 2px 0 0;" title="${d.label}: ${d.value.toLocaleString()} (${percentage}%)"></div>
                    <span style="font-size: 0.7rem; margin-top: 4px; color: #fff; font-weight: 500;">${percentage}%</span>
                </div>
            `;
        });
        distHtml += '</div>';
        document.getElementById('errorDistribution').innerHTML = distHtml;
    }
}

/**
 * Render application versions table
 * @param {Array} versions - Array of [package, version] tuples
 * @param {HTMLElement} appVersionsTable - Table element
 * @param {HTMLInputElement} appSearchInput - Search input element
 */
// FIX: Target tbody to preserve thead (headers)
export function renderAppVersions(versions, appVersionsTable, appSearchInput) {
    if (!appVersionsTable) {
        return;
    }

    let tbody = appVersionsTable.querySelector('tbody');
    if (!tbody) {
        tbody = document.createElement('tbody');
        appVersionsTable.appendChild(tbody);
    }

    tbody.innerHTML = '';

    const searchTerm = appSearchInput.value.toLowerCase();
    const filteredVersions = searchTerm
        ? versions.filter(([pkg]) => pkg.toLowerCase().includes(searchTerm))
        : versions;

    if (filteredVersions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2">No application versions found in logs.</td></tr>';
        return;
    }
    let html = '';
    filteredVersions.forEach(([pkg, version]) => {
        const highlightedPkg = searchTerm
            ? pkg.replace(new RegExp(searchTerm, 'gi'), (match) => `<mark>${match}</mark>`)
            : pkg;
        html += `<tr><td>${highlightedPkg}</td><td>${version}</td></tr>`;
    });
    tbody.innerHTML = html;

    // FIX: Sync column widths from header to body after re-rendering
    // This ensures resized columns stay in sync with the header
    // FIX: Explicitly set widths to match HTML headers (400px, 150px)
    // This avoids issues with reading computed styles when tab is hidden
    const bodyRows = tbody.querySelectorAll('tr');
    bodyRows.forEach(row => {
        const pkgCell = row.children[0];
        const verCell = row.children[1];

        if (pkgCell) {
            pkgCell.style.width = '400px';
            pkgCell.style.minWidth = '400px';
            pkgCell.style.maxWidth = '400px';
            // Also set flex properties for good measure if inherited
            pkgCell.style.flex = '0 0 400px';
        }

        if (verCell) {
            verCell.style.width = '150px';
            verCell.style.minWidth = '150px';
            verCell.style.maxWidth = '150px';
            verCell.style.flex = '0 0 150px';
        }
    });

    // Enable resizing
    makeTableResizable('appVersionsTable');
}

/**
 * Render CPU load sparkline plot
 * @param {Array} dataPoints - Array of {ts, load} objects
 * @param {HTMLElement} cpuLoadPlotContainer - Container element
 */
export function renderCpuPlot(dataPoints, cpuLoadPlotContainer) {
    if (!cpuLoadPlotContainer) {
        return;
    }
    if (!dataPoints || dataPoints.length < 2) {
        cpuLoadPlotContainer.innerHTML = '<p style="text-align: center; color: #5f6368;">Not enough data to plot CPU load.</p>';
        return;
    }

    const width = cpuLoadPlotContainer.clientWidth;
    const height = 120; // Increased height for labels
    const padding = { top: 10, right: 10, bottom: 20, left: 30 }; // Margins for labels

    // Ensure sorted by timestamp
    dataPoints.sort((a, b) => a.ts - b.ts);

    const minTs = dataPoints[0].ts.getTime();
    const maxTs = dataPoints[dataPoints.length - 1].ts.getTime();
    const timeRange = maxTs - minTs;

    // Y-axis is from 0 to max load found (e.g. 800% for 8 cores), min 100%
    const maxVal = Math.max(...dataPoints.map(d => d.load));
    // Round up to nearest 100 for cleaner Y-axis
    const maxLoad = Math.ceil(Math.max(100, maxVal) / 100) * 100;

    // Generate Points
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    const points = dataPoints.map(d => {
        const x = timeRange > 0 ? ((d.ts.getTime() - minTs) / timeRange) * plotWidth + padding.left : plotWidth / 2 + padding.left;
        const y = padding.top + plotHeight - ((d.load / maxLoad) * plotHeight);
        return `${x},${y}`;
    }).join(' ');

    // Generate Axis Labels
    const startTimeStr = dataPoints[0].ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const endTimeStr = dataPoints[dataPoints.length - 1].ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const svg = `
        <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" class="chart-svg">
            <!-- Grid Lines -->
            <line x1="${padding.left}" y1="${padding.top}" x2="${width - padding.right}" y2="${padding.top}" stroke="#eee" />
            <line x1="${padding.left}" y1="${padding.top + plotHeight}" x2="${width - padding.right}" y2="${padding.top + plotHeight}" stroke="#eee" />
            
            <!-- Y Axis Labels -->
            <text x="${padding.left - 5}" y="${padding.top + 5}" text-anchor="end" font-size="10" fill="#888">${maxLoad}%</text>
            <text x="${padding.left - 5}" y="${padding.top + plotHeight}" text-anchor="end" font-size="10" fill="#888">0%</text>

            <!-- X Axis Labels -->
            <text x="${padding.left}" y="${height - 5}" text-anchor="start" font-size="10" fill="#888">${startTimeStr}</text>
            <text x="${width - padding.right}" y="${height - 5}" text-anchor="end" font-size="10" fill="#888">${endTimeStr}</text>

            <!-- Data Line -->
            <polyline
                class="sparkline"
                points="${points}"
                fill="none"
                stroke="#2196F3"
                stroke-width="1.5"
            />
            
            <!-- Hover Overlay (Invisible rect for detecting hover position is tricky in simple SVG without JS interaction logic) -->
            <!-- We will rely on simple CSS hover for now or add JS interaction in setup -->
        </svg>
    `;
    cpuLoadPlotContainer.innerHTML = svg;

    // Add Interaction
    attachChartInteraction(cpuLoadPlotContainer, dataPoints, width, height, padding, minTs, timeRange, (val) => `${val.toFixed(1)}%`);
}

/**
 * Render temperature sparkline plot
 * @param {Array} dataPoints - Array of {ts, temp} objects
 * @param {HTMLElement} container - Container element
 */
export function renderTemperaturePlot(dataPoints, container) {
    if (!container) {
        return;
    }
    if (!dataPoints || dataPoints.length < 2) {
        container.innerHTML = '<p style="text-align: center; color: #5f6368;">Not enough data to plot temperature.</p>';
        return;
    }

    const width = container.clientWidth;
    const height = 120;
    const padding = { top: 10, right: 10, bottom: 20, left: 30 };

    // Ensure sorted
    dataPoints.sort((a, b) => a.ts - b.ts);

    const minTs = dataPoints[0].ts.getTime();
    const maxTs = dataPoints[dataPoints.length - 1].ts.getTime();
    const timeRange = maxTs - minTs;

    const temps = dataPoints.map(d => d.temp);
    const minTemp = Math.floor(Math.min(...temps));
    const maxTemp = Math.ceil(Math.max(...temps));
    const tempRange = maxTemp - minTemp > 0 ? maxTemp - minTemp : 1;

    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    const points = dataPoints.map(d => {
        const x = timeRange > 0 ? ((d.ts.getTime() - minTs) / timeRange) * plotWidth + padding.left : plotWidth / 2 + padding.left;
        const y = padding.top + plotHeight - (((d.temp - minTemp) / tempRange) * plotHeight);
        return `${x},${y}`;
    }).join(' ');

    const startTimeStr = dataPoints[0].ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const endTimeStr = dataPoints[dataPoints.length - 1].ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const svg = `
        <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" class="chart-svg">
             <line x1="${padding.left}" y1="${padding.top}" x2="${width - padding.right}" y2="${padding.top}" stroke="#eee" />
            <line x1="${padding.left}" y1="${padding.top + plotHeight}" x2="${width - padding.right}" y2="${padding.top + plotHeight}" stroke="#eee" />
            
            <text x="${padding.left - 5}" y="${padding.top + 5}" text-anchor="end" font-size="10" fill="#888">${maxTemp}°</text>
            <text x="${padding.left - 5}" y="${padding.top + plotHeight}" text-anchor="end" font-size="10" fill="#888">${minTemp}°</text>

            <text x="${padding.left}" y="${height - 5}" text-anchor="start" font-size="10" fill="#888">${startTimeStr}</text>
            <text x="${width - padding.right}" y="${height - 5}" text-anchor="end" font-size="10" fill="#888">${endTimeStr}</text>

            <polyline
                class="sparkline"
                points="${points}"
                fill="none"
                stroke="#FF5722"
                stroke-width="1.5"
            />
        </svg>
    `;
    container.innerHTML = svg;

    attachChartInteraction(container, dataPoints, width, height, padding, minTs, timeRange, (val) => `${val.toFixed(1)}°C`);
}

/**
 * Render battery level sparkline plot
 * @param {Array} dataPoints - Array of {ts, level} objects
 * @param {HTMLElement} batteryPlotContainer - Container element
 */
export function renderBatteryPlot(dataPoints, batteryPlotContainer) {
    if (!batteryPlotContainer) {
        return;
    }
    if (!dataPoints || dataPoints.length < 2) {
        batteryPlotContainer.innerHTML = '<p style="text-align: center; color: #5f6368;">Not enough data to plot battery level.</p>';
        return;
    }

    const width = batteryPlotContainer.clientWidth;
    const height = 120;
    const padding = { top: 10, right: 10, bottom: 20, left: 30 };

    // Ensure sorted
    dataPoints.sort((a, b) => a.ts - b.ts);

    const minTs = dataPoints[0].ts.getTime();
    const maxTs = dataPoints[dataPoints.length - 1].ts.getTime();
    const timeRange = maxTs - minTs;

    const minLevel = 0;
    const maxLevel = 100;
    const levelRange = maxLevel - minLevel;

    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    const points = dataPoints.map(d => {
        const x = timeRange > 0 ? ((d.ts.getTime() - minTs) / timeRange) * plotWidth + padding.left : plotWidth / 2 + padding.left;
        const y = padding.top + plotHeight - (((d.level - minLevel) / levelRange) * plotHeight);
        return `${x},${y}`;
    }).join(' ');

    const startTimeStr = dataPoints[0].ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const endTimeStr = dataPoints[dataPoints.length - 1].ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const svg = `
        <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" class="chart-svg">
            <line x1="${padding.left}" y1="${padding.top}" x2="${width - padding.right}" y2="${padding.top}" stroke="#eee" />
            <line x1="${padding.left}" y1="${padding.top + plotHeight}" x2="${width - padding.right}" y2="${padding.top + plotHeight}" stroke="#eee" />

            <text x="${padding.left - 5}" y="${padding.top + 5}" text-anchor="end" font-size="10" fill="#888">100%</text>
            <text x="${padding.left - 5}" y="${padding.top + plotHeight}" text-anchor="end" font-size="10" fill="#888">0%</text>
            
            <text x="${padding.left}" y="${height - 5}" text-anchor="start" font-size="10" fill="#888">${startTimeStr}</text>
            <text x="${width - padding.right}" y="${height - 5}" text-anchor="end" font-size="10" fill="#888">${endTimeStr}</text>

            <polyline
                class="sparkline"
                points="${points}"
                fill="none"
                stroke="#4CAF50"
                stroke-width="1.5"
                style="stroke: #34a853;"
            />
        </svg>
    `;
    batteryPlotContainer.innerHTML = svg;

    attachChartInteraction(batteryPlotContainer, dataPoints, width, height, padding, minTs, timeRange, (val) => `${val}%`);
}

/**
 * Setup and render the Stats tab
 * @param {Array} originalLogLines - Array of parsed log line objects
 * @param {Object} elements - DOM elements for rendering
 * @param {Array} batteryDataPoints - Battery data points from workers
 */
export async function setupStatsTab(originalLogLines, elements, batteryDataPoints = []) {
    console.log('[Stats Tab] Processing stats...');

    // Calculate log level statistics
    const logStats = { total: 0, E: 0, W: 0, I: 0, D: 0, V: 0 };
    for (const line of originalLogLines) {
        if (line.isMeta) {
            continue;
        }
        logStats.total++;
        if (line.level && logStats[line.level] !== undefined) {
            logStats[line.level]++;
        }
    }

    // Render log level statistics and distribution chart
    renderStats(logStats);

    // Calculate and render dashboard stats (CPU, temp, battery)
    const dashboardStats = processForDashboardStats(originalLogLines, batteryDataPoints);
    renderDashboardStats(dashboardStats, elements);

    // Render Charts
    if (elements.cpuLoadPlotContainer) {
        renderCpuPlot(dashboardStats.cpuDataPoints, elements.cpuLoadPlotContainer);
    }
    if (elements.temperatureStats) {
        renderTemperaturePlot(dashboardStats.temperatureDataPoints, document.getElementById('temperaturePlotContainer'));
    }
    if (elements.batteryStats) {
        renderBatteryPlot(batteryDataPoints, elements.batteryPlotContainer);
    }

    console.log('[Stats Tab] Rendering complete');
}

/**
 * Helper to attach interactive tooltip to charts
 */
function attachChartInteraction(container, dataPoints, width, height, padding, minTs, timeRange, valueFormatter) {
    let tooltip = container.querySelector('.chart-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.className = 'chart-tooltip';
        tooltip.style.display = 'none';
        tooltip.style.position = 'absolute';
        tooltip.style.background = 'rgba(0,0,0,0.8)';
        tooltip.style.color = 'white';
        tooltip.style.padding = '4px 8px';
        tooltip.style.borderRadius = '4px';
        tooltip.style.fontSize = '12px';
        tooltip.style.pointerEvents = 'none';
        container.style.position = 'relative'; // Ensure relative positioning
        container.appendChild(tooltip);
    }

    let verticalLine = container.querySelector('.chart-line');
    if (!verticalLine) {
        verticalLine = document.createElement('div');
        verticalLine.className = 'chart-line';
        verticalLine.style.display = 'none';
        verticalLine.style.position = 'absolute';
        verticalLine.style.top = `${padding.top}px`;
        verticalLine.style.bottom = `${padding.bottom}px`;
        verticalLine.style.width = '1px';
        verticalLine.style.background = 'rgba(0,0,0,0.5)';
        verticalLine.style.pointerEvents = 'none';
        container.appendChild(verticalLine);
    }

    container.addEventListener('mousemove', (e) => {
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;

        // Convert mouseX to timestamp
        const plotWidth = width - padding.left - padding.right;
        const relativeX = Math.max(0, Math.min(mouseX - padding.left, plotWidth));
        const hoverTs = minTs + (relativeX / plotWidth) * timeRange;

        // Find closest data point
        // Efficient search assuming sorted data
        let closest = dataPoints[0];
        let minDiff = Math.abs(closest.ts.getTime() - hoverTs);

        // Optimization: Binary search or linear scan near last known index?
        // For distinct datasets < 10k, simple scan or partial scan is fine.
        // Let's do a simple find for now or binary search if perf issues.
        // simple binary search:
        let low = 0, high = dataPoints.length - 1;
        while (low <= high) {
            const mid = (low + high) >>> 1;
            const midTime = dataPoints[mid].ts.getTime();
            const diff = Math.abs(midTime - hoverTs);
            if (diff < minDiff) {
                minDiff = diff;
                closest = dataPoints[mid];
            }
            if (midTime < hoverTs) {
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }

        if (closest) {
            const val = closest.temp !== undefined ? closest.temp : (closest.load !== undefined ? closest.load : closest.level);

            tooltip.style.display = 'block';
            tooltip.innerHTML = `${closest.ts.toLocaleTimeString()}<br/>${valueFormatter(val)}`;

            // Position tooltip
            let toolLeft = mouseX + 10;
            if (toolLeft + 100 > width) {
                toolLeft = mouseX - 110;
            }
            tooltip.style.left = `${toolLeft}px`;
            tooltip.style.top = '10px';

            verticalLine.style.display = 'block';
            verticalLine.style.left = `${mouseX}px`;
        }
    });

    container.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
        verticalLine.style.display = 'none';
    });
}
