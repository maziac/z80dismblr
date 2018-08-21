import * as assert from 'assert';
import { Regs, REGISTER } from '../disassembler/regs';


suite('Regs', () => {

	setup( () => {
		//Settings.Init(<any>undefined, '');
	});

/*
	teardown( () => dc.stop() );
*/

	test('Constructor', () => {
		const regs = new Regs();
		for(let r=0; r<REGISTER.REGS_MAX; r++) {
			assert(!regs.isUsed(r));
		}

	});

	test('isUsed', () => {
		const regs = new Regs();
		// Unused at the start
		const r = REGISTER.A;
		assert(!regs.isUsed(r));
		// Use it
		regs.use(r);
		assert(regs.isUsed(r));
	});

	test('exxAF', () => {
		const regs = new Regs() as any;
		// exchange
		regs.exxAF();
		// check
		assert(regs.regs[REGISTER.A] == REGISTER.A2);
		assert(regs.regs[REGISTER.F] == REGISTER.F2);
		assert(regs.regs[REGISTER.A2] == REGISTER.A);
		assert(regs.regs[REGISTER.F2] == REGISTER.F);
	});

	test('exx', () => {
		const regs = new Regs() as any;
		// exchange
		regs.exx();
		// check
		assert(regs.regs[REGISTER.B] == REGISTER.B2);
		assert(regs.regs[REGISTER.C] == REGISTER.C2);
		assert(regs.regs[REGISTER.D] == REGISTER.D2);
		assert(regs.regs[REGISTER.E] == REGISTER.E2);
		assert(regs.regs[REGISTER.H] == REGISTER.H2);
		assert(regs.regs[REGISTER.L] == REGISTER.L2);

		assert(regs.regs[REGISTER.B2] == REGISTER.B);
		assert(regs.regs[REGISTER.C2] == REGISTER.C);
		assert(regs.regs[REGISTER.D2] == REGISTER.D);
		assert(regs.regs[REGISTER.E2] == REGISTER.E);
		assert(regs.regs[REGISTER.H2] == REGISTER.H);
		assert(regs.regs[REGISTER.L2] == REGISTER.L);
	});

	test('getRegName', () => {
		const regs = new Regs();
		// test
		assert(regs.getRegName(REGISTER.A) == "A");
		assert(regs.getRegName(REGISTER.F) == "F");
		assert(regs.getRegName(REGISTER.B) == "B");
		assert(regs.getRegName(REGISTER.C) == "C");
		assert(regs.getRegName(REGISTER.D) == "D");
		assert(regs.getRegName(REGISTER.E) == "E");
		assert(regs.getRegName(REGISTER.H) == "H");
		assert(regs.getRegName(REGISTER.L) == "L");

		assert(regs.getRegName(REGISTER.A2) == "A'");
		assert(regs.getRegName(REGISTER.F2) == "F'");
		assert(regs.getRegName(REGISTER.B2) == "B'");
		assert(regs.getRegName(REGISTER.C2) == "C'");
		assert(regs.getRegName(REGISTER.D2) == "D'");
		assert(regs.getRegName(REGISTER.E2) == "E'");
		assert(regs.getRegName(REGISTER.H2) == "H'");
		assert(regs.getRegName(REGISTER.L2) == "L'");

		assert(regs.getRegName(REGISTER.IXL) == "IXL");
		assert(regs.getRegName(REGISTER.IXH) == "IXH");
		assert(regs.getRegName(REGISTER.IYL) == "IYL");
		assert(regs.getRegName(REGISTER.IYH) == "IYH");
	});

	test('getIndexForRegName', () => {
		const regs = new Regs();
		// test
		assert(regs.getIndexForRegName("A") == REGISTER.A);
		assert(regs.getIndexForRegName("B") == REGISTER.B);
		assert(regs.getIndexForRegName("C") == REGISTER.C);
		assert(regs.getIndexForRegName("D") == REGISTER.D);
		assert(regs.getIndexForRegName("E") == REGISTER.E);
		assert(regs.getIndexForRegName("H") == REGISTER.H);
		assert(regs.getIndexForRegName("L") == REGISTER.L);
		assert(regs.getIndexForRegName("IXL") == REGISTER.IXL);
		assert(regs.getIndexForRegName("IXH") == REGISTER.IXH);
		assert(regs.getIndexForRegName("IYL") == REGISTER.IYL);
		assert(regs.getIndexForRegName("IYH") == REGISTER.IYH);
	});

	test('usedRegs', () => {
		const regs = new Regs();

		// no used regs after initialization
		assert(regs.usedRegs().size == 0);

		// Use a few regs
		regs.use(REGISTER.A);
		regs.use(REGISTER.F2);
		regs.use(REGISTER.IYL);

		// Test
		const used = regs.usedRegs();
		assert(used.size == 3);
		assert(used.has(REGISTER.A));
		assert(used.has(REGISTER.F2));
		assert(used.has(REGISTER.IYL));
		assert(!used.has(REGISTER.B));
	});

	test('clone', () => {
		const regs = new Regs() as any;

		// Use it
		regs.use(REGISTER.E);

		regs.usedAddresses.push(0);
		regs.usedAddresses.push(6);

		regs.inputRegs.add(REGISTER.L);
		regs.inputRegs.add(REGISTER.IYH);

		regs.stack.push(REGISTER.F);
		regs.stack.push(REGISTER.D2);

		// Clone it
		const cloned = regs.clone();

		// test regs
		for(let r=0; r<REGISTER.REGS_MAX; r++) {
			assert(cloned.regs[r] == regs.regs[r]);
		}

		// used addresses
		assert(cloned.usedAddresses.length == regs.usedAddresses.length);
		for(let i=0; i<regs.usedAddresses.length; i++) {
			assert(cloned.usedAddresses[i] == regs.usedAddresses[i]);
		}

		// input regs
		assert(cloned.inputRegs.size == regs.inputRegs.size);
		for(const ir of regs.inputRegs) {
			assert(cloned.inputRegs.has(ir));
		}

		// stack
		assert(cloned.stack.length == regs.stack.length);
		for(let i=0; i<regs.stack.length; i++) {
			assert(cloned.stack[i] == regs.stack[i]);
		}
	});

	test('merge', () => {
		const regs = new Regs();
		const other = regs.clone();

		// Use them
		regs.use(REGISTER.E);
		regs.use(REGISTER.L);
		regs.use(REGISTER.D);
		regs.use(REGISTER.L);

		// Merge
		regs.merge(other);

		// test regs
		const used = regs.usedRegs();
		assert(used.size == 3);
		assert(used.has(REGISTER.E));
		assert(used.has(REGISTER.D));
		assert(used.has(REGISTER.L));
	});

	test('mergeRegs', () => {
		const regs = new Regs();
		const usedRegs = new Set<REGISTER>();
		const inpRegs = new Set<REGISTER>();

		// Prefill regs
		regs.use(REGISTER.B);
		regs.inputRegs.add(REGISTER.C);

		// Fill registers
		usedRegs.add(REGISTER.D);
		usedRegs.add(REGISTER.E);
		usedRegs.add(REGISTER.L);
		inpRegs.add(REGISTER.F2);
		inpRegs.add(REGISTER.IYL);

		// Merge
		regs.mergeRegs(usedRegs, inpRegs);

		// test regs
		const used = regs.usedRegs();
		assert(used.size == 4);
		assert(used.has(REGISTER.B));
		assert(used.has(REGISTER.E));
		assert(used.has(REGISTER.D));
		assert(used.has(REGISTER.L));

		assert(regs.inputRegs.size == 3);
		assert(regs.inputRegs.has(REGISTER.C));
		assert(regs.inputRegs.has(REGISTER.F2));
		assert(regs.inputRegs.has(REGISTER.IYL));
	});

});
