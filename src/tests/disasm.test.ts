//import assert = require('assert');
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
            new Disassembler();
		});

		test('Test B', () => {
			let dasm = new Disassembler();

			const memory = [
				0,
				1, 0x34, 0x12,
				2,
				3,
				4,
				5, 128
			];

			dasm.memory.setMemory(0, new Uint8Array(memory));
			let lines = dasm.disassemble();

		});

    });

});
