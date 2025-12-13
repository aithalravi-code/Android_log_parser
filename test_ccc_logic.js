
// Mock exports from other modules
const CCC_CONSTANTS = {
    MESSAGE_TYPES: {},
    UWB_RANGING_MSGS: {},
    DK_EVENT_CATEGORIES: {},
    SE_MSGS: {},
    SUPPLEMENTARY_MSGS: {},
    FRAMEWORK_MSGS: {}
};
const COMMON_TAGS = { '30': 'Sequence', 'A0': 'Status_Object', '83': 'Status' };
const formatParam = (k, v) => `${k}: ${v}`;

// Copying necessary parts from CccTab.js for testing
const parseTLV = (hex, tagMap = COMMON_TAGS) => {
    let result = "";
    let i = 0;
    let maxIter = 100;
    while (i < hex.length && maxIter-- > 0) {
        let nextByte = hex.substring(i, i + 2).toUpperCase();
        if (nextByte === '00' || nextByte === 'FF') { i += 2; continue; }
        if (!/^[0-9A-F]{2}$/.test(nextByte)) break;
        let tag = nextByte;
        i += 2;
        if ((parseInt(tag, 16) & 0x1F) === 0x1F) { tag += hex.substring(i, i + 2).toUpperCase(); i += 2; }
        if (i + 2 > hex.length) break;
        let lenHex = hex.substring(i, i + 2);
        let len = parseInt(lenHex, 16);
        i += 2;
        if (len > 127) {
            if (len === 0x81) { len = parseInt(hex.substring(i, i + 2), 16); i += 2; }
            else if (len === 0x82) { len = parseInt(hex.substring(i, i + 4), 16); i += 4; }
        }
        if (i + (len * 2) > hex.length) break;
        let val = hex.substring(i, i + (len * 2));
        i += (len * 2);
        if (tag.startsWith('7F') || tag === '30' || tag === 'A0') {
            // Mock recursion
            result += `Nested(${parseTLV(val, tagMap)})`;
        }
    }
    return result;
};

const decodePayload = (type, subtype, payload) => {
    // simplified logic
    if (!payload) return { innerMsg: "-", params: "" };
    // Simulate recursive call
    if (type === 0x01 && subtype === 0x0B) {
        // potential recursion
    }
    return { innerMsg: "Decoded", params: parseTLV(payload) };
};

// Simulation of processChunk logic
function simulateRender() {
    console.log("Starting simulation...");
    const total = 1000;
    const allData = Array(total).fill(0).map((_, idx) => ({
        type: 0x01, subtype: 0x0B, payload: "3004A0028300", timestamp: "00:00:00." + idx
    }));

    let i = 0;
    const startTimeGlobal = Date.now();

    function processChunk() {
        const startTime = Date.now();
        while (i < total && (Date.now() - startTime < 12)) {
            const msg = allData[i];
            i++;
            try {
                if (!msg._decoded) msg._decoded = decodePayload(msg.type, msg.subtype, msg.payload);
            } catch (e) { console.error(e); }
        }

        if (i < total) {
            setImmediate(processChunk);
        } else {
            console.log("Finished simulation in " + (Date.now() - startTimeGlobal) + "ms");
        }
    }
    processChunk();
}

simulateRender();
