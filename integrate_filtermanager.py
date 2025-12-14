#!/usr/bin/env python3
"""
FilterManager Integration Script
Integrates FilterManager module into main.js
"""

import re
import sys

def integrate_filter_manager():
    """Main integration function"""
    
    print("🔧 Starting FilterManager Integration...")
    
    # Read main.js
    with open('Production/src/main.js', 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    
    # Step 1: Add helper function to build filter config
    helper_function = '''
    // Helper function to build filter configuration for FilterManager
    function getFilterConfig() {
        const activeKeywords = filterKeywords.filter(kw => kw.active).map(kw => ({
            text: kw.text,
            active: true,
            regex: wildcardToRegex(kw.text)
        }));
        
        // Parse inputs as UTC to match worker's UTC-based timestamps
        const startTime = startTimeInput.value ? new Date(startTimeInput.value + ':00Z') : null;
        const endTime = endTimeInput.value ? new Date(endTimeInput.value + ':00Z') : null;
        
        return {
            activeLogLevels: activeLogLevels,
            keywords: activeKeywords,
            isAndLogic: isAndLogic,
            liveSearchQuery: liveSearchQuery,
            startTime: startTime,
            endTime: endTime,
            isTimeFilterActive: isTimeFilterActive
        };
    }
'''
    
    # Find where to insert the helper (before applyMainFilters)
    insert_pos = content.find('    function applyMainFilters(')
    if insert_pos == -1:
        print("❌ Could not find applyMainFilters function")
        return False
    
    content = content[:insert_pos] + helper_function + '\n' + content[insert_pos:]
    
    print("✅ Added getFilterConfig() helper function")
    
    # Step 2: Replace applyMainFilters implementation
    # Find the function start and end
    func_start = content.find('    function applyMainFilters(')
    if func_start == -1:
        print("❌ Could not find applyMainFilters function")
        return False
    
    # Find the end of the function (next function or closing brace)
    func_end = content.find('    // --- Clear & Reset Logic ---', func_start)
    if func_end == -1:
        print("❌ Could not find end of applyMainFilters function")
        return False
    
    # Extract function signature
    sig_end = content.find('{', func_start)
    signature = content[func_start:sig_end+1]
    
    # Create new implementation
    new_implementation = signature + '''
        // Use FilterManager for filtering
        const filterConfig = getFilterConfig();
        
        // Add time filter handling for compatibility
        if (filterConfig.isTimeFilterActive && (filterConfig.startTime || filterConfig.endTime)) {
            // Filter by time using dateObj
            linesToFilter = linesToFilter.filter(line => {
                if (line.isMeta) return true; // Always include meta lines
                if (!line.dateObj) return true; // Include lines without dates
                
                const startTime = filterConfig.startTime;
                const endTime = filterConfig.endTime;
                
                if (startTime && line.dateObj < startTime) return false;
                if (endTime && line.dateObj > endTime) return false;
                
                return true;
            });
        }
        
        // Use FilterManager.applyMainFilters
        return FilterManager.applyMainFilters(
            linesToFilter,
            collapseState || { isInside: false },
            activeCollapseSet,
            filterConfig
        );
    }
'''
    
    # Replace the old function
    content = content[:func_start] + new_implementation + content[func_end:]
    
    print("✅ Replaced applyMainFilters() with FilterManager version")
    
    # Write back
    with open('Production/src/main.js', 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("✅ Integration complete!")
    print(f"📊 Reduced code by ~{len(original_content) - len(content)} characters")
    
    return True

if __name__ == '__main__':
    success = integrate_filter_manager()
    sys.exit(0 if success else 1)
