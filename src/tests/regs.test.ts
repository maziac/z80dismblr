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

	test('copyRegXtoY', () => {
		const regs = new Regs() as any;

		// Set destination and src
		const src = new Set([REGISTER.D, REGISTER.E]);
		const dst = new Set([REGISTER.H, REGISTER.L]);

		// Copy
		regs.copyRegXtoY(src, dst);

		// Test
		assert(regs.regs[REGISTER.H] == REGISTER.D);
		assert(regs.regs[REGISTER.L] == REGISTER.E);
		assert(regs.regs[REGISTER.D] == REGISTER.D);
		assert(regs.regs[REGISTER.E] == REGISTER.E);

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
		// test
		assert(Regs.getRegName(REGISTER.A) == "A");
		assert(Regs.getRegName(REGISTER.F) == "F");
		assert(Regs.getRegName(REGISTER.B) == "B");
		assert(Regs.getRegName(REGISTER.C) == "C");
		assert(Regs.getRegName(REGISTER.D) == "D");
		assert(Regs.getRegName(REGISTER.E) == "E");
		assert(Regs.getRegName(REGISTER.H) == "H");
		assert(Regs.getRegName(REGISTER.L) == "L");

		assert(Regs.getRegName(REGISTER.A2) == "A'");
		assert(Regs.getRegName(REGISTER.F2) == "F'");
		assert(Regs.getRegName(REGISTER.B2) == "B'");
		assert(Regs.getRegName(REGISTER.C2) == "C'");
		assert(Regs.getRegName(REGISTER.D2) == "D'");
		assert(Regs.getRegName(REGISTER.E2) == "E'");
		assert(Regs.getRegName(REGISTER.H2) == "H'");
		assert(Regs.getRegName(REGISTER.L2) == "L'");

		assert(Regs.getRegName(REGISTER.IXL) == "IXL");
		assert(Regs.getRegName(REGISTER.IXH) == "IXH");
		assert(Regs.getRegName(REGISTER.IYL) == "IYL");
		assert(Regs.getRegName(REGISTER.IYH) == "IYH");
	});

	test('getIndexForRegName', () => {
		// test
		assert(Regs.getIndexForRegName("A") == REGISTER.A);
		assert(Regs.getIndexForRegName("B") == REGISTER.B);
		assert(Regs.getIndexForRegName("C") == REGISTER.C);
		assert(Regs.getIndexForRegName("D") == REGISTER.D);
		assert(Regs.getIndexForRegName("E") == REGISTER.E);
		assert(Regs.getIndexForRegName("H") == REGISTER.H);
		assert(Regs.getIndexForRegName("L") == REGISTER.L);
		assert(Regs.getIndexForRegName("IXL") == REGISTER.IXL);
		assert(Regs.getIndexForRegName("IXH") == REGISTER.IXH);
		assert(Regs.getIndexForRegName("IYL") == REGISTER.IYL);
		assert(Regs.getIndexForRegName("IYH") == REGISTER.IYH);
	});

	test('getRegistersInString', () => {
		// test
		let r = Regs.getRegistersInString("");
		assert(r.size == 0);

		r = Regs.getRegistersInString("A");
		assert(r.size == 1);
		assert(r.has(REGISTER.A));

		r = Regs.getRegistersInString("ABCDE");
		assert(r.size == 5);
		assert(r.has(REGISTER.A));
		assert(r.has(REGISTER.B));
		assert(r.has(REGISTER.C));
		assert(r.has(REGISTER.D));
		assert(r.has(REGISTER.E));

		r = Regs.getRegistersInString("IXL");
		assert(r.size == 1);
		assert(r.has(REGISTER.IXL));

		r = Regs.getRegistersInString("IXH");
		assert(r.size == 1);
		assert(r.has(REGISTER.IXH));

		r = Regs.getRegistersInString("IYL");
		assert(r.size == 1);
		assert(r.has(REGISTER.IYL));

		r = Regs.getRegistersInString("IYH");
		assert(r.size == 1);
		assert(r.has(REGISTER.IYH));

		r = Regs.getRegistersInString("IX");
		assert(r.size == 2);
		assert(r.has(REGISTER.IXL));
		assert(r.has(REGISTER.IXH));

		r = Regs.getRegistersInString("IY");
		assert(r.size == 2);
		assert(r.has(REGISTER.IYL));
		assert(r.has(REGISTER.IYH));

		r = Regs.getRegistersInString("#nn");
		assert(r.size == 0);

		r = Regs.getRegistersInString("%s");
		assert(r.size == 0);

		// Not a real use case, just to test the algorithm
		r = Regs.getRegistersInString("IYLIX");
		assert(r.size == 3);
		assert(r.has(REGISTER.IYL));
		assert(r.has(REGISTER.IXL));
		assert(r.has(REGISTER.IXH));

		// Not a real use case, just to test the algorithm
		r = Regs.getRegistersInString("HLIXBCIYH");
		assert(r.size == 7);
		assert(r.has(REGISTER.H));
		assert(r.has(REGISTER.L));
		assert(r.has(REGISTER.IXL));
		assert(r.has(REGISTER.IXH));
		assert(r.has(REGISTER.B));
		assert(r.has(REGISTER.C));
		assert(r.has(REGISTER.IYH));
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
