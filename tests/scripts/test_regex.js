
const logcatRegex = new RegExp(
    '^\\s*(?:' + // Allow optional leading whitespace
    '(?<logcatDate>\\d{2}-\\d{2})\\s(?<logcatTime>\\d{2}:\\d{2}:\\d{2}\\.\\d{3,})' + // MM-DD HH:mm:ss.SSS
    '\\s+' + // PID/TID/UID Separator
    '(?:(?:\\s*(?<pid>[\\w-]+)\\s+(?<tid>\\d+)\\s+(?:(?<uid>[\\w-]+)\\s+)?)(?<level>[A-Z])\\s+(?<tag>[^\\s:]+?)(?::\\s|\\s+)|(?<level2>[A-Z])\\/(?<tag2>[^\\(\\s]+)(?:\\(\\s*(?<pid2>\\d+)\\))?:\\s)' + // Handle alphanumeric PID/UID
    '(?<message>(?!.*Date: \\d{4}).+)' + // Standard logcat message
    '|' +
    'Date:\\s(?<customFullDate>\\d{4}-\\d{2}-\\d{2})\\s(?<customTime>\\d{2}:\\d{2}:\\d{2})' + // Date: YYYY-MM-DD HH:mm:ss
    '(?<customMessage>\\|.*)' + // The rest of the custom log line
    '|' +
    '\\[(?<weaverDate>\\d{2}-\\d{2})\\s(?<weaverTime>\\d{2}:\\d{2}:\\d{2}\\.\\d+)\\]' + // Weaver
    '\\[(?<weaverPid>\\d+)\\]\\[(?<weaverTag>[^\\]]+)\\]\\s*(?<weaverMessage>.*)' +
    '|' +
    '(?<simpleDate>\\d{2}-\\d{2})\\s(?<simpleTime>\\d{2}:\\d{2}:\\d{2}[:.]\\d{3,})\\s+' +
    '(?<simpleTag>[^:]+?)\\s*:\\s+(?<simpleMessage>.+)' +
    ')',
    'm'
);

const lines = [
    '09-24 09:37:31.974 D BroadcastDispatcherLog: Broadcast 6196 (android.intent.action.TIME_TICK) dispatched',
    '06-07 17:00:22:555 A11YSettingsProvider : _id:169 name:com.samsung.android.email.provider pkg:android value:0 default:0',
    '06-11 19:50:42.234  1000  6203  6339 I SDHMS:BatteryStatsDBProvider: BarTender DB Provider Insert End'
];

lines.forEach(line => {
    const match = logcatRegex.exec(line);
    if (match) {
        console.log('MATCH:', line);
        if (match.groups.logcatDate) console.log('  Type: Standard');
        if (match.groups.simpleDate) console.log('  Type: Simple');
    } else {
        console.log('NO MATCH:', line);
    }
});
