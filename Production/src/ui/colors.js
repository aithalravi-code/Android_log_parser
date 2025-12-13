// PID Color Hashing logic extracted from main.js

const pidColorCache = new Map();
const pidColors = ['#4CAF50', '#2196F3', '#9C27B0', '#FF9800', '#F44336', '#009688', '#673AB7', '#E91E63', '#03A9F4', '#8BC34A'];

/**
 * Deterministically gets a color for a given PID.
 * @param {string|number} pid - The Process ID.
 * @returns {string} The hex color code.
 */
export function getColorForPid(pid) {
    if (!pid) return '#E0E0E0'; // Default color for lines without a PID
    if (pidColorCache.has(pid)) {
        return pidColorCache.get(pid);
    }
    // Simple hash function to pick a color
    const colorIndex = parseInt(pid, 10) % pidColors.length;
    const color = pidColors[colorIndex];
    pidColorCache.set(pid, color);
    return color;
}
