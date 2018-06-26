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

});
