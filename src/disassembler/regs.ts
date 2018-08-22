import * as assert from 'assert';


/// Enumeration of the Z80 registers.
export enum REGISTER {
	A = 0,
	F, B, C, D, E, H, L,
	A2,
	F2, B2, C2, D2, E2, H2, L2,
	IXL, IXH, IYL, IYH,
	REGS_MAX	// count of registers
};

/**
 * The Regs class is used to represent the status of the registers.
 * Mainly: used/unused.
 * A Regs instance can be merged with another. This class
 * offers the required functionality.
 */
export class Regs {
	/// The register representation.
	public regs = new Array<REGISTER>(REGISTER.REGS_MAX);

	/// The associated names of the registers.
	protected static names = [
		'A', 'F', 'B', 'C', 'D', 'E', 'H', 'L',
		"A'", "F'", "B'", "C'", "D'", "E'", "H'", "L'",
		'IXL', 'IXH', 'IYL', 'IYH'
	];

	/// Holds all opcode addresses used so far (in the subroutine).
	public usedAddresses: Array<number> = [];

	/// Collects the input registers found so far.
	public inputRegs = new Set<REGISTER>();

	/// The stack (push, call).
	public stack: Array<number> = []; // TODO: type unclear


	/**
	 * Initialize registers to "unused".
	 */
	constructor() {
		// Assign register to themselves (unused).
		for(let r=0; r<REGISTER.REGS_MAX; r++) {
			this.regs[r] = r;
		}
		assert(Regs.names.length == REGISTER.REGS_MAX);
	}


	/**
	 * Test if register has been used.
	 * @param r The register to test.
	 * @returns true if the register is used.
	 */
	public isUsed(r: REGISTER): boolean {
		return (this.regs[r] != r);
	}

	/**
	 * Mark the register as being used.
	 * @param r The register to use. (gets -1).
	 */
	public use(r: REGISTER) {
		this.regs[r] = -1;
	}


	/**
	 * Copies values from register set from src to destination.
	 * It is assumed that for a copy the sets/array are in the same order.
	 * @param srcSet The register indices whose values should be copied
	 * @param dstSet The destination registers.
	 */
	public copyRegXtoY(srcSet: Set<REGISTER>, dstSet:Set<REGISTER>) {
		// It is assumed that for a copy the sets/array are in the same order.
		const src = Array.from(srcSet);
		const dst = Array.from(dstSet);
		const len = src.length;
		assert(len == dst.length);
		for(let k=0; k<len; k++) {
			const rx = src[k];
			const ry = dst[k];
			this.regs[ry] = this.regs[rx];
		}
	}


	/**
	 * Exchanges AF and A2F2.
	 */
	public exxAF() {
		const a = this.regs[REGISTER.A];
		const f = this.regs[REGISTER.F];
		this.regs[REGISTER.A]= this.regs[REGISTER.A2];
		this.regs[REGISTER.F]= this.regs[REGISTER.F2];
		this.regs[REGISTER.A2]= a;
		this.regs[REGISTER.F2]= f;
	}

    /**
	 * Exchanges: BC with B2C2, DE with D2E2 and HL with H2L2.
	 */
    public exx() {
		const diff = REGISTER.B2 - REGISTER.B;
		for(let r=REGISTER.B; r<=REGISTER.L; r++) {
			const tmp = this.regs[r];
			this.regs[r] = this.regs[r+diff];
			this.regs[r+diff] = tmp;
		}
	}

	// TODO: EX DE,HL, EX (SP),HL etc.

	/**
	 * Returns the name of the register.
	 * @param r The register as number, e.g. H2
	 * @return the register as name, e.g. "H'"
	 */
	public static getRegName(r: REGISTER): string {
		return Regs.names[r];
	}

	/**
	 * Returns the index of the register name.
	 * @param name The register as name, e.g. "H"
	 * @return the register as number, e.g. H. Returns -1 if name is not found.
	 */
	public static getIndexForRegName(name: string): REGISTER {
		const r = Regs.names.indexOf(name);
		return r;
	}


	/**
	 * Returns all found registers in the given string.
	 * Unmatched characters are simply ignored.
	 * Used to convert mnemonics into registers.
	 * E.g. a "DE" is converted into [REGISTER.D, REGISTER.E],
	 * a "#nn" is converted to [].
	 * @param text The stringto convert e.g. "DE", "A" or "IXL"
	 */
	public static getRegistersInString(text: string): Set<REGISTER> {
		const arr = new Set<REGISTER>();
		const len = text.length;
		for(let k=0; k<len; k++) {
			// First check for IXL etc
			const s3 = text.substr(k, 3);
			const r3 = this.getIndexForRegName(s3);
			if(r3 >= 0) {
				arr.add(r3);
				k += 2;
				continue;
			}

			// Now check for IX and IY (high and low byte)
			const s2 = text.substr(k, 2);
			if(s2 == "IX") {
				arr.add(REGISTER.IXL);
				arr.add(REGISTER.IXH);
				k ++;
				continue;
			}
			if(s2 == "IY") {
				arr.add(REGISTER.IYL);
				arr.add(REGISTER.IYH);
				k ++;
				continue;
			}

			// Now one letter registers like "A"
			const s1 = text.substr(k, 1);
			const r1 = this.getIndexForRegName(s1);
			if(r1 >= 0) {
				arr.add(r1);
			}
		}
		return arr;
	}


	/**
	 * Returns all used registers as a set.
	 */
	public usedRegs(): Set<REGISTER> {
		const usedRegs = new Set<REGISTER>();
		for(let r=0; r<REGISTER.REGS_MAX; r++) {
			if(this.regs[r] != r)
				usedRegs.add(r);
		}
		return usedRegs;
	}


	/**
	 * Clones the instance completely with usedAddresses,
	 * inputRegs and stack.
	 * @returns A new instance.
	 */
	public clone(): Regs {
		const nRegs = new Regs();
		// Copy registers
		for(let r=0; r<REGISTER.REGS_MAX; r++) {
			nRegs.regs[r] = this.regs[r];
		}
		// Copy usedAddresses
		for(const addr of this.usedAddresses)
			nRegs.usedAddresses.push(addr);
		// Copy inputRegs
		for(const reg of this.inputRegs)
			nRegs.inputRegs.add(reg);
		// Copy stack
		for(const val of this.stack)
			nRegs.stack.push(val);
		// Return
		return nRegs;
	}


	/**
	 * Merges 2 register instances.
	 * Each used register of the otherRegs is copied here.
	 * @param otherRegs Other instance that is merged.
	 */
	public merge(otherRegs: Regs) {
		for(let r=0; r<REGISTER.REGS_MAX; r++) {
			if(otherRegs.regs[r] != r)
				this.regs[r] = otherRegs.regs[r];
		}
	}


	/**
	 * Merges used registers and input registers into this instance.
	 * Is used if an already analysed subroutine is merged into the
	 * current anaylsis.
	 * @param usedRegs A set of used registers.
	 * @param inpRegs A set of input registers.
	 */
	public mergeRegs(usedRegs: Set<REGISTER>, inpRegs: Set<REGISTER>) {
		// Used registers
		for(const r of usedRegs)
			this.use(r);
		// Input registers
		for(const r of inpRegs)
			this.inputRegs.add(r);
	}
}