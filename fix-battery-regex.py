#!/usr/bin/env python3
import re

# Read the file
with open('Production/src/main.js', 'r') as f:
    lines = f.readlines()

# Fix line 1557 (index 1556)
if len(lines) > 1556:
    old_line = lines[1556]
    # Replace: 4 backslashes -> 2 backslashes, \\n -> \n
    fixed_line = old_line.replace('\\\\\\\\s*', '\\\\s*')
    fixed_line = fixed_line.replace('\\\\\\\\d+', '\\\\d+')
    fixed_line = fixed_line.replace('\\\\\\\\[', '\\\\[')
    fixed_line = fixed_line.replace('/;\\\\n', '/;\\n')
    
    lines[1556] = fixed_line
    print(f"Fixed line 1557:")
    print(f"  OLD: {old_line.strip()}")
    print(f"  NEW: {fixed_line.strip()}")
    
    # Write back
    with open('Production/src/main.js', 'w') as f:
        f.writelines(lines)
    print("✓ File updated")
else:
    print(f"Error: File has only {len(lines)} lines")
