#!/usr/bin/env node
// Precise removal of duplicate stats functions

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mainJsPath = path.join(__dirname, '../Production/src/main.js');

console.log('🔧 Precisely removing duplicate stats functions...\n');

let content = fs.readFileSync(mainJsPath, 'utf8');

// Function names to remove
const functionsToRemove = [
    'renderStats',
    'processForDashboardStats',
    'renderDashboardStats',
    'renderAppVersions',
    'renderCpuPlot',
    'renderTemperaturePlot',
    'renderBatteryPlot'
];

let removedCount = 0;

functionsToRemove.forEach(funcName => {
    // Regex to find the function definition and its body
    // Matches: function funcName(...) { ...body... }
    // We need a robust way to match balanced braces.
    // For now, since we know the structure, we can verify carefully.

    const funcRegex = new RegExp(`\\s*function\\s+${funcName}\\s*\\([\\s\\S]*?\\)\\s*{`, 'm');
    const match = content.match(funcRegex);

    if (match) {
        const startIndex = match.index;
        let braceCount = 1;
        let endIndex = startIndex + match[0].length;

        while (braceCount > 0 && endIndex < content.length) {
            if (content[endIndex] === '{') braceCount++;
            else if (content[endIndex] === '}') braceCount--;
            endIndex++;
        }

        if (braceCount === 0) {
            // Found the full function block
            console.log(`✓ Removing ${funcName} (approx ${endIndex - startIndex} chars)`);

            // Remove the function and surrounding whitespace
            const before = content.substring(0, startIndex);
            const after = content.substring(endIndex);
            content = before + after;
            removedCount++;
        } else {
            console.warn(`⚠ Could not find end of function ${funcName}`);
        }
    } else {
        console.warn(`⚠ Function ${funcName} not found`);
    }
});

fs.writeFileSync(mainJsPath, content, 'utf8');
console.log(`\n✅ Removed ${removedCount} functions`);
