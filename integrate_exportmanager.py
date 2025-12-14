#!/usr/bin/env python3
"""
ExportManager Integration Script
Integrates ExportManager module into main.js
"""

import re

def integrate_export_manager():
    """Main integration function"""
    
    print("🔧 Starting ExportManager Integration...")
    
    # Read main.js
    with open('Production/src/main.js', 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_length = len(content)
    
    # Step 1: Replace exportStatsToExcel function
    print("📝 Replacing exportStatsToExcel()...")
    
    # Find the function
    func_start = content.find('    function exportStatsToExcel() {')
    if func_start == -1:
        print("❌ Could not find exportStatsToExcel function")
        return False
    
    # Find the end (next function or major section)
    func_end = content.find('    // Helper for summary stats', func_start)
    if func_end == -1:
        print("❌ Could not find end of exportStatsToExcel function")
        return False
    
    # New implementation
    new_export_stats = '''    // Export Stats Tab to Multi-sheet Excel (using ExportManager)
    function exportStatsToExcel() {
        try {
            ExportManager.exportStatsToExcel({
                logLines: originalLogLines,
                minLogDate: minLogDate,
                maxLogDate: maxLogDate,
                filename: 'android_log_stats.xlsx'
            });
        } catch (error) {
            alert('Export failed: ' + error.message);
            console.error('Export error:', error);
        }
    }

'''
    
    content = content[:func_start] + new_export_stats + content[func_end:]
    
    print("✅ Replaced exportStatsToExcel()")
    
    # Step 2: Replace calculateLogLevels function
    print("📝 Replacing calculateLogLevels()...")
    
    calc_start = content.find('    function calculateLogLevels(lines) {')
    if calc_start != -1:
        calc_end = content.find('    }', calc_start) + 6  # Include closing brace and newline
        
        new_calc = '''    // Use ExportManager's calculateLogLevels
    function calculateLogLevels(lines) {
        return ExportManager.calculateLogLevels(lines);
    }

'''
        content = content[:calc_start] + new_calc + content[calc_end:]
        print("✅ Replaced calculateLogLevels()")
    
    # Step 3: Replace handleExport function
    print("📝 Replacing handleExport()...")
    
    handle_start = content.find('    function handleExport(logLines, filename) {')
    if handle_start != -1:
        # Find the end of handleExport
        handle_end = content.find('    }', handle_start)
        # Find the actual end by counting braces
        brace_count = 0
        pos = handle_start
        while pos < len(content):
            if content[pos] == '{':
                brace_count += 1
            elif content[pos] == '}':
                brace_count -= 1
                if brace_count == 0:
                    handle_end = pos + 1
                    break
            pos += 1
        
        # Skip to next line
        while handle_end < len(content) and content[handle_end] in '\n ':
            handle_end += 1
        
        new_handle = '''    // Export logs to text file (using ExportManager)
    function handleExport(logLines, filename) {
        try {
            ExportManager.exportLogsToText(logLines, filename, currentZipFileName);
        } catch (error) {
            alert('Export failed: ' + error.message);
            console.error('Export error:', error);
        }
    }

'''
        content = content[:handle_start] + new_handle + content[handle_end:]
        print("✅ Replaced handleExport()")
    
    # Write back
    with open('Production/src/main.js', 'w', encoding='utf-8') as f:
        f.write(content)
    
    new_length = len(content)
    reduction = original_length - new_length
    
    print("✅ Integration complete!")
    print(f"📊 Reduced code by ~{reduction} characters")
    
    return True

if __name__ == '__main__':
    import sys
    success = integrate_export_manager()
    sys.exit(0 if success else 1)
