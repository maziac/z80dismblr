import * as assert from 'assert';
import { Opcodes, OpcodeFlag } from '../opcodes';
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
		assert(Opcodes[0xCD].flags == (OpcodeFlag.CALL|OpcodeFlag.BRANCH_ADDRESS));

		// CALL cc
		assert(Opcodes[0xC4].flags == (OpcodeFlag.CALL|OpcodeFlag.BRANCH_ADDRESS));

		// JP
		assert(Opcodes[0xC3].flags == (OpcodeFlag.STOP|OpcodeFlag.BRANCH_ADDRESS));

		// JP cc
		assert(Opcodes[0xD2].flags == OpcodeFlag.BRANCH_ADDRESS);

		// JR
		assert(Opcodes[0x18].flags == (OpcodeFlag.STOP|OpcodeFlag.BRANCH_ADDRESS));

		// JR cc
		assert(Opcodes[0x20].flags == OpcodeFlag.BRANCH_ADDRESS);

		// DJNZ
		assert(Opcodes[0x10].flags == OpcodeFlag.BRANCH_ADDRESS);

		// RET
		assert(Opcodes[0xC9].flags == OpcodeFlag.STOP);

		// RET cc
		assert(Opcodes[0xE0].flags == OpcodeFlag.NONE);

		// RETI
		//assert(Opcodes[xx].flags == OpcodeFlags.STOP); TODO: Enable

		// LD HL,nn
		assert(Opcodes[0x21].flags == OpcodeFlag.NONE);

		// LD (nn),A
		assert(Opcodes[0x32].flags == OpcodeFlag.NONE);

		// LD (nn),HL
		assert(Opcodes[0x22].flags == OpcodeFlag.NONE);

		// LD C,n
		assert(Opcodes[0x0E].flags == OpcodeFlag.NONE);

		// LD A,B
		assert(Opcodes[0x78].flags == OpcodeFlag.NONE);

		// IN
		assert(Opcodes[0xDB].flags == OpcodeFlag.NONE);

		// OUT
		assert(Opcodes[0xD3].flags == OpcodeFlag.NONE);
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
		assert(Opcodes[0x18].valueType == LabelType.CODE_RELATIVE_LBL);

		// JR cc
		assert(Opcodes[0x20].valueType == LabelType.CODE_RELATIVE_LBL);

		// DJNZ
		assert(Opcodes[0x10].valueType == LabelType.CODE_RELATIVE_LOOP);

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

	test('length', () => {
		// CALL nn
		assert(Opcodes[0xCD].length == 3);

		// LD HL,nn
		assert(Opcodes[0x21].length == 3);

		// LD e,n
		assert(Opcodes[0x1E].length == 2);

		// JP nn
		assert(Opcodes[0xC3].length == 3);

		// JR n
		assert(Opcodes[0x18].length == 2);

		// RET
		assert(Opcodes[0xC9].length == 1);
	});

});
