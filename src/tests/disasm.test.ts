import * as assert from 'assert';
import { Disassembler } from '../disasm';
import { LabelType } from '../label';
//import { Warning } from '../warning';



suite('Disassembler', () => {

	setup( () => {
		//Settings.Init(<any>undefined, '');
	});

/*
	teardown( () => dc.stop() );
*/

	suite('General', () => {
		test('Constructor', () => {
			new Disassembler();
		});
	});

	suite('error conditions', () => {

		test('Warning: trying to disassemble unassigned area', () => {
			let dasm = new Disassembler() as any; 	// 'as any' allows access to protected methods
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
			let dasm = new Disassembler() as any; 	// 'as any' allows access to protected methods

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
			let dasm = new Disassembler() as any; 	// 'as any' allows access to protected methods

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
			let dasm = new Disassembler() as any; 	// 'as any' allows access to protected methods

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
			let dasm = new Disassembler() as any; 	// 'as any' allows access to protected methods

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
			let dasm = new Disassembler() as any; 	// 'as any' allows access to protected methods

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
			assert(label.type == LabelType.CODE_LBL);
			assert(label.isEqu == false);

			label = dasm.labels.get(0x4002);
			assert(label != undefined);
			assert(label.type == LabelType.CODE_LBL);
			assert(label.isEqu == false);

			label = dasm.labels.get(0x4007);
			assert(label != undefined);
			assert(label.type == LabelType.CODE_RELATIVE_LOOP);
			assert(label.isEqu == false);

			label = dasm.labels.get(0x400a);
			assert(label != undefined);
			assert(label.type == LabelType.DATA_LBL);
			assert(label.isEqu == false);

			label = dasm.labels.get(0x4018);
			assert(label != undefined);
			assert(label.type == LabelType.CODE_RELATIVE_LBL);
			assert(label.isEqu == false);

			label = dasm.labels.get(0x401a);
			assert(label != undefined);
			assert(label.type == LabelType.CODE_SUB);
			assert(label.isEqu == false);

			label = dasm.labels.get(0x4036);
			assert(label != undefined);
			assert(label.type == LabelType.DATA_LBL);
			assert(label.isEqu == false);

			label = dasm.labels.get(0x5000);
			assert(label != undefined);
			assert(label.type == LabelType.DATA_LBL);
			assert(label.isEqu == true);

			label = dasm.labels.get(0x5100);
			assert(label != undefined);
			assert(label.type == LabelType.CODE_LBL);
			assert(label.isEqu == true);
		});

		test('self-modifying code', () => {
			// Note: Regex to exchange list-output with bytes:
			// find-pattern: ^([0-9a-f]+)\s+([0-9a-f]+)?\s+([0-9a-f]+)?\s+([0-9a-f]+)?\s?(.*)
			// subst-pattern: /*$1*/ 0x$2, 0x$3, 0x$4,\t// $5
			let dasm = new Disassembler() as any; 	// 'as any' allows access to protected methods

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
			assert(label.type == LabelType.CODE_LBL);
			assert(label.isEqu == true);

			label = dasm.labels.get(org);
			assert(label != undefined);
			assert(label.type == LabelType.CODE_LBL);
			assert(label.isEqu == false);

			label = dasm.labels.get(org+3);
			assert(label != undefined);
			assert(label.type == LabelType.CODE_LBL);
			assert(label.isEqu == false);

			// self.modifying label
			label = dasm.labels.get(org+1);
			assert(label != undefined);
			assert(label.type == LabelType.DATA_LBL);
			assert(label.isEqu == false);
		});

    });




	suite('countTypesOfLabels', () => {

		test('label types', () => {
			let dasm = new Disassembler() as any; 	// 'as any' allows access to protected methods

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
			let dasm = new Disassembler() as any; 	// 'as any' allows access to protected methods

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
			let dasm = new Disassembler() as any; 	// 'as any' allows access to protected methods

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
			let dasm = new Disassembler() as any; 	// 'as any' allows access to protected methods

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
			//dasm.labelDataLblPrefix = "CDATA";

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

		test('simple', () => {
			let dasm = new Disassembler() as any; 	// 'as any' allows access to protected methods

			const memory = [
/*8000*/ 0x3e, 0xfd,		// ld a,0xfd (-3)
/*8002*/ 0x21, 0xdc, 0xfe,	// ld hl,0xfedc
/*8005*/ 0xc9,	// ret
			];

			dasm.labelSubPrefix = "SUB";
			dasm.labelLblPrefix = "LBL";
			dasm.labelDataLblPrefix = "DATA";
			dasm.labelLocalLablePrefix = "_lbl";
			dasm.labelLoopPrefix = "_loop";

			const org = 0x0000;
			dasm.memory.setMemory(org, new Uint8Array(memory));
			dasm.setLabel(org);
			const lines = dasm.disassemble();

			//dasm.printLabels();
			//console.log('\n');
			//console.log(lines.join('\n'));

			assert(lines.length == 5);

			assert(lines[0] == '; Label is referenced by 0 location.')
			assert(lines[1] == '0000	LBL1:');
			assert(lines[2] == '0000		ld	a,-3	; FDh');
			assert(lines[3] == '0002		ld	hl,65244	; FEDCh, -292');
			assert(lines[4] == '0005		ret	');

		});


		test('more complex', () => {
			let dasm = new Disassembler() as any; 	// 'as any' allows access to protected methods

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
			console.log('\n');
			console.log(lines.join('\n'));

			assert(lines.length > 10);	// It's hard to find a good assert here.
		});
    });



	suite('complete binaries', () => {

		test('currah', () => {
			let dasm = new Disassembler() as any; 	// 'as any' allows access to protected methods

			// configure
			dasm.labelSubPrefix = "SUB";
			dasm.labelLblPrefix = "LBL";
			dasm.labelDataLblPrefix = "DATA";
			dasm.labelLocalLablePrefix = "_lbl";
			dasm.labelLoopPrefix = "_loop";

			const org = 0x8000;
			dasm.memory.readBinFile(org, './src/tests/data/currah.bin');
			dasm.setLabel(org);

			// Set the 3 call tables
			dasm.setCallTable(0x80E5, 10);
			dasm.setCallTable(0x80FD, 10);
			dasm.setCallTable(0x8115, 10);

			// Disassemble
			const lines = dasm.disassemble();

			//dasm.printLabels();
			console.log('\n');
			console.log(lines.join('\n'));

			assert(lines.length == 5);

			assert(lines[0] == '; Label is referenced by 0 location.')
			assert(lines[1] == '0000	LBL1:');
			assert(lines[2] == '0000		ld	a,-3	; FDh');
			assert(lines[3] == '0002		ld	hl,65244	; FEDCh, -292');
			assert(lines[4] == '0005		ret	');

		});


		test('more complex', () => {
			let dasm = new Disassembler() as any; 	// 'as any' allows access to protected methods

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
			console.log('\n');
			console.log(lines.join('\n'));

			assert(lines.length > 10);	// It's hard to find a good assert here.
		});
    });

});
