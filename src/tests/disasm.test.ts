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
            var dasm = new Disassembler();
            assert.equal( dasm.disassemble(), "Hello");
		});

    });

});
