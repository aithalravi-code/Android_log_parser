import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { processForDashboardStats, renderStats, renderDashboardStats, renderCpuPlot, renderTemperaturePlot, renderBatteryPlot, renderAppVersions } from '../../Production/src/ui/tabs/StatsTab.js';

describe('Stats Tab Logic', () => {

    describe('processForDashboardStats', () => {
        it('should extract CPU stats correctly using Load format', () => {
            const lines = [
                { originalText: 'Load: 1.50', timestamp: '01-01 12:00:00.000', lineNumber: 1 },
                { originalText: 'Load: 3.00', timestamp: '01-01 12:00:10.000', lineNumber: 2 }
            ];
            const stats = processForDashboardStats(lines);

            // 1.5 * 10 = 15. 3.0 * 10 = 30.
            expect(stats.avgCpu).toBe('22.5'); // (15+30)/2
            expect(stats.maxCpu).toBe(30);
            expect(stats.minCpu).toBe(15);
            expect(stats.cpuDataPoints.length).toBe(2);
        });

        it('should extract CPU stats correctly using User/Kernel format', () => {
            const lines = [
                { originalText: '10% user + 5% kernel', timestamp: '01-01 12:00:00.000', lineNumber: 1 },
                { originalText: '20% user + 10% kernel', timestamp: '01-01 12:00:10.000', lineNumber: 2 }
            ];
            // 15, 30
            const stats = processForDashboardStats(lines);
            expect(stats.avgCpu).toBe('22.5');
            expect(stats.maxCpu).toBe(30);
        });

        it('should extraction Temperature stats', () => {
            const lines = [
                { originalText: 'temperature: 350', timestamp: '01-01 12:00:00.000', lineNumber: 1 }, // 35.0 C
                { originalText: 'tsens_tz_sensor0: 38000', timestamp: '01-01 12:00:10.000', lineNumber: 2 } // 38.0 C
            ];
            const stats = processForDashboardStats(lines);

            expect(stats.avgTemp).toBe('36.5'); // (35+38)/2
            expect(stats.minTemp).toBe('35.0');
            expect(stats.maxTemp).toBe('38.0');
            expect(stats.temperatureDataPoints.length).toBe(2);
        });

        it('should handle Battery stats from worker data', () => {
            const lines = []; // Log lines don't matter for battery here
            const batteryPoints = [
                { ts: new Date(), level: 80 },
                { ts: new Date(), level: 90 }
            ];
            const stats = processForDashboardStats(lines, batteryPoints);

            expect(stats.avgBattery).toBe('85.0'); // (80+90)/2
            expect(stats.maxBattery).toBe(90);
            expect(stats.minBattery).toBe(80);
        });

        it('should merge worker thermal data (SIOP)', () => {
            const lines = [];
            const battery = [];
            const workerThermal = [
                { dateObj: '2023-01-01T10:00:00Z', AP: 330 }, // 33.0C
                { dateObj: '2023-01-01T10:01:00Z', SKIN: 310 } // 31.0C
            ];
            const stats = processForDashboardStats(lines, battery, workerThermal);

            expect(stats.temperatureDataPoints.length).toBe(2);
            expect(stats.temperatureDataPoints[0].temp).toBe(33);
            expect(stats.temperatureDataPoints[1].temp).toBe(31);
        });
    });

    describe('renderStats', () => {
        let container, logCounts, errorDist;
        beforeEach(() => {
            document.body.innerHTML = `
                <div id="logCounts"></div>
                <div id="errorDistribution"></div>
            `;
            logCounts = document.getElementById('logCounts');
            errorDist = document.getElementById('errorDistribution');
        });

        it('should render log level counts', () => {
            const stats = { total: 100, E: 5, W: 10, I: 50, D: 30, V: 5 };
            renderStats(stats);
            expect(logCounts.textContent).toContain('Total Lines: 100');
            expect(logCounts.innerHTML).toContain('Errors:');
        });

        it('should render error distribution chart', () => {
            const stats = { total: 100, E: 10, W: 0, I: 0, D: 0, V: 0 };
            renderStats(stats);
            const bars = errorDist.querySelectorAll('div[title]');
            // 5 bars expected
            expect(bars.length).toBe(5);
        });

        it('should handle empty stats', () => {
            renderStats({ total: 0, E: 0, W: 0, I: 0, D: 0, V: 0 });
            expect(logCounts.textContent).toContain('Total Lines: 0');
            expect(errorDist.textContent).toContain('No log data available');
        });
    });

    describe('renderAppVersions', () => {
        let table, input;
        beforeEach(() => {
            table = document.createElement('tbody');
            input = document.createElement('input');
            input.value = '';
        });

        it('should render list of versions', () => {
            const versions = [['com.pkg1', '1.0'], ['com.pkg2', '2.0']];
            renderAppVersions(versions, table, input);
            expect(table.querySelectorAll('tr').length).toBe(2);
            expect(table.textContent).toContain('com.pkg1');
            expect(table.textContent).toContain('1.0');
        });

        it('should filter versions based on search', () => {
            const versions = [['com.pkg1', '1.0'], ['com.pkg2', '2.0']];
            input.value = 'pkg1';
            renderAppVersions(versions, table, input);
            expect(table.querySelectorAll('tr').length).toBe(1);
            expect(table.textContent).toContain('com.pkg1');
        });
    });

    describe('Sparkline Plots', () => {
        let container;
        beforeEach(() => {
            container = document.createElement('div');
            // Mock clientWidth for calculations
            Object.defineProperty(container, 'clientWidth', { value: 200 });
        });

        it('renderCpuPlot should generate SVG', () => {
            const data = [
                { ts: new Date(1000), load: 10 },
                { ts: new Date(2000), load: 50 }
            ];
            renderCpuPlot(data, container);
            expect(container.innerHTML).toContain('<svg');
            expect(container.querySelector('polyline')).not.toBeNull();
        });

        it('renderTemperaturePlot should generate SVG', () => {
            const data = [
                { ts: new Date(1000), temp: 30 },
                { ts: new Date(2000), temp: 40 }
            ];
            renderTemperaturePlot(data, container);
            expect(container.innerHTML).toContain('<svg');
        });

        it('renderBatteryPlot should generate SVG', () => {
            const data = [
                { ts: new Date(1000), level: 80 },
                { ts: new Date(2000), level: 79 }
            ];
            renderBatteryPlot(data, container);
            expect(container.innerHTML).toContain('<svg');
        });

        it('should show message if not enough data', () => {
            renderCpuPlot([], container);
            expect(container.textContent).toContain('Not enough data');
        });
    });

    describe('setupStatsTab', () => {
        let elements;
        beforeEach(() => {
            document.body.innerHTML = `
                <div id="logCounts"></div>
                <div id="errorDistribution"></div>
                <div id="cpuLoadPlotContainer"></div>
                <div id="temperaturePlotContainer"></div>
                <div id="batteryPlotContainer"></div>
            `;
            elements = {
                cpuLoadPlotContainer: document.getElementById('cpuLoadPlotContainer'),
                temperatureStats: document.createElement('div'), // Mocking non-ID elements passed in
                batteryStats: document.createElement('div'),
                batteryPlotContainer: document.getElementById('batteryPlotContainer')
            };
        });

        it('should process lines and update stats', async () => {
            // Import dynamically if needed, but we imported at top level
            const { setupStatsTab } = await import('../../Production/src/ui/tabs/StatsTab.js');

            const lines = [
                { isMeta: false, level: 'E', originalText: 'Error line' },
                { isMeta: false, level: 'I', originalText: 'Info line' },
                { isMeta: true, level: '', originalText: 'Meta line' }
            ];

            await setupStatsTab(lines, elements, []);

            const logCounts = document.getElementById('logCounts');
            // Total lines excluding meta = 2
            expect(logCounts.textContent).toContain('Total Lines: 2');
            expect(logCounts.textContent).toContain('Errors: 1');
            expect(logCounts.textContent).toContain('Info: 1');
        });
    });
});

