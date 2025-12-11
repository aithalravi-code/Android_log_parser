/**
 * Parse Android logcat timestamp to JavaScript Date object
 * 
 * @param {string} logcatTimestamp - Timestamp in "MM-DD HH:mm:ss.SSS" format
 * @returns {Date|null} - Parsed date or null if invalid
 * 
 * @example
 * logcatToDate('07-02 09:33:33.365') // Returns Date object for July 2nd, 9:33:33.365
 */
export function logcatToDate(logcatTimestamp) {
    // logcatTimestamp is in "MM-DD HH:mm:ss.SSS" format, e.g., "07-02 09:33:33.365"
    if (!logcatTimestamp || logcatTimestamp.length < 18) {
        return null; // Invalid format
    }
    const year = new Date().getFullYear();
    // To avoid ambiguity in date parsing across browsers, we explicitly set the components.
    // new Date(year, monthIndex, day, hours, minutes, seconds, milliseconds)
    // month is 0-indexed, so we subtract 1.
    const month = parseInt(logcatTimestamp.substring(0, 2), 10) - 1;
    const day = parseInt(logcatTimestamp.substring(3, 5), 10);
    const hours = parseInt(logcatTimestamp.substring(6, 8), 10);
    const minutes = parseInt(logcatTimestamp.substring(9, 11), 10);
    const seconds = parseInt(logcatTimestamp.substring(12, 14), 10);
    const milliseconds = parseInt(logcatTimestamp.substring(15, 18), 10);
    const date = new Date(year, month, day, hours, minutes, seconds, milliseconds);
    return isNaN(date) ? null : date;
}
