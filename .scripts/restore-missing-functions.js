#!/usr/bin/env node
// Script to restore accidentally removed functions

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mainJsPath = path.join(__dirname, '../Production/src/main.js');

console.log('🔧 Restoring accidentally removed functions...\n');

// Get the functions from git
const renderCccStats = execSync('git show HEAD:Production/src/main.js | sed -n "/^    function renderCccStats/,/^    function /p" | head -n -1', {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8'
});

const renderBatteryPlot = execSync('git show HEAD:Production/src/main.js | sed -n "/^    function renderBatteryPlot/,/^    $/p"', {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8'
});

console.log(`✓ Extracted renderCccStats: ${renderCccStats.split('\n').length} lines`);
console.log(`✓ Extracted renderBatteryPlot: ${renderBatteryPlot.split('\n').length} lines\n`);

// Read current main.js
const content = fs.readFileSync(mainJsPath, 'utf8');
const lines = content.split('\n');

// Find where to insert (after setupTableFilters, before Connectivity)
let insertIndex = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('// --- Connectivity Tab Logic ---')) {
        insertIndex = i;
        break;
    }
}

if (insertIndex === -1) {
    console.error('❌ Could not find insertion point!');
    process.exit(1);
}

console.log(`✓ Found insertion point at line ${insertIndex + 1}\n`);

// Insert the functions
const newLines = [
    ...lines.slice(0, insertIndex),
    '',
    ...renderCccStats.split('\n'),
    '',
    ...renderBatteryPlot.split('\n'),
    '',
    ...lines.slice(insertIndex)
];

// Write back
fs.writeFileSync(mainJsPath, newLines.join('\n'), 'utf8');

console.log(`✅ Successfully restored functions`);
console.log(`✅ File now has ${newLines.length} lines (was ${lines.length})`);
console.log(`✅ Added ${newLines.length - lines.length} lines\n`);
