import * as assert from 'assert';
import { Opcodes, OpcodesCB, OpcodesDD, OpcodesED, OpcodesFD, OpcodesFDCB, OpcodeFlag } from '../opcodes';
import { LabelType } from '../label';



suite('Opcodes', () => {

	setup( () => {
		//Settings.Init(<any>undefined, '');
	});

	/*
		teardown( () => dc.stop() );
	*/

	test('Check all opcode numbers', () => {
		const length = Opcodes.length;
//		const arr = Opcodes;

		// Check opcode for each element
		for(let i=0; i<length; i++) {
//			console.log('n ' + i + ', ' + i.toString(16));
			const opcode = Opcodes[i];
			assert(opcode != undefined);
			if(!Array.isArray(opcode))
				assert(i == opcode.code);
		}
	});


	test('Check all DD opcode numbers', () => {
		const length = OpcodesDD.length;
//		const arr = OpcodesDD;

		// Check opcode for each element
		for(let i=0; i<length; i++) {
			const opcode = OpcodesDD[i];
			assert(opcode != undefined);
			if(!Array.isArray(opcode)) {
//				console.log('DD ' + i + ', ' + i.toString(16) + ', ' + opcode.name);
				assert(i == opcode.code);
			}
//			else
//				console.log('DD ' + i + ', ' + i.toString(16) + ' -> Array');
		}
	});


	test('Check all ED opcode numbers', () => {
		const length = OpcodesED.length;
//		const arr = OpcodesDD;

		// Check opcode for each element
		for(let i=0; i<length; i++) {
			const opcode = OpcodesED[i];
			assert(opcode != undefined);
			if(!Array.isArray(opcode)) {
//				console.log('ED ' + i + ', ' + i.toString(16) + ', ' + opcode.name);
				assert(i == opcode.code);
			}
//			else
//				console.log('DD ' + i + ', ' + i.toString(16) + ' -> Array');
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

	test('length of opcode arrays', () => {
		// Length of arrays
		assert(Opcodes.length == 0x100);
		assert(OpcodesCB.length == 0x100);
		assert(OpcodesDD.length == 0x100);
		assert(OpcodesED.length == 0x100);
		assert(OpcodesFDCB.length == 0x100);
	});

	test('length of opcodes', () => {
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


	test('Special combined opcodes', () => {
		assert(Array.isArray(Opcodes[0xCB]));
		assert(Array.isArray(Opcodes[0xDD]));
		assert(Array.isArray(Opcodes[0xED]));
		assert(Array.isArray(Opcodes[0xFD]));

		assert(Array.isArray(OpcodesFD[0xCB]));
	});

});
