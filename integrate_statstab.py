#!/usr/bin/env python3
"""
Script to integrate StatsTab.js module into main.js by:
1. Adding the import
2. Updating function calls
3. Removing duplicate function definitions
"""

import re

# Read the file
with open('Production/src/main.js', 'r') as f:
    content = f.read()

# Step 1: Add import after BtsnoopTab import
content = content.replace(
    "import * as BtsnoopTab from './ui/tabs/BtsnoopTab.js';",
    "import * as BtsnoopTab from './ui/tabs/BtsnoopTab.js';\nimport * as StatsTab from './ui/tabs/StatsTab.js';"
)

# Step 2: Update function calls (keeping original logic for verifiability)
replacements = [
    # renderStats calls
    ('renderStats(logStats);', 'StatsTab.renderStats(logStats);'),
    ('renderStats(finalStats);', 'StatsTab.renderStats(finalStats);'),
    
    # processForDashboardStats calls
    ('const dashboardStats = processForDashboardStats();',
     'const dashboardStats = StatsTab.processForDashboardStats(originalLogLines, consolidatedBatteryDataPoints);'),
    
    # renderDashboardStats calls
    ('renderDashboardStats(dashboardStats);',
     'StatsTab.renderDashboardStats(dashboardStats, { cpuLoadStats, temperatureStats, batteryStats });'),
    
    # renderCpuPlot calls
    ('renderCpuPlot(dashboardStats.cpuDataPoints);',
     'StatsTab.renderCpuPlot(dashboardStats.cpuDataPoints, cpuLoadPlotContainer);'),
    ('if (cpuLoadPlotContainer) renderCpuPlot(dashboardStats.cpuDataPoints);',
     'if (cpuLoadPlotContainer) StatsTab.renderCpuPlot(dashboardStats.cpuDataPoints, cpuLoadPlotContainer);'),
    
    # renderTemperaturePlot calls
    ('renderTemperaturePlot(dashboardStats.temperatureDataPoints);',
     "StatsTab.renderTemperaturePlot(dashboardStats.temperatureDataPoints, document.getElementById('temperaturePlotContainer'));"),
    ('if (temperatureStats) renderTemperaturePlot(dashboardStats.temperatureDataPoints);',
     "if (temperatureStats) StatsTab.renderTemperaturePlot(dashboardStats.temperatureDataPoints, document.getElementById('temperaturePlotContainer'));"),
    
    # renderBatteryPlot calls
    ('renderBatteryPlot(dashboardStats.batteryDataPoints);', 
     'StatsTab.renderBatteryPlot(consolidatedBatteryDataPoints, batteryPlotContainer);'),
    ('renderBatteryPlot(consolidatedBatteryDataPoints);',
     'StatsTab.renderBatteryPlot(consolidatedBatteryDataPoints, batteryPlotContainer);'),
    ('if (batteryStats) renderBatteryPlot(dashboardStats.batteryDataPoints);',
     'if (batteryStats) StatsTab.renderBatteryPlot(consolidatedBatteryDataPoints, batteryPlotContainer);'),
    
    # renderAppVersions calls  
    ('renderAppVersions(allAppVersions);',
     'StatsTab.renderAppVersions(allAppVersions, appVersionsTable, appSearchInput);'),
    ('() => renderAppVersions(allAppVersions)',
     '() => StatsTab.renderAppVersions(allAppVersions, appVersionsTable, appSearchInput)'),
]

for old, new in replacements:
    content = content.replace(old, new)

# Step 3: Remove duplicate function definitions using regex
# Remove each function completely from their definition to closing brace

functions_to_remove = [
    (r'    function renderStats\(stats\) \{.*?\n    \}', 'renderStats'),
    (r'    function processForDashboardStats\(\) \{.*?\n    \}', 'processForDashboardStats'),
    (r'    function renderDashboardStats\(stats\) \{.*?\n    \}', 'renderDashboardStats'),
    (r'    function renderAppVersions\(versions\) \{.*?\n    \}', 'renderAppVersions'),
    (r'    function renderCpuPlot\(dataPoints\) \{.*?\n    \}', 'renderCpuPlot'),
    (r'    function renderTemperaturePlot\(dataPoints\) \{.*?\n    \}', 'renderTemperaturePlot'),
    (r'    function renderBatteryPlot\(dataPoints\) \{.*?\n    \}', 'renderBatteryPlot'),
]

# Add a comment where stats functions were
marker_added = False
for pattern, name in functions_to_remove:
    # Use DOTALL flag to match across newlines
    match = re.search(pattern, content, re.DOTALL)
    if match:
        if not marker_added:
            content = content.replace(match.group(), '\n    // Stats rendering functions moved to StatsTab.js module\n', 1)
            marker_added = True
            print(f"Removed {name} and added marker comment")
        else:
            content = content.replace(match.group(), '', 1)
            print(f"Removed {name}")
    else:
        print(f"WARNING: Could not find {name}")

# Write the modified content
with open('Production/src/main.js', 'w') as f:
    f.write(content)

print("\\nIntegration complete!")
