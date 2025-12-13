/**
 * Escapes unsafe characters in a string to prevent XSS.
 * @param {string} unsafe - The raw string.
 * @returns {string} The escaped string.
 */
export function escapeHtml(unsafe = '') {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export const formatParam = (key, value) => `<span class="ccc-pair"><span class="ccc-param">${key}:</span> <span class="ccc-value">${value}</span></span>`;
