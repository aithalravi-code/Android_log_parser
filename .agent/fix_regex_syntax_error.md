# Fix for Regex Syntax Error

## Issue
The user reported an `Uncaught SyntaxError: Invalid regular expression` in the worker script.
The error was caused by incorrect escaping of backslashes in the injected regex string.
I used `\\\\s` (double escaped) which resulted in a literal backslash `\` followed by `s` in the regex, instead of the whitespace character class `\s`. Similarly for `\[` and `\]`.

## Fix
Corrected the escaping in `main.js` to use `\\s`, `\\[`, and `\\]`.
This ensures the worker receives the correct regex: `/(?:Sending|Received):\s*\[([0-9a-fA-F]+)\]/`.

**Code Change:**
```javascript
// main.js
// Old:
'    const cccRegex = /(?:Sending|Received):\\\\s*\\\\[([0-9a-fA-F]+)\\\\]/;\n' +
// New:
'    const cccRegex = /(?:Sending|Received):\\s*\\[([0-9a-fA-F]+)\\]/;\n' +
```
