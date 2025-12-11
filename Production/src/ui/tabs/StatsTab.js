// Stats Tab Module - Handles all statistics processing and rendering
import { logcatToDate } from '../../utils/date.js';

/**
 * Process log lines to extract CPU, temperature, and battery statistics
 * @param {Array} originalLogLines - Array of parsed log line objects
 * @param {Array} batteryDataPoints - Array of battery data points ({ts, level}) from workers
 * @returns {Object} Statistics object with CPU, temp, and battery data
 */
export function processForDashboardStats(originalLogLines, batteryDataPoints = []) {
    const cpuRegex = /(\d+)% user \+ (\d+)% kernel|\bLoad:\s+([\d.]+)\b/i;
    const tempRegex = /(?:temp(?:erature)?|tsens_tz_sensor\d+):?\s*[:=]\s*(\d+)/i;

    const cpuDataPoints = [];
    const allCpuLoads = [];
    const temperatureDataPoints = [];
    // Battery data now comes from workers via the parameter
    // This loop is necessary to calculate CPU and Temperature, which are not done by the workers.
    for (const line of originalLogLines) {
        if (line.isMeta) continue;

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
            if (temp > 1000) temp /= 1000; // Normalize from milli-Celsius (e.g., 45000)
            else if (temp > 100) temp /= 10;  // Normalize from tenths of a degree (e.g., 350 for 35.0)
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
    if (!stats) return;
    const total = stats.total || 0;
    const errorRate = total > 0 ? ((stats.E / total) * 100).toFixed(2) : 0;

    let html = `
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
export function renderAppVersions(versions, appVersionsTable, appSearchInput) {
    if (!appVersionsTable) return;
    appVersionsTable.innerHTML = '';

    const searchTerm = appSearchInput.value.toLowerCase();
    const filteredVersions = searchTerm
        ? versions.filter(([pkg]) => pkg.toLowerCase().includes(searchTerm))
        : versions;

    if (filteredVersions.length === 0) {
        appVersionsTable.innerHTML = '<tr><td colspan="2">No application versions found in logs.</td></tr>';
        return;
    }
    let html = '';
    filteredVersions.forEach(([pkg, version]) => {
        const highlightedPkg = searchTerm
            ? pkg.replace(new RegExp(searchTerm, 'gi'), (match) => `<mark>${match}</mark>`)
            : pkg;
        html += `<tr><td>${highlightedPkg}</td><td>${version}</td></tr>`;
    });
    appVersionsTable.innerHTML = html;
}

/**
 * Render CPU load sparkline plot
 * @param {Array} dataPoints - Array of {ts, load} objects
 * @param {HTMLElement} cpuLoadPlotContainer - Container element
 */
export function renderCpuPlot(dataPoints, cpuLoadPlotContainer) {
    if (!cpuLoadPlotContainer) return;
    if (!dataPoints || dataPoints.length < 2) {
        cpuLoadPlotContainer.innerHTML = '<p style="text-align: center; color: #5f6368;">Not enough data to plot CPU load.</p>';
        return;
    }

    const width = cpuLoadPlotContainer.clientWidth;
    const height = 100;
    const padding = 5;

    const minTs = dataPoints[0].ts.getTime();
    const maxTs = dataPoints[dataPoints.length - 1].ts.getTime();
    const timeRange = maxTs - minTs;

    // Y-axis is from 0 to 100%
    const maxLoad = 100;

    const points = dataPoints.map(d => {
        const x = timeRange > 0 ? ((d.ts.getTime() - minTs) / timeRange) * (width - padding * 2) + padding : width / 2;
        const y = height - ((d.load / maxLoad) * (height - padding * 2) + padding);
        return `${x},${y}`;
    }).join(' ');

    const svg = `
        <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
            <polyline
                class="sparkline"
                points="${points}"
            />
        </svg>
    `;
    cpuLoadPlotContainer.innerHTML = svg;
}

/**
 * Render temperature sparkline plot
 * @param {Array} dataPoints - Array of {ts, temp} objects
 * @param {HTMLElement} container - Container element
 */
export function renderTemperaturePlot(dataPoints, container) {
    if (!container) return;
    if (!dataPoints || dataPoints.length < 2) {
        container.innerHTML = '<p style="text-align: center; color: #5f6368;">Not enough data to plot temperature.</p>';
        return;
    }

    const width = container.clientWidth;
    const height = 100;
    const padding = 5;

    const minTs = dataPoints[0].ts.getTime();
    const maxTs = dataPoints[dataPoints.length - 1].ts.getTime();
    const timeRange = maxTs - minTs;

    const temps = dataPoints.map(d => d.temp);
    const minTemp = Math.min(...temps);
    const maxTemp = Math.max(...temps);
    const tempRange = maxTemp - minTemp > 0 ? maxTemp - minTemp : 1;

    const points = dataPoints.map(d => {
        const x = timeRange > 0 ? ((d.ts.getTime() - minTs) / timeRange) * (width - padding * 2) + padding : width / 2;
        const y = height - (((d.temp - minTemp) / tempRange) * (height - padding * 2) + padding);
        return `${x},${y}`;
    }).join(' ');

    const svg = `
        <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
            <polyline
                class="sparkline"
                points="${points}"
            />
        </svg>
    `;
    container.innerHTML = svg;
}

/**
 * Render battery level sparkline plot
 * @param {Array} dataPoints - Array of {ts, level} objects
 * @param {HTMLElement} batteryPlotContainer - Container element
 */
export function renderBatteryPlot(dataPoints, batteryPlotContainer) {
    if (!batteryPlotContainer) return;
    if (!dataPoints || dataPoints.length < 2) {
        batteryPlotContainer.innerHTML = '<p style="text-align: center; color: #5f6368;">Not enough data to plot battery level.</p>';
        return;
    }

    const width = batteryPlotContainer.clientWidth;
    const height = 100;
    const padding = 5;

    const minTs = dataPoints[0].ts.getTime();
    const maxTs = dataPoints[dataPoints.length - 1].ts.getTime();
    const timeRange = maxTs - minTs;

    // Y-axis is from 0 to 100%
    const minLevel = 0;
    const maxLevel = 100;
    const levelRange = maxLevel - minLevel;

    const points = dataPoints.map(d => {
        const x = timeRange > 0 ? ((d.ts.getTime() - minTs) / timeRange) * (width - padding * 2) + padding : width / 2;
        const y = height - (((d.level - minLevel) / levelRange) * (height - padding * 2) + padding);
        return `${x},${y}`;
    }).join(' ');

    const svg = `
        <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
            <polyline
                class="sparkline"
                points="${points}"
                style="stroke: #34a853;"
            />
        </svg>
    `;
    batteryPlotContainer.innerHTML = svg;
}

/**
 * Setup and render the Stats tab
 * @param {Array} originalLogLines - Array of parsed log line objects
 * @param {Object} elements - DOM elements for rendering
 * @param {Array} batteryDataPoints - Battery data points from workers
 */
export async function setupStatsTab(originalLogLines, elements, batteryDataPoints = []) {
    console.log(`[Stats Tab] Processing stats...`);

    // Calculate log level statistics
    const logStats = { total: 0, E: 0, W: 0, I: 0, D: 0, V: 0 };
    for (const line of originalLogLines) {
        if (line.isMeta) continue;
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
    if (elements.cpuLoadPlotContainer) renderCpuPlot(dashboardStats.cpuDataPoints, elements.cpuLoadPlotContainer);
    if (elements.temperatureStats) renderTemperaturePlot(dashboardStats.temperatureDataPoints, document.getElementById('temperaturePlotContainer'));
    if (elements.batteryStats) renderBatteryPlot(batteryDataPoints, elements.batteryPlotContainer);

    console.log(`[Stats Tab] Rendering complete`);
}
