import assert = require('assert');
import { Opcodes, OpcodeFlags } from '../opcodes';
import { LabelType } from '../label';



suite('Opcodes', () => {

	setup( () => {
		//Settings.Init(<any>undefined, '');
	});

/*
	teardown( () => dc.stop() );
*/

	test('Check all opcode numbers', () => {
		// Check size of array
		assert(0x100 == Opcodes.length);

		// Check opcode for each element
		for(let i=0; i<0x100; i++) {
			const opcode = Opcodes[i];
			assert(opcode != undefined);
			assert(i == opcode.code);
		}
	});

	test('Opcode flags', () => {
		// CALL
		assert(Opcodes[0xCD].flags == (OpcodeFlags.CALL|OpcodeFlags.BRANCH_ADDRESS));

		// CALL cc
		assert(Opcodes[0xC4].flags == (OpcodeFlags.CALL|OpcodeFlags.BRANCH_ADDRESS));

		// JP
		assert(Opcodes[0xC3].flags == (OpcodeFlags.STOP|OpcodeFlags.BRANCH_ADDRESS));

		// JP cc
		assert(Opcodes[0xD2].flags == OpcodeFlags.BRANCH_ADDRESS);

		// JR
		assert(Opcodes[0x18].flags == (OpcodeFlags.STOP|OpcodeFlags.BRANCH_ADDRESS));

		// JR cc
		assert(Opcodes[0x20].flags == OpcodeFlags.BRANCH_ADDRESS);

		// DJNZ
		assert(Opcodes[0x10].flags == OpcodeFlags.BRANCH_ADDRESS);

		// RET
		assert(Opcodes[0xC9].flags == OpcodeFlags.STOP);

		// RET cc
		assert(Opcodes[0xE0].flags == OpcodeFlags.NONE);

		// RETI
		//assert(Opcodes[xx].flags == OpcodeFlags.STOP); TODO: Enable

		// LD HL,nn
		assert(Opcodes[0x21].flags == OpcodeFlags.NONE);

		// LD (nn),A
		assert(Opcodes[0x32].flags == OpcodeFlags.NONE);

		// LD (nn),HL
		assert(Opcodes[0x22].flags == OpcodeFlags.NONE);

		// LD C,n
		assert(Opcodes[0x0E].flags == OpcodeFlags.NONE);

		// LD A,B
		assert(Opcodes[0x78].flags == OpcodeFlags.NONE);

		// IN
		assert(Opcodes[0xDB].flags == OpcodeFlags.NONE);

		// OUT
		assert(Opcodes[0xD3].flags == OpcodeFlags.NONE);
	});

	test('LabelTypes', () => {
		// CALL
		assert(Opcodes[0xCD].valueType == LabelType.CODE_SUB);

		// CALL cc
		assert(Opcodes[0xC4].valueType == LabelType.CODE_SUB);

		// JP
		assert(Opcodes[0xC3].valueType == LabelType.CODE_LBL);

		// JP cc
		assert(Opcodes[0xD2].valueType == LabelType.CODE_LBL);

		// JR
		assert(Opcodes[0x18].valueType == LabelType.CODE_LOCAL_LBL);

		// JR cc
		assert(Opcodes[0x20].valueType == LabelType.CODE_LOCAL_LBL);

		// DJNZ
		assert(Opcodes[0x10].valueType == LabelType.CODE_LOOP);

		// RET
		assert(Opcodes[0xC9].valueType == LabelType.NONE);

		// LD HL,nn
		assert(Opcodes[0x21].valueType == LabelType.NUMBER_WORD);

		// LD (nn),A
		assert(Opcodes[0x32].valueType == LabelType.DATA_LBL);

		// LD (nn),HL
		assert(Opcodes[0x22].valueType == LabelType.DATA_LBL);

		// LD C,n
		assert(Opcodes[0x0E].valueType == LabelType.NUMBER_BYTE);

		// LD A,B
		assert(Opcodes[0x78].valueType == LabelType.NONE);

		// IN
		assert(Opcodes[0xDB].valueType == LabelType.PORT_LBL);

		// OUT
		assert(Opcodes[0xD3].valueType == LabelType.PORT_LBL);
	});


});
