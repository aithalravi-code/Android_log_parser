/**
 * Convert wildcard pattern to regex
 * Supports * as wildcard character
 * Without *, performs whole-word search for better precision
 * 
 * @param {string} pattern - Pattern with optional * wildcards
 * @returns {RegExp} - Compiled regex pattern
 * 
 * @example
 * wildcardToRegex('NFC') // Matches whole word "NFC"
 * wildcardToRegex('*NFC*') // Matches any string containing "NFC"
 */
export function wildcardToRegex(pattern) {
    const escapedPattern = pattern.replace(/([.+?^${}()|[\]\/\\])/g, "\\$1");
    // Revert to the faster, whole-word search by default.
    // The user can use asterisks for a "contains" search (e.g., *NFC*).
    if (!pattern.includes('*')) {
        return new RegExp(`\\b${escapedPattern}\\b`, 'i');
    }
    const regexPattern = escapedPattern.replace(/\*/g, '.*');
    return new RegExp(regexPattern, 'i');
}
