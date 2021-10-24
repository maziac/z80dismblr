import * as assert from 'assert';
import { Opcodes, OpcodesCB, OpcodesDD, OpcodesED, OpcodesFD, OpcodesFDCB, OpcodeFlag, OpcodesDDCB } from '../disassembler/opcode';
import { NumberType } from '../disassembler/numbertype';



suite('Opcode', () => {

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


	test('Check all CB opcode numbers', () => {
		const length = OpcodesCB.length;
//		const arr = OpcodesCB;

		// Check opcode for each element
		for(let i=0; i<length; i++) {
			const opcode = OpcodesCB[i];
			assert(opcode != undefined);
			if(!Array.isArray(opcode)) {
//				console.log('ED ' + i + ', ' + i.toString(16) + ', ' + opcode.name);
				assert(i == opcode.code);
				assert(2 == opcode.length);
}
//			else
//				console.log('DD ' + i + ', ' + i.toString(16) + ' -> Array');
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
				assert(i == opcode.code, '' + i + ' != ' + opcode.code);
			}
//			else
//				console.log('DD ' + i + ', ' + i.toString(16) + ' -> Array');
		}
	});


	test('Check all ED opcode numbers', () => {
		const length = OpcodesED.length;
//		const arr = OpcodesED;

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


	test('Check all FD opcode numbers', () => {
		const length = OpcodesFD.length;
//		const arr = OpcodesFD;

		// Check opcode for each element
		for(let i=0; i<length; i++) {
			const opcode = OpcodesFD[i];
			assert(opcode != undefined);
			if(!Array.isArray(opcode)) {
//				console.log('ED ' + i + ', ' + i.toString(16) + ', ' + opcode.name);
				assert(i == opcode.code);
			}
//			else
//				console.log('DD ' + i + ', ' + i.toString(16) + ' -> Array');
		}
	});

	test('Check all DDCB opcode numbers', () => {
		const length = OpcodesDDCB.length;
//		const arr = OpcodesDDCB;

		// Check opcode for each element
		for(let i=0; i<length; i++) {
			const opcode = OpcodesDDCB[i];
			assert(opcode != undefined);
			if(!Array.isArray(opcode)) {
//				console.log('ED ' + i + ', ' + i.toString(16) + ', ' + opcode.name);
				assert(i == opcode.code);
			}
//			else
//				console.log('DD ' + i + ', ' + i.toString(16) + ' -> Array');
		}
	});

	test('Check all FDCB opcode numbers', () => {
		const length = OpcodesFDCB.length;
//		const arr = OpcodesFDCB;

		// Check opcode for each element
		for(let i=0; i<length; i++) {
			const opcode = OpcodesFDCB[i];
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
		assert(Opcodes[0xC4].flags == (OpcodeFlag.CALL|OpcodeFlag.BRANCH_ADDRESS|OpcodeFlag.CONDITIONAL));

		// JP
		assert(Opcodes[0xC3].flags == (OpcodeFlag.STOP|OpcodeFlag.BRANCH_ADDRESS));

		// JP cc
		assert(Opcodes[0xD2].flags == (OpcodeFlag.BRANCH_ADDRESS|OpcodeFlag.CONDITIONAL));

		// JR
		assert(Opcodes[0x18].flags == (OpcodeFlag.STOP|OpcodeFlag.BRANCH_ADDRESS));

		// JR cc
		assert(Opcodes[0x20].flags == (OpcodeFlag.BRANCH_ADDRESS|OpcodeFlag.CONDITIONAL));

		// DJNZ
		assert(Opcodes[0x10].flags == (OpcodeFlag.BRANCH_ADDRESS|OpcodeFlag.CONDITIONAL));

		// RET
		assert(Opcodes[0xC9].flags == (OpcodeFlag.RET|OpcodeFlag.STOP));

		// RET cc
		assert(Opcodes[0xE0].flags == (OpcodeFlag.RET|OpcodeFlag.CONDITIONAL));

		// RETI
		assert(OpcodesED[0x4D].flags == (OpcodeFlag.RET|OpcodeFlag.STOP));

		// RETN
		assert(OpcodesED[0x45].flags == (OpcodeFlag.RET|OpcodeFlag.STOP));

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

	test('NumberTypes', () => {
		// CALL
		assert(Opcodes[0xCD].valueType == NumberType.CODE_SUB);

		// CALL cc
		assert(Opcodes[0xC4].valueType == NumberType.CODE_SUB);

		// JP
		assert(Opcodes[0xC3].valueType == NumberType.CODE_LBL);

		// JP cc
		assert(Opcodes[0xD2].valueType == NumberType.CODE_LBL);

		// JR
		assert(Opcodes[0x18].valueType == NumberType.CODE_LOCAL_LBL);

		// JR cc
		assert(Opcodes[0x20].valueType == NumberType.CODE_LOCAL_LBL);

		// DJNZ
		assert(Opcodes[0x10].valueType == NumberType.CODE_LOCAL_LBL);

		// RET
		assert(Opcodes[0xC9].valueType == NumberType.NONE);

		// LD HL,nn
		assert(Opcodes[0x21].valueType == NumberType.NUMBER_WORD);

		// LD (nn),A
		assert(Opcodes[0x32].valueType == NumberType.DATA_LBL);

		// LD (nn),HL
		assert(Opcodes[0x22].valueType == NumberType.DATA_LBL);

		// LD C,n
		assert(Opcodes[0x0E].valueType == NumberType.NUMBER_BYTE);

		// LD A,B
		assert(Opcodes[0x78].valueType == NumberType.NONE);

		// IN
		assert(Opcodes[0xDB].valueType == NumberType.PORT_LBL);

		// OUT
		assert(Opcodes[0xD3].valueType == NumberType.PORT_LBL);
	});

	test('length of opcode arrays', () => {
		// Length of arrays
		assert(Opcodes.length == 0x100);
		assert(OpcodesCB.length == 0x100);
		assert(OpcodesDD.length == 0x100);
		assert(OpcodesED.length == 0x100);
		assert(OpcodesFD.length == 0x100);
		assert(OpcodesDDCB.length == 0x100);
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


	test('RST n', () => {
		assert(Opcodes[0xC7].value == 0x00);	// rst 0
		assert(Opcodes[0xCF].value == 0x08);	// rst 8
		assert(Opcodes[0xD7].value == 0x10);	// rst 10
		assert(Opcodes[0xDF].value == 0x18);	// rst 18
		assert(Opcodes[0xE7].value == 0x20);	// rst 20
		assert(Opcodes[0xEF].value == 0x28);	// rst 28
		assert(Opcodes[0xF7].value == 0x30);	// rst 30
		assert(Opcodes[0xFF].value == 0x38);	// rst 38

		assert(!(Opcodes[0xC7].flags & OpcodeFlag.STOP));
	});

});
