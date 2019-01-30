import * as assert from 'assert';
import { Disassembler } from '../disassembler/disasm';
import { NumberType } from '../disassembler/numbertype';
import { writeFileSync } from 'fs';
import { Opcodes } from '../disassembler/opcode';


var dasm: any;


suite('Disassembler', () => {

	/// Strip all labels, comments from the assembly.
	function trimAllLines(lines: Array<string>): Array<string> {
		const lines2 = new Array<string>();
		for(let line of lines) {
			// remove comment
			const match = /(^\S*:|^([0-9a-f]{4})?\s+([^;:]*).*|^[^\s].*)/.exec(line);
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
		dasm.DBG_ADD_DEC_ADDRESS = false;

		dasm.clmnsAddress = 0;
		dasm.addOpcodeBytes = false;
		dasm.opcodesLowerCase = false;

		dasm.initLabels();
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
/*402d*/ 0xca, 0x00, 0x51,	//     jp z,0x5100 ; Jump to unassigned memory is treated as a CALL
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
			assert(label.type == NumberType.CODE_LOCAL_LOOP);
			assert(label.isEqu == false);

			label = dasm.labels.get(0x400a);
			assert(label != undefined);
			//assert(label.type == NumberType.DATA_LBL); Depends on priority
			assert(label.type == NumberType.CODE_LOCAL_LOOP);
			assert(label.isEqu == false);

			label = dasm.labels.get(0x4018);
			assert(label != undefined);
			assert(label.type == NumberType.CODE_LOCAL_LOOP);
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
			assert(label.type == NumberType.CODE_SUB);	// Jump to unassigned memory is treated as a CALL
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

			assert(dasm.labels.size == 4);

			let label;

			label = dasm.labels.get(0x0000);
			assert(label != undefined);
			assert(label.type == NumberType.CODE_SUB);
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
			assert(label.references.size == 0);

			label = dasm.labels.get(0x8001);
			assert(label.references.size == 2);

			label = dasm.labels.get(0x800e);
			assert(label.references.size == 3);

		});
	});


	suite('assignLabelNames', () => {

		test('addParentReferences', () => {
			const memory = [
/*6000*/ 					// BCODE_START:
/*6000*/ 0x3E, 16,	// LD A,16
/*6002*/ 0xC9,		// ret
			];

			dasm.labelSubPrefix = "BSUB";
			//dasm.labelLblPrefix = "BCODE";
			//dasm.labelDataLblPrefix = "BDATA";

			const org = 0x6000;
			dasm.memory.setMemory(org, new Uint8Array(memory));
			dasm.setLabel(org);

			// Test:
			dasm.disassemble();
			//const linesUntrimmed = dasm.disassembledLines;

			//dasm.printLabels();

			assert(dasm.labels.size == 1);

			let label;

			label = dasm.labels.get(0x6000);
			assert(label.name == 'BSUB1');
			assert(label.isEqu == false);

			const addrParents = dasm.addressParents;
			assert(addrParents[org-1] == undefined);
			assert(addrParents[org] == label);
			assert(addrParents[org+1] == undefined);
			assert(addrParents[org+2] == label);
			assert(addrParents[org+3] == undefined);
		});


		test('addParentReferences 2', () => {
			const memory = [
/*+0*/ 					// BSUB1:
/*+0*/ 0xca, 0x07, 0x00,	// 	    jp z,BSUB2
/*+3*/ 0x3E, 16,			// 		LD A,16
/*+5*/ 0xC9,				// 		ret

/*+6*/ 					// BSUB2:
/*+6*/ 0x3E, 16,			// 		LD A,16
/*+8*/ 0xC9,				// 		ret

			];

			dasm.labelSubPrefix = "BSUB";
			//dasm.labelLblPrefix = "BCODE";
			//dasm.labelDataLblPrefix = "BDATA";

			const org = 0x0001;
			dasm.memory.setMemory(org, new Uint8Array(memory));
			dasm.setLabel(org);

			// Test:
			dasm.disassemble();
			//const linesUntrimmed = dasm.disassembledLines;

			//dasm.printLabels();

			assert(dasm.labels.size == 2);

			const label1 = dasm.labels.get(org);
			assert(label1.name == 'BSUB1');
			assert(label1.isEqu == false);

			const label2 = dasm.labels.get(org+6);
			assert(label2.name == '.bsub1_lbl');
			assert(label2.isEqu == false);
			assert(label2.type == NumberType.CODE_LOCAL_LBL);

			const addrParents = dasm.addressParents;
			assert(addrParents[org] == label1);
			assert(addrParents[org+1] == undefined);
			assert(addrParents[org+2] == undefined);
			assert(addrParents[org+3] == label1);
			assert(addrParents[org+4] == undefined);
			assert(addrParents[org+5] == label1);

			assert(addrParents[org+6] == label1);
			assert(addrParents[org+7] == undefined);
			assert(addrParents[org+8] == label1);
			assert(addrParents[org+9] == undefined);
		});


		test('findLocalLabels 1', () => {
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
			dasm.disassemble();
			//const linesUntrimmed = dasm.disassembledLines;

			//dasm.printLabels();

			assert(dasm.labels.size == 9);

			let label;

			label = dasm.labels.get(0x6000);
			assert(label.name == 'BSUB1');
			assert(label.isEqu == false);

			label = dasm.labels.get(0x6003);
			assert(label.name == '.bsub1_lbl1');
			assert(label.isEqu == false);

			label = dasm.labels.get(0x6006);
			assert(label.name == '.bsub1_lbl2');

			label = dasm.labels.get(0x6009);
			assert(label.name == '.bsub1_lbl3');

			label = dasm.labels.get(0x6015);
			assert(label.name == '.bsub1_lbl4');

			label = dasm.labels.get(0x6018);
			assert(label.name == '.bsub1_lbl5');

			label = dasm.labels.get(0x6019);
			assert(label.name == 'BDATA1');

			label = dasm.labels.get(0x601a);
			assert(label.name == 'BDATA2');

			label = dasm.labels.get(0x601b);
			assert(label.name == 'BDATA3');
		});


		test('assignLabelNames relative', () => {
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
/*700a*/ 0xc9,				// 		ret
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
/*7015*/ 0xcd, 0x0B, 0x70	// 		JP CSUB2

			];

			dasm.labelSubPrefix = "CSUB";
			dasm.labelLblPrefix = "CCODE";
			dasm.labelLocalLablePrefix = "_l";
			dasm.labelLoopPrefix = "_loop";

			const org = 0x7000;
			dasm.memory.setMemory(org, new Uint8Array(memory));
			dasm.setLabel(org);
			dasm.setLabel(0x7015);

			// Test:
			dasm.disassemble();
			//const linesUntrimmed = dasm.disassembledLines;

			//dasm.printLabels();

			assert(dasm.labels.size == 10);

			let label;

			label = dasm.labels.get(0x7000);
			assert(label.name == 'CSUB1');
			assert(label.isEqu == false);

			label = dasm.labels.get(0x7002);
			assert(label.name == '.csub1_l1');
			assert(label.isEqu == false);

			label = dasm.labels.get(0x7004);
			assert(label.name == '.csub1_l2');
			assert(label.isEqu == false);

			label = dasm.labels.get(0x7005);
			assert(label.name == '.csub1_loop');

			label = dasm.labels.get(0x700B);
			assert(label.name == 'CSUB2');

			label = dasm.labels.get(0x700d);
			assert(label.name == '.csub2_l1');

			label = dasm.labels.get(0x700f);
			assert(label.name == '.csub2_l2');

			label = dasm.labels.get(0x7010);
			assert(label.name == '.csub2_loop1');

			label = dasm.labels.get(0x7012);
			assert(label.name == '.csub2_loop2');

			label = dasm.labels.get(0x7015);
			assert(label.name == 'CCODE1');
		});
    });


	suite('disassemble', () => {

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
				0x28, 0x02,			// jr z,+2 : To reach both jumps.
				0xDD, 0xE9,	// jp (ix)
				0xFD, 0xE9,	// jp (iy)

			];

			const org = 0x0000;
			dasm.memory.setMemory(org, new Uint8Array(memory));
			dasm.setLabel(org);
			dasm.disassemble();
			const linesUntrimmed = dasm.disassembledLines;

			const lines = trimAllLines(linesUntrimmed);
			//console.log(lines.join('\n'));

			let i = -1;
			assert(lines[++i] == 'ORG 0000h')
			assert(lines[++i] == 'LD (IX-9),C')
			assert(lines[++i] == 'LD (IX-8),B')
			assert(lines[++i] == 'LD A,(IX-9)')
			assert(lines[++i] == 'ADD A,FFh');

			assert(lines[++i] == 'LD BC,1234h')
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
			++i;
			assert(lines[++i] == 'JP (IX)');
			assert(lines[++i] == 'JP (IY)');
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
			dasm.disassemble();
			const linesUntrimmed = dasm.disassembledLines;

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
			dasm.disassemble();
			const linesUntrimmed = dasm.disassembledLines;

			const lines = trimAllLines(linesUntrimmed);
			//console.log(lines.join('\n'));

			let i = -1;
			assert(lines[++i] == 'ORG 0000h')
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
			dasm.disassemble();
			const linesUntrimmed = dasm.disassembledLines;

			const lines = trimAllLines(linesUntrimmed);
			//console.log(lines.join('\n'));

			let i = -1;
			assert(lines[++i] == 'ORG 1000h')
			assert(lines[++i] == 'RST 00h')
			assert(lines[++i] == 'RST 08h');
			assert(lines[++i] == 'RST 10h')
			assert(lines[++i] == 'RST 18h');
			assert(lines[++i] == 'RST 20h')
			assert(lines[++i] == 'RST 28h');
			assert(lines[++i] == 'RST 30h');
			assert(lines[++i] == 'RST 38h')
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

				0xED, 0x91,	0, 10,	// NEXTREG #REG_MACHINE_ID,#RMI_ZXNEXT
				0xED, 0x91,	3, 0b10010010,	// NEXTREG #REG_MACHINE_TYPE,#lock timing|Timing:ZX48K|Macnine:ZX128K
				0xED, 0x92,	5,		// NEXTREG #REG_PERIPHERAL_1,A
				0xED, 0x91,	250, 251,	// NEXTREG FAh,FBh

				0xED, 0x93,		// PIXELDN
				0xED, 0x94,		// PIXELAD

				0xED, 0x95,		// SETAE

				0xED, 0x27,	11,	// TEST #n

				0xED, 0x28,		// BSLA DE,B
				0xED, 0x29,		// BSRA DE,B
				0xED, 0x2A,		// BSRL DE,B
				0xED, 0x2B,		// BSRF DE,B
				0xED, 0x2C,		// BRLC DE,B

				0xED, 0x98,		// JP (C)
			];

			const org = 0x0000;
			dasm.memory.setMemory(org, new Uint8Array(memory));
			dasm.setLabel(org);
			dasm.disassemble();
			const linesUntrimmed = dasm.disassembledLines;

			const lines = trimAllLines(linesUntrimmed);
			//console.log(lines.join('\n'));

			let i = -1;
			assert(lines[++i] == 'ORG 0000h');
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
			assert(lines[++i] == 'ADD HL,1234h');
			assert(lines[++i] == 'ADD DE,2345h');
			assert(lines[++i] == 'ADD BC,3456h');
			assert(lines[++i] == 'SWAPNIB');
			assert(lines[++i] == 'MIRROR');
			assert(lines[++i] == 'PUSH 8811h');
			assert(lines[++i] == 'NEXTREG REG_MACHINE_ID,RMI_ZXNEXT');	// 0, 10
			assert(lines[++i] == 'NEXTREG REG_MACHINE_TYPE,92h (lock timing|Timing');	// 3, 3, 0b10010010
			assert(lines[++i] == 'NEXTREG REG_PERIPHERAL_1,A');		// 5
			assert(lines[++i] == 'NEXTREG FAh,FBh');	// 250, 251
			assert(lines[++i] == 'PIXELDN');
			assert(lines[++i] == 'PIXELAD');
			assert(lines[++i] == 'SETAE');
			assert(lines[++i] == 'TEST 0Bh');	// 11

			assert(lines[++i] == 'BSLA DE,B');
			assert(lines[++i] == 'BSRA DE,B');
			assert(lines[++i] == 'BSRL DE,B');
			assert(lines[++i] == 'BSRF DE,B');
			assert(lines[++i] == 'BRLC DE,B');

			assert(lines[++i] == 'JP (C)');
		});


		test('custom opcode', () => {
			const memory = [
				/*1000*/	0xCF, 0x99,		// RST 08h, CODE=99h
				/*1002*/	0xD7, 0x01, 0x34, 0x12, 0xFF	// RST 10h, a=01h, b=1234h, c=FFh
			];

			const org = 0x1000;
			dasm.setMemory(org, new Uint8Array(memory));
			dasm.setLabel(org);
			Opcodes[0xCF].appendToOpcode(", CODE=#n")
			Opcodes[0xD7].appendToOpcode(", a=#n, b=#nn, c=#n")
			dasm.disassemble();
			const linesUntrimmed = dasm.disassembledLines;

			const lines = trimAllLines(linesUntrimmed);
			//console.log(lines.join('\n'));

			let i = -1;
			assert(lines[++i] == 'ORG 1000h')
			assert(lines[++i] == 'RST 08h, CODE=99h');
			assert(lines[++i] == 'RST 10h, a=01h, b=1234h, c=FFh');
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
			dasm.disassemble();
			const linesUntrimmed = dasm.disassembledLines;

			const lines = trimAllLines(linesUntrimmed);
			//console.log('\n');
			//console.log(lines.join('\n'));

			let i = -1;
			assert(lines[++i] == 'ORG 0000h')
			assert(lines[++i] == 'LD A,FDh');		// 253
			assert(lines[++i] == 'LD HL,FEDCh');	// 65244
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
			dasm.disassemble();
			const lines = dasm.disassembledLines;

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
/*5000*/ 0xc3, 0x03, 0x50,	// 	    jp 0x5003
/*5003*/ 					// STARTA2:
/*5003*/ 0x21, 0x00, 0x60,	// 	    ld hl,0x6000
/*5006*/ 0x22, 0x01, 0x50,	// 	    ld (STARTA1+1),hl
/*5009*/ 0xc9, 				// ret
			];

			const org = 0x5000;
			dasm.memory.setMemory(org, new Uint8Array(memory));
			dasm.setLabel(org);
			dasm.disassemble();
			const linesUntrimmed = dasm.disassembledLines;

			const lines = trimAllLines(linesUntrimmed);

			//dasm.printLabels();

			//assert(linesUntrimmed[5] == 'SELF_MOD1:'); // Depends on priority
			//assert(lines[3] == 'LD (SELF_MOD1+1),HL');
			assert(linesUntrimmed[6] == 'SUB1:');
			assert(lines[3] == 'LD (SUB1+1),HL');
			assert(linesUntrimmed[10].indexOf("WARNING") >= 0);
		});


		test('wrong jp', () => {
			const memory = [
/*5000*/ 					// START:
/*5000*/ 0x21, 0x00, 0x60,	// 	    ld hl,0x6000
/*5003*/ 0xC3, 0x01, 0x50,	//		jp START+1
/*5006*/ //0xC9, 				// 		ret
			];

			const org = 0x5000;
			dasm.memory.setMemory(org, new Uint8Array(memory));
			dasm.setLabel(org);
			dasm.disassemble();
			const linesUntrimmed = dasm.disassembledLines;

			const lines = trimAllLines(linesUntrimmed);

			//dasm.printLabels();

			assert(linesUntrimmed[4] == 'LBL1:');
			assert(lines[2] == 'JP LBL1+1');
			assert(linesUntrimmed[6].indexOf("WARNING") >= 0);
		});


		test('jp (hl)', () => {
			const memory = [
/*5000*/ 					// START:
/*5000*/ 0x21, 0x00, 0x60,	// 	    ld hl,0x6000
/*5003*/ 0xE9,	//		jp (hl)
/*5006*/ //0xC9, 				// 		ret
0xDD, 0xE9,	// jp (ix)
0xFD, 0xE9,	// jp (iy)
0xED, 0xE9,	// jp (c)
			];


			const org = 0x5000;
			dasm.memory.setMemory(org, new Uint8Array(memory));
			dasm.setLabel(org);
			dasm.disassemble();
			const linesUntrimmed = dasm.disassembledLines;

			const lines = trimAllLines(linesUntrimmed);

			//dasm.printLabels();

			/*
			assert(linesUntrimmed[4] == 'LBL1:');
			assert(lines[2] == 'JP LBL1+1');
			assert(linesUntrimmed[6].indexOf("WARNING") >= 0);
			*/
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

			dasm.disassemble();
			const linesUntrimmed = dasm.disassembledLines;

			const lines = trimAllLines(linesUntrimmed);
			//console.log(lines.join('\n'));

			let i = -1;
			assert(lines[++i] == 'ORG 1000h')
			assert(lines[++i] == 'RST 00h')
			assert(lines[++i] == 'ORG 2000h');
			assert(lines[++i] == 'RST 20h')
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
			dasm.disassemble();
			const lines = dasm.disassembledLines;

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
			dasm.disassemble();
			const lines = dasm.disassembledLines;

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
			dasm.disassemble();
			const lines = dasm.disassembledLines;

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
			dasm.disassemble();
			const lines = dasm.disassembledLines;

			//dasm.printLabels();
			//console.log(lines.join('\n'));
			writeFileSync('./out/tests/out.asm', lines.join('\n'));

			// There is no special check, basically just that it does not crash.
			assert(lines.length > 1000);
		});

    });


	suite('disassemble - labels', () => {

		test('findInterruptLabels 1', () => {
			const memory = [
				//8000 SUB:
				/*8000*/ 0x3A, 0x04, 0x80,	//     	ld   a,(nn)
				/*8003*/ 0xC9,           	//		ret
				/*8004*/ 0x06,				//		defb 6
				//8005 Interrupt:
				/*8005*/ 0x80,           	//		add  a,b
				/*8006*/ 0x47,           	//		ld   b,a
				/*8007*/ 0xC9,           	//		ret
			];

			const org = 0x8000;
			dasm.memory.setMemory(org, new Uint8Array(memory));
			dasm.setFixedCodeLabel(org);
			dasm.addressQueue.push(0x8005)
			dasm.labelIntrptPrefix = "INTRPT";
			dasm.disassemble();
			//const linesUntrimmed = dasm.disassembledLines;

			// Check size
			const labels = dasm.labels;
			const labelInt = labels.get(0x8005);
			assert(labelInt);
			assert(labelInt.name.startsWith('INTRPT'));
		});


		test('findInterruptLabels 2', () => {
			const memory1 = [
				//8000 SUB2:
				/*8000*/ 0x3E, 0x040,	//     	ld   a,4
				/*8002*/ 0xC9,           	//		ret
			];
			const memory2 = [
				//9000 SUB2:
				/*9000*/ 0x80,           	//		add  a,b
				/*9001*/ 0xC9,           	//		ret
			];

			const org = 0x8000;
			dasm.memory.setMemory(org, new Uint8Array(memory1));
			dasm.memory.setMemory(0x9000, new Uint8Array(memory2));
			dasm.setFixedCodeLabel(org);
			dasm.addressQueue.push(0x9000)
			dasm.labelIntrptPrefix = "INTRPT";
			dasm.disassemble();
			//const linesUntrimmed = dasm.disassembledLines;

			// Check size
			const labels = dasm.labels;
			const labelInt = labels.get(0x9000);
			assert(labelInt);
			assert(labelInt.name.startsWith('INTRPT'));
		});


		test('findInterruptLabels 3', () => {
			const memory = [
				//8000 SUB:
				/*8000*/ 0x3E, 0x04,		//     	ld   a,4
				/*8002*/ 0xC9,           	//		ret
				//8003 Interrupt:
				/*8003*/ 0x80,           	//		add  a,b
				/*8004*/ 0x47,           	//		ld   b,a
				/*8005*/ 0xC9,           	//		ret
			];

			const org = 0x8000;
			dasm.memory.setMemory(org, new Uint8Array(memory));
			dasm.setFixedCodeLabel(org);
			dasm.addressQueue.push(0x8003)
			dasm.labelIntrptPrefix = "INTRPT";
			dasm.disassemble();
			//const linesUntrimmed = dasm.disassembledLines;

			// Check size
			const labels = dasm.labels;
			const labelInt = labels.get(0x8003);
			assert(labelInt);
			assert(labelInt.name.startsWith('INTRPT'));
		});



		test('addFlowThroughReferences', () => {
			const memory = [
				//8000 SUB1:
				/*8000*/ 0x3E, 0x22,	//   LD   A,34
				/*8002*/ 0x3E, 0x01,	//   LD   A,01

				//8004 SUB2: <- This should become referenced by SUB1
				/*8004*/ 0x3E, 0x21,	//   LD   A,33
				/*8006*/ 0xC9,     		//	 RET

				// This is here to make sure that SUB1/2 labels are created.
				//8007 START:
				/*8007*/ 0xCD, 0x00, 0x80,//	 CALL SUB1
				/*800A*/ 0xCD, 0x04, 0x80,//	 CALL SUB2
				/*800D*/ 0xC9,     		//	 RET
			];

			const org = 0x8000;
			dasm.memory.setMemory(org, new Uint8Array(memory));
			dasm.setFixedCodeLabel(org);
			dasm.setFixedCodeLabel(0x8007, "START");
			dasm.disassemble();
			//const linesUntrimmed = dasm.disassembledLines;
			//const total = linesUntrimmed.join('\n');

			// Check label references
			const labels = dasm.labels;
			const labelSUB1 = labels.get(0x8000);
			assert(labelSUB1.references.size == 1);
			// Turn set into array
			const refs = [...labelSUB1.references];
			assert(refs.indexOf(0x8007) >= 0);

			const labelSUB2 = labels.get(0x8004);
			assert(labelSUB2.references.size == 2);
			// Turn set into array
			const refs2 = [...labelSUB2.references];
			assert(refs2.indexOf(0x8002) >= 0);
			assert(refs2.indexOf(0x800A) >= 0);
		});


		// Same as before but changes order of 'setFixedCodeLabel'
		test('addFlowThroughReferences changed order', () => {
			const memory = [
				//8000 SUB1:
				/*8000*/ 0x3E, 0x22,	//   LD   A,34
				/*8002*/ 0x3E, 0x01,	//   LD   A,01


				//8004 SUB2: <- This should become referenced by SUB1
				/*8004*/ 0x3E, 0x21,	//   LD   A,33
				/*8006*/ 0xC9,     		//	 RET

				// This is here to make sure that SUB1/2 labels are created.
				//8007 START:
				/*8007*/ 0xCD, 0x00, 0x80,//	 CALL SUB1
				/*800A*/ 0xCD, 0x04, 0x80,//	 CALL SUB2
				/*800D*/ 0xC9,     		//	 RET
			];

			const org = 0x8000;
			dasm.memory.setMemory(org, new Uint8Array(memory));
			dasm.setFixedCodeLabel(0x8007, "START");
			dasm.setFixedCodeLabel(org);
			dasm.disassemble();
			//const linesUntrimmed = dasm.disassembledLines;

			// Check label references
			const labels = dasm.labels;
			const labelSUB1 = labels.get(0x8000);
			assert(labelSUB1.references.size == 1);
			// Turn set into array
			const refs = [...labelSUB1.references];
			assert(refs.indexOf(0x8007) >= 0);

			const labelSUB2 = labels.get(0x8004);
			assert(labelSUB2.references.size == 2);
			// Turn set into array
			const refs2 = [...labelSUB2.references];
			assert(refs2.indexOf(0x8002) >= 0);
			assert(refs2.indexOf(0x800A) >= 0);
		});



		// Same as before but changes order o CALLs'
		test('addFlowThroughReferences changed order 2', () => {
			const memory = [
				// This is here to make sure that SUB1/2 labels are created.
				//7FF9 START:
				/*7FF9*/ 0xCD, 0x00, 0x80,//	 CALL SUB1
				/*7FFC*/ 0xCD, 0x04, 0x80,//	 CALL SUB2
				/*7FFF*/ 0xC9,     			//	 RET

				//8000 SUB1:
				/*8000*/ 0x3E, 0x22,	//   LD   A,34
				/*8002*/ 0x3E, 0x01,	//   LD   A,01


				//8004 SUB2: <- This should become referenced by SUB1
				/*8004*/ 0x3E, 0x21,	//   LD   A,33
				/*8006*/ 0xC9,     		//	 RET

			];

			const org = 0x7FF9;
			dasm.memory.setMemory(org, new Uint8Array(memory));
			dasm.setFixedCodeLabel(0x7FF9, "START");
			dasm.disassemble();
			//const linesUntrimmed = dasm.disassembledLines;

			// Check label references
			const labels = dasm.labels;
			const labelSUB1 = labels.get(0x8000);
			assert(labelSUB1.references.size == 1);
			// Turn set into array
			const refs = [...labelSUB1.references];
			assert(refs.indexOf(0x7FF9) >= 0);

			const labelSUB2 = labels.get(0x8004);
			assert(labelSUB2.references.size == 2);
			// Turn set into array
			const refs2 = [...labelSUB2.references];
			assert(refs2.indexOf(0x8002) >= 0);
			assert(refs2.indexOf(0x7FFC) >= 0);
		});


		test('turnLBLintoSUB', () => {
			const memory = [
				// This is here to make sure that SUB1/2 labels are created.
				//8000 START:
				/*8000*/ 0xC2, 0x09, 0x80,	//	 JP NZ,LBL1
				/*8003*/ 0xCD, 0x0E, 0x80,	//   CALL SUB2
				/*8006*/ 0xC3, 0x00, 0x80,	//	 JP START

				//8009 LBL1/SUB1:	This is initially a LBL that is turned into a SUB
				/*8009*/ 0x3E, 0x22,	//   LD   A,34
				/*800B*/ 0x3E, 0x01,	//   LD   A,01
				/*800D*/ 0xC9,     		//	 RET

				//800E SUB2:
				/*800E*/ 0xC2, 0x09, 0x80,	// JP NZ,LBL1
				/*800F*/ 0xC9,     		//	 RET

			];
			// Note: 8009 is turned from a LBL into a SUB although no CALL reaches
			// it. It is changed because it ends with a RET.

			const org = 0x8000;
			dasm.memory.setMemory(org, new Uint8Array(memory));
			dasm.setFixedCodeLabel(org, "START");
			dasm.disassemble();
			//const linesUntrimmed = dasm.disassembledLines;

			// Check label type
			const labels = dasm.labels;
			const labelSUB1 = labels.get(0x8009);
			assert(labelSUB1.type == NumberType.CODE_SUB);
		});


		test('findLocalLabelsInSubroutines', () => {
			const memory = [
				//8000 SUB1:
				/*8000*/ 0x3E, 0x22,		//   LD   A,34
				/*8002*/ 0xC2, 0x06, 0x80,	//   JP NZ,LBL1
				/*8005*/ 0xC9,     			//	 RET
				//8006 LBL1:	<- should be turned in a local label
				/*8000*/ 0x3E, 0x23,		//   LD   A,35
				//8008 LBL2:		<- should be turned in a local loop label
				/*8008*/ 0x3E, 0x24,		//   LD   A,36
				/*800A*/ 0x3E, 0x24,		//   LD   A,36
				/*800C*/ 0xC2, 0x08, 0x80,	//   JP NZ,LBL2
				/*800F*/ 0xC9,     			//	 RET
			];

			const org = 0x8000;
			dasm.memory.setMemory(org, new Uint8Array(memory));
			dasm.setFixedCodeLabel(org);
			dasm.disassemble();
			//const linesUntrimmed = dasm.disassembledLines;

			// Check label types
			const labels = dasm.labels;
			const labelLBL1 = labels.get(0x8006);
			assert(labelLBL1.type == NumberType.CODE_LOCAL_LBL);

			const labelLBL2 = labels.get(0x8008);
			assert(labelLBL2.type == NumberType.CODE_LOCAL_LOOP);
		});


		test('addParentReferences', () => {
			const memory = [
				//8000 SUB1:
				/*8000*/ 0x3E, 0x22,		//   LD   A,34
				/*8002*/ 0xCD, 0x09, 0x80,	//   CALL SUB2
				/*8005*/ 0xCD, 0x09, 0x80,	//   CALL SUB2
				/*8008*/ 0xC9,     			//	 RET
				//8009 SUB2:	<- should be turned in a local label
				/*8009*/ 0x3E, 0x23,		//   LD   A,35
				/*800B*/ 0xC9,     			//	 RET
			];

			const org = 0x8000;
			dasm.memory.setMemory(org, new Uint8Array(memory));
			dasm.setFixedCodeLabel(org);
			dasm.disassemble();
			//const linesUntrimmed = dasm.disassembledLines;

			// Check label types
			const labels = dasm.labels;
			const labelSUB1 = labels.get(0x8000);
			const labelSUB2 = labels.get(0x8009);
			assert(labelSUB2.references.size == 2);

			// Turn set into array
			const refs2 = [...labelSUB2.references];
			let k = refs2.indexOf(0x8002);
			assert(k >= 0);	// Reference exists
			const addrParents = dasm.addressParents;
			let addr = refs2[k];
			let parent = addrParents[addr]
			assert(parent == labelSUB1);	// and has right parent
			k = refs2.indexOf(0x8005);
			assert(k >= 0);	// Reference exists
			addr = refs2[k];
			parent = addrParents[addr]
			assert(parent == labelSUB1);	// and has right parent

			// SUB1 has no ref
			const refs1 = [...labelSUB1.references];
			assert(refs1.length == 0);
		});


		test("addParentReferences - remove self references: don't remove call", () => {
			const memory = [
				//8000 SUB1:
				/*8000*/ 0x3E, 0x22,		//   LD   A,34
				/*8002*/ 0xCD, 0x00, 0x80,	//   CALL SUB1
				/*8005*/ 0xC9,     			//	 RET
			];

			const org = 0x8000;
			dasm.memory.setMemory(org, new Uint8Array(memory));
			dasm.setFixedCodeLabel(org);
			dasm.disassemble();
			//const linesUntrimmed = dasm.disassembledLines;

			// Check label types
			const labels = dasm.labels;
			const labelSUB1 = labels.get(0x8000);
			assert(labelSUB1.references.size == 1);
		});

		test('addParentReferences - remove self references: remove jump', () => {
			const memory = [
				//8000 SUB1:
				/*8000*/ 0x3E, 0x22,		//   LD   A,34
				/*8002*/ 0x10, 256-4,		//   DJNZ SUB1
				/*8005*/ 0xC9,     			//	 RET
			];

			const org = 0x8000;
			dasm.memory.setMemory(org, new Uint8Array(memory));
			dasm.setFixedCodeLabel(org);
			dasm.disassemble();
			//const linesUntrimmed = dasm.disassembledLines;

			// Check label types
			const labels = dasm.labels;
			assert(labels.size == 1);
			const labelSUB1 = labels.get(0x8000);
			assert(labelSUB1.references.size == 0);
		});

	});


	suite('statistics', () => {

		test('size', () => {
			const memory = [
				//7216 SUB006:
				/*7216*/ 0x01, 0x11, 0x02,	//     ld   bc,529 ; 0211h
				/*7219*/ 0x3A, 0x13, 0x70,	//     ld   a,(DATA131) ; 7013h
				/*721C*/ 0xFE, 0x12,      	//	   cp   18     ; 12h
				/*721E*/ 0x38, 0x03,        //		jr   c,.sub006_l ; 7223h
				/*7220*/ 0x0C,           	//		inc  c
				/*7221*/ 0xD6, 0x12,        //		sub  a,18   ; 12h
				/*7223 .sub006_l:
				/*7223*/ 0x80,           	//		add  a,b
				/*7224*/ 0x47,           	//		ld   b,a
				/*7225*/ 0xCD, 0x28, 0x7C,	//     call SUB081 ; 7C28h
				/*7228*/ 0x3E, 0x8F,		//     ld   a,143  ; 8Fh, -113
				/*722A*/ 0xC9,
			];

			const org = 0x7216;
			dasm.memory.setMemory(org, new Uint8Array(memory));
			dasm.setFixedCodeLabel(org);
			dasm.disassemble();
			//const linesUntrimmed = dasm.disassembledLines;

			// Check size
			const labels = dasm.labels;
			const statistics = dasm.subroutineStatistics;
			const labelSub = labels.get(org);
			const stats = statistics.get(labelSub);
			assert(stats.sizeInBytes == 21);
			assert(stats.countOfInstructions == 11);
		});


		test('cyclomatic complexity', () => {
			const memory = [
				//7216 SUB006: (29206)		// CC: 1
				/*7216*/ 0x01, 0x11, 0x02,	//     ld   bc,529 ; 0211h
				/*7219*/ 0x3A, 0x13, 0x70,	//     ld   a,(DATA131) ; 7013h
				/*721C*/ 0xFE, 0x12,      	// +1	   cp   18     ; 12h
				/*721E*/ 0x38, 0x03,        //		jr   c,.sub006_l ; 7223h
				/*7220*/ 0xC4, 0x28, 0x7C,  // +1	call nz,SUB081 ; 7C28h
				/*7223 .sub006_l:
				/*7223*/ 0x80,           	//		add  a,b
				/*7224*/ 0xC0,           	// +1		ret nz
				/*7225*/ 0xCD, 0x28, 0x7C,	//     call SUB081 ; 7C28h
				/*7228*/ 0x3E, 0x8F,		//     ld   a,143  ; 8Fh, -113
				/*722A*/ 0xC9,		// CC-> 4
			];

			const org = 0x7216;
			dasm.memory.setMemory(org, new Uint8Array(memory));
			dasm.setFixedCodeLabel(org);
			dasm.disassemble();
			//const linesUntrimmed = dasm.disassembledLines;

			// Check size
			const labels = dasm.labels;
			const statistics = dasm.subroutineStatistics;
			const labelSub = labels.get(org);
			const stats = statistics.get(labelSub);
			assert(stats.CyclomaticComplexity == 4);
		});

	});

});
