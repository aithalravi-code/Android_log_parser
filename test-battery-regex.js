const line = '09-22 11:02:13.939  1000  2139  4647 D BatteryService: [processValuesLocked]batteryLevel:95 ,LastbatteryLevel:95 ,mPlugType:0 ,batteryStatus:3';

// Old regex (too broad)
const oldRgx = /(?:level:\s*|battery_level:\s*\[|batteryLevel:\s*)(\d+)/g;
console.log('OLD REGEX (too broad):');
let m;
while ((m = oldRgx.exec(line)) !== null) {
    console.log('  Matched:', m[0], '-> Level:', m[1]);
}

// New regex (with negative lookbehind)
const newRgx = /(?<![a-zA-Z])(?:level:\s*|battery_level:\s*\[|batteryLevel:\s*)(\d+)/;
console.log('\nNEW REGEX (precise):');
const nm = line.match(newRgx);
if (nm) {
    console.log('  Matched:', nm[0], '-> Level:', nm[1]);
} else {
    console.log('  NO MATCH');
}
