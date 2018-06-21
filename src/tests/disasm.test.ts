import assert = require('assert');
//import { Utility } from '../utility';
import { Disassembler } from '../disasm';



suite('Disassembler', () => {

	setup( () => {
		//Settings.Init(<any>undefined, '');
	});

/*
	teardown( () => dc.stop() );
*/

	suite('Test 1', () => {

		test('Test A', () => {
            let dasm = new Disassembler();
		});

		test('Test B', () => {
			let dasm = new Disassembler();

			const memory = new Uint8Array([
				0,
				1, 0x34, 0x12,
				2,
				3,
				4,
				5, 128
			]);

			dasm.setMemory(memory);
			let lines = dasm.disassemble();

		});

    });

});
