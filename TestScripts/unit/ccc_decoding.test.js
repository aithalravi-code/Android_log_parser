
import { describe, it, expect } from 'vitest';
import { decodePayload } from '../../Production/src/ui/tabs/CccTab.js';

describe('CCC Tab Logic - Hotfix Verification', () => {
    it('should decode Selected_UWB_Channel correctly', () => {
        // Type 0x02 (UWB), Subtype 0x04 (Ranging_Session_RS)
        // Format: Length(4) + RAN Mult(2) + SlotMask(2) + SyncMask(8) + Channel(2) + Hopping(2)
        // Payload: 0010 (Length 16) ...

        // Channel 0x01 -> Channel 5
        // Channel: 01
        const payloadChannel5 = "0010" + "00" + "00" + "00000000" + "01" + "00";
        const result5 = decodePayload(0x02, 0x04, payloadChannel5);
        expect(result5.params).toContain('Selected_UWB_Channel');
        expect(result5.params).toContain('0x01 (Channel 5)');

        // Channel 0x02 -> Channel 9
        // Channel: 02
        const payloadChannel9 = "0010" + "00" + "00" + "00000000" + "02" + "00";
        const result9 = decodePayload(0x02, 0x04, payloadChannel9);
        expect(result9.params).toContain('0x02 (Channel 9)');

        // Channel 0x03 -> Channel 5, Channel 9
        const payloadChannel59 = "0010" + "00" + "00" + "00000000" + "03" + "00";
        const result59 = decodePayload(0x02, 0x04, payloadChannel59);
        expect(result59.params).toContain('0x03 (Channel 5, Channel 9)');
    });

    it('should decode Hopping Config Bitmask correctly', () => {
        // Hopping: 0x20 -> Adaptive (b5)
        const payloadAdapMode = "0010" + "00" + "00" + "00000000" + "01" + "20";
        const resultAdapMode = decodePayload(0x02, 0x04, payloadAdapMode);
        expect(resultAdapMode.params).toContain('Hopping_Config_Bitmask');
        expect(resultAdapMode.params).toContain('0x20 (Adaptive)');

        // Hopping: 0x40 -> Continuous (b6)
        const payloadContMode = "0010" + "00" + "00" + "00000000" + "01" + "40";
        const resultContMode = decodePayload(0x02, 0x04, payloadContMode);
        expect(resultContMode.params).toContain('0x40 (Continuous)');

        // Hopping: 0x80 -> No Hopping (b7)
        const payloadNoHop = "0010" + "00" + "00" + "00000000" + "01" + "80";
        const resultNoHop = decodePayload(0x02, 0x04, payloadNoHop);
        expect(resultNoHop.params).toContain('0x80 (No Hopping)');

        // Hopping: 0x60 -> Adaptive (b5) + Continuous (b6)
        const payloadBothMode = "0010" + "00" + "00" + "00000000" + "01" + "60";
        const resultBothMode = decodePayload(0x02, 0x04, payloadBothMode);
        expect(resultBothMode.params).toContain('0x60 (Continuous, Adaptive)');

        // Hopping: 0xF8 -> b7, b6, b5, b4, b3
        const payloadF8 = "0010" + "00" + "00" + "00000000" + "01" + "F8";
        const resultF8 = decodePayload(0x02, 0x04, payloadF8);
        expect(resultF8.params).toContain('0xF8 (No Hopping, Continuous, Adaptive, Default Sequence, AES Hopping)');
    });

    it('should decode Packed Channel & Hopping in RQ (0x05)', () => {
        // Type 0x02 (UWB), Subtype 0x05 (Ranging_Session_Setup_RQ)
        // Format: Length(4) + Msg(14) ...
        // Msg: RANMult(2) + ChapsPerSlot(2) + Responders(2) + SlotsPerRound(2) + SYNC(8) + ConfigByte(2)
        // Offset 0-16 for first part. 
        // 16-18 is ConfigByte.

        // Example: 0x21
        // Binary: 0010 0001
        // Channel Mask (0-4): 00001 = 1 -> Ch 5
        // Hopping (5-7): 001 = 1 (b5 set) -> Adaptive = 0x20

        const payloadAdapCh5 = "0012" + "00" + "00" + "00" + "00" + "00000000" + "21"; // 0x21
        const resultAdapCh5 = decodePayload(0x02, 0x05, payloadAdapCh5);

        expect(resultAdapCh5.params).toContain('Channel_Bitmask');
        expect(resultAdapCh5.params).toContain('0x1 (Channel 5)');
        expect(resultAdapCh5.params).toContain('Hopping_Config_Bitmask');
        expect(resultAdapCh5.params).toContain('0x20 (Adaptive)');

        // Example: 0x42
        // Binary: 0100 0010
        // Channel Mask (0-4): 00010 = 2 -> Ch 9
        // Hopping (5-7): 010 = 2 (b6 set) -> Continuous = 0x40

        const payloadContCh9 = "0012" + "00" + "00" + "00" + "00" + "00000000" + "42"; // 0x42
        const resultContCh9 = decodePayload(0x02, 0x05, payloadContCh9);
        expect(resultContCh9.params).toContain('0x2 (Channel 9)');
        expect(resultContCh9.params).toContain('0x40 (Continuous)');
    });
});
