
// Test Case 1: Process Status Line (Missing PID/TID)
const processLine = " 1433  4338 gps          18  -2  0.0 S  10G 6.5M  fg binder:1433_2   android.hardware.gnss-service.pixel";
// Regex for "PID TID USER ..." format
const processStatusRegex = /^\s*(?<psPid>\d+)\s+(?<psTid>\d+)\s+(?<psUser>[\w._]+)\s+(?:(?<psPr>[\d-]+)\s+)?(?:(?<psNi>[\d-]+)\s+)?.*?(?<psTag>[^\s]+)$/;

console.log("--- Test Case 1: Process Status ---");
const match1 = processStatusRegex.exec(processLine);
if (match1) {
    console.log("MATCH FOUND!");
    console.log("Groups:", match1.groups);
} else {
    console.log("NO MATCH for Process Status");
}

// Test Case 2: GPS Line (Date/Time not parsed)
const gpsLine = "  09-23 12:21:08.722 100 e4000020 +gps +state=10181:\"gnss\"";
// Proposed Regex for this custom format
// Date Time PID? Hex? Tag Message
// Note: It lacks the standard Level char (V/D/I/W/E) and the colon separator for the tag is dubious or part of the message.
// Let's assume:
// Date: 09-23
// Time: 12:21:08.722
// PID: 100
// Tag: +gps
// Message: +state=10181:"gnss" ... (or includes the hex?)
const gpsRegex = /^\s*(?<gpsDate>\d{2}-\d{2})\s+(?<gpsTime>\d{2}:\d{2}:\d{2}\.\d{3})\s+(?<gpsPid>\d+)\s+(?<gpsExtra>[a-fA-F0-9]+)\s+(?<gpsTag>\+?[^\s]+)\s+(?<gpsMessage>.*)$/;

console.log("\n--- Test Case 2: GPS Line ---");
const match2 = gpsRegex.exec(gpsLine);
if (match2) {
    console.log("MATCH FOUND!");
    console.log("Groups:", match2.groups);
} else {
    console.log("NO MATCH for GPS Line");
}
