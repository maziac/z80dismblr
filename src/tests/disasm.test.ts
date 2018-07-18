import * as assert from 'assert';
import { Disassembler } from '../disassembler/disasm';
import { NumberType } from '../disassembler/numbertype';
import { writeFileSync } from 'fs';
//import { Warning } from '../warning';
import { Opcodes } from '../disassembler/opcode';


var dasm: any;


suite('Disassembler', () => {

	/// Strip all labels, comments from the assembly.
	function trimAllLines(lines: Array<string>): Array<string> {
		const lines2 = new Array<string>();
		for(let line of lines) {
			// remove comment
			const match = /(^.*:|^([0-9a-f]{4})?\s+([^;:]*).*|^[^\s].*)/.exec(line);
			if(match)
				line = match[3] || '';
			line = line.trim();
			// compress multiple spaces into one
			line = line.replace(/\s\s+/g, ' ');
			// Remove empty lines (labels)
			if(line.length > 0)
				lines2.push(line);
		}
		return lines2;
	}


	/// Called for each test.
	setup(() => {
		dasm = new Disassembler() as any; 	// 'as any' allows access to protected methods

		dasm.labelSubPrefix = "SUB";
		dasm.labelLblPrefix = "LBL";
		dasm.labelDataLblPrefix = "DATA";
		dasm.labelLocalLablePrefix = "_lbl";
		dasm.labelLoopPrefix = "_loop";
		dasm.labelSelfModifyingPrefix = "SELF_MOD";

		dasm.clmnsAddress = 0;
		dasm.addOpcodeBytes = false;
		dasm.opcodesLowerCase = false;
	});

	//teardown();


	suite('General', () => {
		test('Constructor', () => {
			new Disassembler();
		});
	});


	suite('error conditions', () => {

		test('Warning: trying to disassemble unassigned area', () => {
			let warning = undefined;
			dasm.on('warning', msg => {
				warning = msg;
			});

			const memory = [
				0x3e, 0x01,			// LD a,1
				0x3e, 0x02,			// LD a,2
			];

			const org = 0x0;
			dasm.memory.setMemory(org, new Uint8Array(memory));
			dasm.setLabel(org);

			// Test that warning is emitted
			dasm.collectLabels();

			assert(warning != undefined);
		});

	});


	suite('collectLabels', () => {

		test('0 labels', () => {
			dasm.on('warning', msg => {
				assert(false);	// no warning should occur
			});

			const memory = [
				0x3e, 0x01,			// LD a,1
				0x3e, 0x02,			// LD a,2
				0x3e, 0x03,			// LD a,3
				0xc9,				// ret
			];

			const org = 0x32;
			dasm.memory.setMemory(org, new Uint8Array(memory));
			//dasm.setLabel(org); Do not set
			dasm.collectLabels();
			assert(dasm.labels.size == 0);
		});

		test('1 label', () => {
			dasm.on('warning', msg => {
				assert(false);	// no warnign should occur
			});

			const memory = [
				0x3e, 0x01,			// LD a,1
				0x3e, 0x02,			// LD a,2
				0x3e, 0x03,			// LD a,3
				0xc9,				// ret
			];

			const org = 0x32;
			dasm.memory.setMemory(org, new Uint8Array(memory));
			dasm.setLabel(org);
			dasm.collectLabels();
			assert(dasm.labels.size == 1);
			assert(dasm.labels.get(org) != undefined);
		});

		test('2 labels UNASSIGNED', () => {
			const memory = [
				0x3e, 0x01,			// LD a,1
				0xc3, 0x00, 0x40,	// JP 0x4000
			];

			const org = 0x1000;
			dasm.memory.setMemory(org, new Uint8Array(memory));
			dasm.setLabel(org);
			dasm.collectLabels();

			assert(dasm.labels.size == 2);

			const label1 = dasm.labels.get(org);
			assert(label1 != undefined);
			assert(label1.isEqu == false);

			const label2 = dasm.labels.get(0x4000);
			assert(label2 != undefined);
			assert(label2.isEqu == true);
		});

		test('2 labels ASSIGNED', () => {
			const memory = [
				0x3e, 0x01,			// LD a,1
			// L1002:
				0xc3, 0x02, 0x10,	// JP 0x1002
			];

			const org = 0x1000;
			dasm.memory.setMemory(org, new Uint8Array(memory));
			dasm.setLabel(org);
			dasm.collectLabels();

			assert(dasm.labels.size == 2);

			const label1 = dasm.labels.get(org);
			assert(label1 != undefined);
			assert(label1.isEqu == false);

			const label2 = dasm.labels.get(0x1002);
			assert(label2 != undefined);
			assert(label2.isEqu == false);
		});

		test('label types', () => {
			const memory = [
/*4000*/					// START:
/*4000*/ 0x3e, 0x01,	    //     ld a,1
/*4002*/					// START2:
/*4002*/ 0x28, 0xfe,		//     jr z,START2
/*4004*/ 0xda, 0x02, 0x40,	// 	   jp c,START2
/*4007*/					// LBL1:
/*4007*/ 0x00,				//     nop
/*4008*/ 0x10, 0xfd,		//     djnz LBL1
/*400a*/					// LBL2:
/*400a*/ 0x30, 0xfe,		//     jr nc,LBL2
/*400c*/ 0xca, 0x02, 0x40,	// 	   jp z,START2
/*400f*/ 0x00,				//     nop
/*4010*/ 0xcd, 0x1a, 0x40,	// 	   call SUB1
/*4013*/ 0xc9,				//     ret
/*4014*/ 0x00,				//     nop
/*4015*/					// SUB2:
/*4015*/ 0x28, 0x01,		//     jr z,LBL3
/*4017*/ 0x00,				//     nop
/*4018*/					// LBL3:
/*4018*/ 0xc9,				//     ret
/*4019*/ 0x00,				//     nop
/*401a*/					// SUB1:
/*401a*/ 0x3a, 0x0a, 0x40,	//	   ld a,(LBL2)
/*401d*/ 0xc8,				//     ret z
/*401e*/ 0x0e, 0x02,		//     ld c,2
/*4020*/ 0x20, 0xf6,		//     jr nz,LBL3
/*4022*/ 0x06, 0x05,		//     ld b,5
/*4024*/ 0x21, 0x03, 0x00,	//     ld hl,3
/*4027*/ 0x32, 0x36, 0x40,	//     ld (DATA1),a
/*402a*/ 0x3a, 0x00, 0x50,	//     ld a,(0x5000)
/*402d*/ 0xca, 0x00, 0x51,	//     jp z,0x5100
/*4030*/ 0xc9,				//     ret
/*4031*/ 0x00,				//     nop
/*4032*/					// LBL4:
/*4032*/ 0x00,				//     nop
/*4033*/ 0xc3, 0x32, 0x40,	//     jp LBL4
/*4036*/					// DATA1:
/*4036*/ 0x00				//     defb 0
];

			const org = 0x4000;
			dasm.memory.setMemory(org, new Uint8Array(memory));
			dasm.setLabel(org);
			dasm.collectLabels();

			//dasm.printLabels();

			assert(dasm.labels.size == 9);

			let label;

			label = dasm.labels.get(0x4000);
			assert(label != undefined);
			assert(label.type == NumberType.CODE_LBL);
			assert(label.isEqu == false);

			label = dasm.labels.get(0x4002);
			assert(label != undefined);
			assert(label.type == NumberType.CODE_LBL);
			assert(label.isEqu == false);

			label = dasm.labels.get(0x4007);
			assert(label != undefined);
			assert(label.type == NumberType.CODE_RELATIVE_LOOP);
			assert(label.isEqu == false);

			label = dasm.labels.get(0x400a);
			assert(label != undefined);
			assert(label.type == NumberType.DATA_LBL);
			assert(label.isEqu == false);

			label = dasm.labels.get(0x4018);
			assert(label != undefined);
			assert(label.type == NumberType.CODE_RELATIVE_LOOP);
			assert(label.isEqu == false);

			label = dasm.labels.get(0x401a);
			assert(label != undefined);
			assert(label.type == NumberType.CODE_SUB);
			assert(label.isEqu == false);

			label = dasm.labels.get(0x4036);
			assert(label != undefined);
			assert(label.type == NumberType.DATA_LBL);
			assert(label.isEqu == false);

			label = dasm.labels.get(0x5000);
			assert(label != undefined);
			assert(label.type == NumberType.DATA_LBL);
			assert(label.isEqu == true);

			label = dasm.labels.get(0x5100);
			assert(label != undefined);
			assert(label.type == NumberType.CODE_LBL);
			assert(label.isEqu == true);
		});

		test('self-modifying code', () => {
			// Note: Regex to exchange list-output with bytes:
			// find-pattern: ^([0-9a-f]+)\s+([0-9a-f]+)?\s+([0-9a-f]+)?\s+([0-9a-f]+)?\s?(.*)
			// subst-pattern: /*$1*/ 0x$2, 0x$3, 0x$4,\t// $5

			const memory = [
/*5000*/ 					// STARTA1:
/*5000*/ 0xc3, 0x00, 0x00,	// 	    jp 0x0000
/*5003*/ 					// STARTA2:
/*5003*/ 0x21, 0x00, 0x60,	// 	    ld hl,0x6000
/*5006*/ 0x22, 0x01, 0x50,	// 	    ld (STARTA1+1),hl
/*5009*/ 0xc9, 				// ret
			];

			const org = 0x5000;
			dasm.memory.setMemory(org, new Uint8Array(memory));
			dasm.setLabel(org);
			dasm.setLabel(org+3);
			dasm.collectLabels();

			//dasm.printLabels();

			assert(dasm.labels.size == 4);

			let label;

			label = dasm.labels.get(0x0000);
			assert(label != undefined);
			assert(label.type == NumberType.CODE_LBL);
			assert(label.isEqu == true);

			label = dasm.labels.get(org);
			assert(label != undefined);
			assert(label.type == NumberType.CODE_LBL);
			assert(label.isEqu == false);

			label = dasm.labels.get(org+3);
			assert(label != undefined);
			assert(label.type == NumberType.CODE_LBL);
			assert(label.isEqu == false);

			// self.modifying label
			label = dasm.labels.get(org+1);
			assert(label != undefined);
			assert(label.type == NumberType.DATA_LBL);
			assert(label.isEqu == false);
		});

    });


	suite('countTypesOfLabels', () => {

		test('label types', () => {
			const memory = [
/*6000*/ 					// BCODE_START:
/*6000*/ 0xca, 0x03, 0x60,	// 	    jp z,BCODE2
/*6003*/ 					// BCODE2:
/*6003*/ 0xca, 0x06, 0x60,	// 	    jp z,BCODE3
/*6006*/ 					// BCODE3:
/*6006*/ 0xca, 0x09, 0x60,	// 	    jp z,BCODE4
/*6009*/ 					// BCODE4:
/*6009*/ 0x3a, 0x19, 0x60,	// 	    ld a,(BDATA1)
/*600c*/ 0x2a, 0x1a, 0x60,	// 	    ld hl,(BDATA2)
/*600f*/ 0x22, 0x1b, 0x60,	// 	    ld (BDATA3),hl
/*6012*/ 0xcd, 0x15, 0x60,	// 	    call BSUB1
/*6015*/ 					// BSUB1:
/*6015*/ 0xcd, 0x18, 0x60,	// 	    call BSUB2
/*6018*/ 					// BSUB2:
/*6018*/ 0xc9,				// 		ret
/*6019*/ 0x01,				// BDATA1: defb 1
/*601a*/ 0x02,				// BDATA2: defb 2
/*601b*/ 0x03,				// BDATA3: defb 3
];

			const org = 0x6000;
			dasm.memory.setMemory(org, new Uint8Array(memory));
			dasm.setLabel(org);
			dasm.collectLabels();

			//dasm.printLabels();
			dasm.countTypesOfLabels();

			assert(dasm.labelSubCount == 2);
			assert(dasm.labelLblCount == 4);
			assert(dasm.labelDataLblCount == 3);

			assert(dasm.labelSubCountDigits == 1);
			assert(dasm.labelLblCountDigits == 1);
			assert(dasm.labelDataLblCountDigits == 1);
		});
    });


	suite('references', () => {

		test('count references', () => {
			const memory = [
/*8000*/ 					// DSTART:
/*8000*/ 0x00,				// 		nop
/*8001*/ 					// DCODE1:
/*8001*/ 0xca, 0x0e, 0x80,	// 	    jp z,DCODE2
/*8004*/ 0xcc, 0x0e, 0x80,	// 	    call z,DCODE2
/*8007*/ 0x10, 0xf8, 		// 		djnz DCODE1
/*8009*/ 0x3a, 0x01, 0x80,	// 	    ld a,(DCODE1)
/*800c*/ 0x18, 0x00, 		// 		jr DCODE2
/*800e*/ 					// DCODE2:
/*800e*/ 0xc9, 				// 		ret
			];

			const org = 0x8000;
			dasm.memory.setMemory(org, new Uint8Array(memory));
			dasm.setLabel(org);
			dasm.collectLabels();

			//dasm.printLabels();

			assert(dasm.labels.size == 3);

			let label;

			label = dasm.labels.get(0x8000);
			assert(label.references.length == 0);

			label = dasm.labels.get(0x8001);
			assert(label.references.length == 2);

			label = dasm.labels.get(0x800e);
			assert(label.references.length == 3);

		});
	});


	suite('assignLabelNames', () => {

		test('only absolute', () => {
			const memory = [
/*6000*/ 					// BCODE_START:
/*6000*/ 0xca, 0x03, 0x60,	// 	    jp z,BCODE2
/*6003*/ 					// BCODE2:
/*6003*/ 0xca, 0x06, 0x60,	// 	    jp z,BCODE3
/*6006*/ 					// BCODE3:
/*6006*/ 0xca, 0x09, 0x60,	// 	    jp z,BCODE4
/*6009*/ 					// BCODE4:
/*6009*/ 0x3a, 0x19, 0x60,	// 	    ld a,(BDATA1)
/*600c*/ 0x2a, 0x1a, 0x60,	// 	    ld hl,(BDATA2)
/*600f*/ 0x22, 0x1b, 0x60,	// 	    ld (BDATA3),hl
/*6012*/ 0xcd, 0x15, 0x60,	// 	    call BSUB1
/*6015*/ 					// BSUB1:
/*6015*/ 0xcd, 0x18, 0x60,	// 	    call BSUB2
/*6018*/ 					// BSUB2:
/*6018*/ 0xc9,				// 		ret
/*6019*/ 0x01,				// BDATA1: defb 1
/*601a*/ 0x02,				// BDATA2: defb 2
/*601b*/ 0x03,				// BDATA3: defb 3
			];

			dasm.labelSubPrefix = "BSUB";
			dasm.labelLblPrefix = "BCODE";
			dasm.labelDataLblPrefix = "BDATA";

			const org = 0x6000;
			dasm.memory.setMemory(org, new Uint8Array(memory));
			dasm.setLabel(org);
			dasm.collectLabels();

			// Test:
			dasm.countTypesOfLabels();
			dasm.assignLabelNames();

			//dasm.printLabels();

			assert(dasm.labels.size == 9);

			let label;

			label = dasm.labels.get(0x6000);
			assert(label.name == 'BCODE1');
			assert(label.isEqu == false);

			label = dasm.labels.get(0x6003);
			assert(label.name == 'BCODE2');
			assert(label.isEqu == false);

			label = dasm.labels.get(0x6006);
			assert(label.name == 'BCODE3');

			label = dasm.labels.get(0x6009);
			assert(label.name == 'BCODE4');

			label = dasm.labels.get(0x6015);
			assert(label.name == 'BSUB1');

			label = dasm.labels.get(0x6018);
			assert(label.name == 'BSUB2');

			label = dasm.labels.get(0x6019);
			assert(label.name == 'BDATA1');

			label = dasm.labels.get(0x601a);
			assert(label.name == 'BDATA2');

			label = dasm.labels.get(0x601b);
			assert(label.name == 'BDATA3');
		});


		test('also relative', () => {
			const memory = [
/*7000*/ 					// CCODE_START:
/*7000*/ 0x28, 0x00,		// 		jr z,l1_rel1
/*7002*/ 					// l1_rel1:
/*7002*/ 0x28, 0x00,		// 		jr z,l1_rel2
/*7004*/ 					// l1_rel2:
/*7004*/ 0x00,				// 		nop
/*7005*/					// l1_loop1:
/*7005*/ 0x10, 0xfe,		// 		djnz l1_loop1
/*7007*/ 0xcd, 0x0b, 0x70,	// 	    call CSUB1
/*700a*/ 0xc9,				// ret
/*700b*/ 					// CSUB1:
/*700b*/ 0x28, 0x00,		// 		jr z,s1_rel1
/*700d*/ 					// s1_rel1:
/*700d*/ 0x28, 0x00,		// 		jr z,s1_rel2
/*700f*/ 					// s1_rel2:
/*700f*/ 0x00, 				// 		nop
/*7010*/ 					// s1_loop1:
/*7010*/ 0x10, 0xfe,		// 		djnz s1_loop1
/*7012*/ 					// s1_loop2:
/*7012*/ 0x10, 0xfe,		// 		djnz s1_loop2
/*7014*/ 0xc9,				// 		ret
			];

			dasm.labelSubPrefix = "CSUB";
			dasm.labelLblPrefix = "CCODE";
			dasm.labelLocalLablePrefix = "_l";
			dasm.labelLoopPrefix = "_loop";

			const org = 0x7000;
			dasm.memory.setMemory(org, new Uint8Array(memory));
			dasm.setLabel(org);
			dasm.collectLabels();

			// Test:
			dasm.countTypesOfLabels();
			dasm.assignLabelNames();

			//dasm.printLabels();

			assert(dasm.labels.size == 9);

			let label;

			label = dasm.labels.get(0x7002);
			assert(label.name == '.ccode1_l1');
			assert(label.isEqu == false);

			label = dasm.labels.get(0x7004);
			assert(label.name == '.ccode1_l2');
			assert(label.isEqu == false);

			label = dasm.labels.get(0x7005);
			assert(label.name == '.ccode1_loop');

			label = dasm.labels.get(0x700d);
			assert(label.name == '.csub1_l1');

			label = dasm.labels.get(0x700f);
			assert(label.name == '.csub1_l2');

			label = dasm.labels.get(0x7010);
			assert(label.name == '.csub1_loop1');

			label = dasm.labels.get(0x7012);
			assert(label.name == '.csub1_loop2');
		});
    });


	suite('disassemble', () => {

	/// Called for each test.
	setup(() => {
		dasm = new Disassembler() as any; 	// 'as any' allows access to protected methods

		dasm.labelSubPrefix = "SUB";
		dasm.labelLblPrefix = "LBL";
		dasm.labelDataLblPrefix = "DATA";
		dasm.labelLocalLablePrefix = "_lbl";
		dasm.labelLoopPrefix = "_loop";
		dasm.labelSelfModifyingPrefix = "SELF_MOD";

		dasm.clmnsAddress = 0;
		dasm.addOpcodeBytes = false;
		dasm.opcodesLowerCase = false;
	});


		test('combined opcodes', () => {
			const memory = [
				0xdd, 0x71, 0xf7,  // ld   (ix-9),c
				0xdd, 0x70, 0xf8,  // ld   (ix-8),b
				0xdd, 0x7e, 0xf7,  // ld   a,(ix-9)
				0xc6, 0xff,        // add a,0xff

				0x01, 0x34, 0x12,	// ld bc,1234h
				0x04,				// inc b
				0xCB, 0x05,			// rlc l
				0xCB, 0x06,			// rlc (hl)
				0xDD, 0x09,			// add ix,bc
				0xED, 0x40,			// in b,(c)
				0xFD, 0x19,			// add iy,de
				0xDD, 0xCB, 3, 4,	// rlc (ix+3),h
				0xFD, 0xCB, 1, 2,	// rlc (iy+1),d
				0xDD, 0xCB, -5, 6,	// rlc (ix-5)
				0xFD, 0xCB, -9, 6,	// rlc (iy-9)
			];

			const org = 0x0000;
			dasm.memory.setMemory(org, new Uint8Array(memory));
			dasm.setLabel(org);
			const linesUntrimmed = dasm.disassemble();

			const lines = trimAllLines(linesUntrimmed);
			//console.log(lines.join('\n'));

			let i = -1;
			assert(lines[++i] == 'ORG 0')
			assert(lines[++i] == 'LD (IX-9),C')
			assert(lines[++i] == 'LD (IX-8),B')
			assert(lines[++i] == 'LD A,(IX-9)')
			assert(lines[++i] == 'ADD A,255');

			assert(lines[++i] == 'LD BC,4660')
			assert(lines[++i] == 'INC B');
			assert(lines[++i] == 'RLC L');
			assert(lines[++i] == 'RLC (HL)');
			assert(lines[++i] == 'ADD IX,BC');
			assert(lines[++i] == 'IN B,(C)');
			assert(lines[++i] == 'ADD IY,DE');
			assert(lines[++i] == 'RLC (IX+3) -> H');
			assert(lines[++i] == 'RLC (IY+1) -> D');
			assert(lines[++i] == 'RLC (IX-5)');
			assert(lines[++i] == 'RLC (IY-9)');
		});


		test('invalid opcodes', () => {
			const memory = [
				// invalid instruction
				0xED, 0xCB,
				0xED, 0x10,
				// etc.
			];

			const org = 0x0000;
			dasm.memory.setMemory(org, new Uint8Array(memory));
			dasm.setLabel(org);
			const linesUntrimmed = dasm.disassemble();

			const lines = trimAllLines(linesUntrimmed);
			//console.log(lines.join('\n'));

			for(let i=1; i<lines.length; i++ )
				assert(lines[i] == 'INVALID INSTRUCTION');
		});


		test('nop opcodes', () => {
			const memory = [
				0xDD, 0xDD, 0x09,	// nop; add ix,bc
				0xDD, 0xED, 0x40,	// nop; in b,(c)
				0xDD, 0xFD, 0x19,	// nop; add iy,de

				0xFD, 0xDD, 0x09,	// nop; add ix,bc
				0xFD, 0xED, 0x40,	// nop; in b,(c)
				0xFD, 0xFD, 0x19,	// nop; add iy,de
			];

			const org = 0x0000;
			dasm.memory.setMemory(org, new Uint8Array(memory));
			dasm.setLabel(org);
			dasm.clmnsAddress = 0;
			dasm.opcodesLowerCase = false;
			const linesUntrimmed = dasm.disassemble();

			const lines = trimAllLines(linesUntrimmed);
			//console.log(lines.join('\n'));

			let i = -1;
			assert(lines[++i] == 'ORG 0')
			assert(lines[++i] == '[NOP]')
			assert(lines[++i] == 'ADD IX,BC');
			assert(lines[++i] == '[NOP]')
			assert(lines[++i] == 'IN B,(C)');
			assert(lines[++i] == '[NOP]')
			assert(lines[++i] == 'ADD IY,DE');
			assert(lines[++i] == '[NOP]')
			assert(lines[++i] == 'ADD IX,BC');
			assert(lines[++i] == '[NOP]')
			assert(lines[++i] == 'IN B,(C)');
			assert(lines[++i] == '[NOP]')
			assert(lines[++i] == 'ADD IY,DE');
		});


		test('RST n', () => {
			const memory = [
				0xC7,	// RST 0
				0xCF,	// RST 8
				0xD7,	// RST 16
				0xDF,	// RST 24
				0xE7,	// RST 32
				0xEF,	// RST 40
				0xF7,	// RST 48
				0xFF,	// RST 56
			];

			const org = 0x1000;
			dasm.setMemory(org, new Uint8Array(memory));
			dasm.setLabel(org);
			const linesUntrimmed = dasm.disassemble();

			const lines = trimAllLines(linesUntrimmed);
			//console.log(lines.join('\n'));

			let i = -1;
			assert(lines[++i] == 'ORG 4096')
			assert(lines[++i] == 'RST 0')
			assert(lines[++i] == 'RST 8');
			assert(lines[++i] == 'RST 16')
			assert(lines[++i] == 'RST 24');
			assert(lines[++i] == 'RST 32')
			assert(lines[++i] == 'RST 40');
			assert(lines[++i] == 'RST 48');
			assert(lines[++i] == 'RST 56')
		});


		test('ZX Next opcodes', () => {
			const memory = [
				0xED, 0xA4,		// LDIX
				0xED, 0xA5,		// LDWS
				0xED, 0xB4,		// LDIRX
				0xED, 0xAC,		// LDDX
				0xED, 0xBC,		// LDDRX
				0xED, 0xB6,		// LDIRSCALE
				0xED, 0xB7,		// LDPIRX

				0xED, 0x30,		// MUL D,E

				0xED, 0x31,		// ADD HL,A
				0xED, 0x32,		// ADD DE,A
				0xED, 0x33,		// ADD BC,A
				0xED, 0x34,	0x34, 0x12,	// ADD HL,#nn
				0xED, 0x35,	0x45, 0x23,		// ADD DE,#nn
				0xED, 0x36,	0x56, 0x34,		// ADD BC,#nn

				0xED, 0x23,		// SWAPNIB

				0xED, 0x24,		// MIRROR

				0xED, 0x8A,	0x11, 0x88,		// PUSH 0x1188 (big endian)

				0xED, 0x91,	250, 9,	// NEXREG #n,#n
				0xED, 0x92,	40,		// NEXREG #n,A

				0xED, 0x93,		// PIXELDN
				0xED, 0x94,		// PIXELAD

				0xED, 0x95,		// SETAE

				0xED, 0x27,	11	// TEST #n
			];

			const org = 0x0000;
			dasm.memory.setMemory(org, new Uint8Array(memory));
			dasm.setLabel(org);
			const linesUntrimmed = dasm.disassemble();

			const lines = trimAllLines(linesUntrimmed);
			//console.log(lines.join('\n'));

			let i = -1;
			assert(lines[++i] == 'ORG 0');
			assert(lines[++i] == 'LDIX');
			assert(lines[++i] == 'LDWS');
			assert(lines[++i] == 'LDIRX');
			assert(lines[++i] == 'LDDX');
			assert(lines[++i] == 'LDDRX');
			assert(lines[++i] == 'LDIRSCALE');
			assert(lines[++i] == 'LDPIRX');
			assert(lines[++i] == 'MUL D,E')
			assert(lines[++i] == 'ADD HL,A');
			assert(lines[++i] == 'ADD DE,A')
			assert(lines[++i] == 'ADD BC,A');
			assert(lines[++i] == 'ADD HL,4660');		// 1234h
			assert(lines[++i] == 'ADD DE,9029');		// 2345h
			assert(lines[++i] == 'ADD BC,13398');	// 3456h
			assert(lines[++i] == 'SWAPNIB');
			assert(lines[++i] == 'MIRROR');
			assert(lines[++i] == 'PUSH 34833');	// 8811h
			assert(lines[++i] == 'NEXTREG 250,9');
			assert(lines[++i] == 'NEXTREG 40,A');
			assert(lines[++i] == 'PIXELDN');
			assert(lines[++i] == 'PIXELAD');
			assert(lines[++i] == 'SETAE');
			assert(lines[++i] == 'TEST 11');
		});


		test('simple', () => {
			const memory = [
/*8000*/ 0x3e, 0xfd,		// ld a,0xfd (-3)
/*8002*/ 0x21, 0xdc, 0xfe,	// ld hl,0xfedc
/*8005*/ 0xc9,	// ret
			];

			const org = 0x0000;
			dasm.memory.setMemory(org, new Uint8Array(memory));
			dasm.setLabel(org);
			const linesUntrimmed = dasm.disassemble();

			const lines = trimAllLines(linesUntrimmed);
			//console.log('\n');
			//console.log(lines.join('\n'));

			let i = -1;
			assert(lines[++i] == 'ORG 0')
			assert(lines[++i] == 'LD A,253');
			assert(lines[++i] == 'LD HL,65244');
			assert(lines[++i] == 'RET');
		});


		test('more complex', () => {
			const memory = [
/*7000*/ 					// CCODE_START:
/*7000*/ 0x28, 0x00,		// 		jr z,l1_rel1
/*7002*/ 					// l1_rel1:
/*7002*/ 0x28, 0x00,		// 		jr z,l1_rel2
/*7004*/ 					// l1_rel2:
/*7004*/ 0x00,				// 		nop
/*7005*/					// l1_loop1:
/*7005*/ 0x10, 0xfe,		// 		djnz l1_loop1
/*7007*/ 0xcd, 0x0b, 0x70,	// 	    call CSUB1
/*700a*/ 0xc9,				// ret
/*700b*/ 					// CSUB1:
/*700b*/ 0x28, 0x00,		// 		jr z,s1_rel1
/*700d*/ 					// s1_rel1:
/*700d*/ 0x28, 0x00,		// 		jr z,s1_rel2
/*700f*/ 					// s1_rel2:
/*700f*/ 0x00, 				// 		nop
/*7010*/ 					// s1_loop1:
/*7010*/ 0x10, 0xfe,		// 		djnz s1_loop1
/*7012*/ 					// s1_loop2:
/*7012*/ 0x10, 0xfe,		// 		djnz s1_loop2
/*7014*/ 0xc9,				// 		ret
			];

			dasm.labelSubPrefix = "SUB";
			dasm.labelLblPrefix = "LBL";
			dasm.labelDataLblPrefix = "DATA";
			dasm.labelLocalLablePrefix = "_lbl";
			dasm.labelLoopPrefix = "_loop";

			const org = 0x7000;
			dasm.memory.setMemory(org, new Uint8Array(memory));
			dasm.setLabel(org);
			const lines = dasm.disassemble();

			//dasm.printLabels();
			//console.log('\n');
			//console.log(lines.join('\n'));

			assert(lines.length > 10);	// It's hard to find a good assert here.
		});



		test('self-modifying jp', () => {
			// Note: Regex to exchange list-output with bytes:
			// find-pattern: ^([0-9a-f]+)\s+([0-9a-f]+)?\s+([0-9a-f]+)?\s+([0-9a-f]+)?\s?(.*)
			// subst-pattern: /*$1*/ 0x$2, 0x$3, 0x$4,\t// $5

			const memory = [
/*5000*/ 					// STARTA1:
/*5000*/ 0xc3, 0x03, 0x50,	// 	    jp 0x0000
/*5003*/ 					// STARTA2:
/*5003*/ 0x21, 0x00, 0x60,	// 	    ld hl,0x6000
/*5006*/ 0x22, 0x01, 0x50,	// 	    ld (STARTA1+1),hl
/*5009*/ 0xc9, 				// ret
			];

			const org = 0x5000;
			dasm.memory.setMemory(org, new Uint8Array(memory));
			dasm.setLabel(org);
			const linesUntrimmed = dasm.disassemble();

			const lines = trimAllLines(linesUntrimmed);

			//dasm.printLabels();

			assert(linesUntrimmed[5] == 'SELF_MOD1:');
			assert(lines[3] == 'LD (SELF_MOD1+1),HL');
		});

    });




	suite('several memories', () => {

		test('2 areas', () => {
			const memory1 = [
				0xC7,	// RST 0
			];

			const memory2 = [
				0xE7,	// RST 32
			];

			const org1 = 0x1000;
			dasm.setMemory(org1, new Uint8Array(memory1));
			dasm.setLabel(org1);

			const org2 = 0x2000;
			dasm.setMemory(org2, new Uint8Array(memory2));
			dasm.setLabel(org2);

			const linesUntrimmed = dasm.disassemble();

			const lines = trimAllLines(linesUntrimmed);
			//console.log(lines.join('\n'));

			let i = -1;
			assert(lines[++i] == 'ORG 4096')
			assert(lines[++i] == 'RST 0')
			assert(lines[++i] == 'ORG 8192');
			assert(lines[++i] == 'RST 32')
		});

	});



	suite('complete binaries', () => {

		test('currah', () => {
			// configure
			dasm.labelSubPrefix = "SUB";
			dasm.labelLblPrefix = "LBL";
			dasm.labelDataLblPrefix = "DATA";
			dasm.labelLocalLablePrefix = "_lbl";
			dasm.labelLoopPrefix = "_loop";

			const org = 0x8000;
			dasm.readBinFile(org, './src/tests/data/currah.bin');
			dasm.setLabel(org);

			// Set the 3 call tables
			dasm.setJmpTable(0x80E5, 10);
			dasm.setJmpTable(0x80FD, 10);
			dasm.setJmpTable(0x8115, 10);

			// Disassemble
			const lines = dasm.disassemble();

			//dasm.printLabels();
			//console.log(lines.join('\n'));

			// There is no special check, basically just that it does not crash.
			assert(lines.length > 1000);
		});

		test('sw', () => {
			// configure
			dasm.labelSubPrefix = "SUB";
			dasm.labelLblPrefix = "LBL";
			dasm.labelDataLblPrefix = "DATA";
			dasm.labelLocalLablePrefix = "_lbl";
			dasm.labelLoopPrefix = "_loop";
			dasm.clmnsAddress = 5;
			dasm.addOpcodeBytes = true;

			const org = 0x4000;
			dasm.memory.readBinFile(org, './src/tests/data/sw.obj');
			dasm.setLabel(0xA660, "LBL_MAIN");
			dasm.setLabel(0xA5F7, "LBL_MAIN_INTERRUPT");

			// Disassemble
			const lines = dasm.disassemble();

			//dasm.printLabels();
			//console.log(lines.join('\n'));
			writeFileSync('./out/tests/out.asm', lines.join('\n'));

			// There is no special check, basically just that it does not crash.
			assert(lines.length > 1000);
		});

    });

	suite('complete sna files', () => {

		test('sw', () => {
			//return;
			// configure
			dasm.labelSubPrefix = "SUB";
			dasm.labelLblPrefix = "LBL";
			dasm.labelDataLblPrefix = "DATA";
			dasm.labelLocalLablePrefix = "_lbl";
			dasm.labelLoopPrefix = "_loop";

			dasm.clmnsAddress = 5;
			dasm.addOpcodeBytes = true;

			dasm.readSnaFile('./src/tests/data/sw.sna');
			dasm.setLabel(0xA5F7, "LBL_MAIN_INTERRUPT");

			// Disassemble
			const lines = dasm.disassemble();

			//dasm.printLabels();
			//console.log(lines.join('\n'));
			writeFileSync('./out/tests/out.asm', lines.join('\n'));

			// There is no special check, basically just that it does not crash.
			assert(lines.length > 1000);
		});

    });


	suite('mame', () => {

		test('.tr trace file', () => {
			// configure
			dasm.labelSubPrefix = "SUB";
			dasm.labelLblPrefix = "LBL";
			dasm.labelDataLblPrefix = "DATA";
			dasm.labelLocalLablePrefix = "_lbl";
			dasm.labelLoopPrefix = "_loop";

			dasm.clmnsAddress = 5;
			dasm.addOpcodeBytes = true;

			dasm.readSnaFile('./src/tests/data/sw.sna');
			//dasm.setLabel(0xA5F7, "LBL_MAIN_INTERRUPT");

			// Set tr file
			dasm.useMameTraceFile('./src/tests/data/sw.tr');

			// Disassemble
			const lines = dasm.disassemble();

			//dasm.printLabels();
			//console.log(lines.join('\n'));
			writeFileSync('./out/tests/out.asm', lines.join('\n'));

			// There is no special check, basically just that it does not crash.
			assert(lines.length > 1000);
		});

    });


});
