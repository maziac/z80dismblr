import * as assert from 'assert';
import { Disassembler } from '../disasm';
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

    });

});
