import * as util from 'util';
import * as assert from 'assert';
//var assert = require('assert');


/// OpcodeValue
const enum OV {
	NONE = 0,   ///< No additional value
	DIRECT_BYTE = 1, ///< e.g. "LD A,n"
	DIRECT_WORD,  ///< e.g. "LD Hl,nn"
	INDIRECT,   ///< e.g. "LD HL,(nn)"
}


/*
interface Opcode {
	/// The name of the opcode, e.g. "LD A,%d"
	name: string;
	/// The additional value in the opcode, e.g. nn or n
	additionalValue: OV;
}
*/

/// Opcode table
/*
nn nn             DD nn          CB nn       FD CB ff nn      ED nn
--------------------------------------------------------------------------
00 NOP            -              RLC  B      rlc (iy+0)->b    MOS_QUIT
01 LD   BC,&0000  -              RLC  C      rlc (iy+0)->c    MOS_CLI
02 LD   (BC),A    -              RLC  D      rlc (iy+0)->d    MOS_BYTE
03 INC  BC        -              RLC  E      rlc (iy+0)->e    MOS_WORD
04 INC  B         -              RLC  H      rlc (iy+0)->h    MOS_WRCH
05 DEC  B         -              RLC  L      rlc (iy+0)->l    MOS_RDCH
06 LD   B,&00     -              RLC  (HL)   RLC  (IY+0)      MOS_FILE
*/


const opcodes: Array<Array<any>> = [
	["NOP", OV.NONE],
	["LD BC,%d", OV.DIRECT_WORD],
	["LD (BC),A", OV.NONE],
	["INC BC", OV.NONE],
	["DEC BC", OV.NONE],
	["LD B,%d", OV.DIRECT_BYTE]
];


const opcodes2: Array<Array<any>> = [
	["NOP", LabelType.NONE],
	["LD BC,%d", LabelType.NUMBER_BYTE],
	["LD (BC),A", LabelType.NONE],
	["INC BC", LabelType.NONE],
	["DEC BC", LabelType.NONE],
	["LD B,%d", LabelType.NUMBER_BYTE],
	["LD (%d),a", LabelType.DATA_LBL],
	["CALL %d", LabelType.CODE_SUB],
	["JP %d", LabelType.CODE_LBL],
	["JR %d", LabelType.CODE_LOCAL_LBL],
	["DJNZ %d", LabelType.CODE_LOOP],
];


/// A categorization (and priorization) of the labels.
/// The higher the number, the higher the prio.
const enum LabelType {
	// No label
	NONE = 0,
	// "loop"-type
	CODE_LOOP,
	// "local-label"-type
	CODE_LOCAL_LBL,
	// "LBL"-type
	CODE_LBL,
	// "SUB"-type
	CODE_SUB,
	// "BYTE"-type
	NUMBER_BYTE,
	// "WORD"-type
	NUMBER_WORD,
	// "Data LBL"-type
	DATA_LBL,
}


/// For storing info about the label.
interface LabelInfo {
	/// The name of the label.
	name: string;

	/// The type of the label
	type: LabelType;
}

export class Disassembler {

	/// The memory area to disassemble.
	protected memory: Uint8Array;

	/// The labels.
	protected labels = new Array<LabelInfo>();

	/**
	 * Define the memory area to disassemble.
	 * @param memory The memory area.
	 */
	public setMemory(memory: Uint8Array) {
		this.memory = memory;
	}


	/**
	 * Disassembles the  memory area.
	 * Disassembly is done in a few passes:
	 * 1. Pass: Retrieve labels
	 * 	- Prioritize labels
	 *  - find number ranges for labels
	 * 2. Pass: Disassemble
	 * 	- disassemble opcode
	 *  - add label to opcode
	 * @returns An array of strings with the disassembly.
	 */
	public disassemble(): Array<string> {
		// 1. Pass: Collect labels
		this.collectLabels();


		let lines = new Array<string>();
		let addr = 0;
		let end = addr + this.memory.length;
		while (addr < end) {
			// Determine which opcode
			addr = this.disOpcode(addr, lines);
		}
		return lines;
	}


	/**
	 * Parses the memory area for opcodes with labels.
	 * Stores all labels with a categorization in an array.
	 * Priorization of labels:
	 * 1. "SUB"-labels: Everything called by "CALL nn" or "CALL cc,nn"
	 * 2. "LBL"-labels: Everything jumped to "JP nn" or "JP cc,nn"
	 * 3. "loop"-labels: Everything jumped to by "DJNZ"
	 * 4. "l"-labels: Everything jumped to by "JR n" or "JR cc,n"
	 * "loop" and "lbl" labels are prefixed by a previous "SUB"- or "LBL"-label with a prefix
	 * ".subNNN_" or ".lblNNN_". E.g. ".sub001_l5", ".sub001_loop1", ".lbl788_l89", ".lbl788_loop23".
	 */
	protected collectLabels() {
		let addr = 0;
		let end = addr + this.memory.length;
		while (addr < end) {
			// Determine which opcode
			addr = this.disLabel(addr);
		}
	}


	/**
	 * "Disassembles" one label. I.e. the opcode is disassembled and check if it includes
	 * a label.
	 * If so, the label is stored together with the call infromation.
	 * @param addr The address to disassemble.
	 * @returns The next address to disassemble.
	 */
	protected disLabel(addr: number): number {
		// Read memory value
		let value = this.memory[addr];
		addr++;
		// Decode
		let opcode = opcodes[value];
		assert(typeof opcode[0] === 'string');
		let name: string = opcode[0];
		// Next
		const opcodeValue = opcode[1];
		switch (opcodeValue) {
			case OV.NONE:
				break;
			case OV.DIRECT_BYTE:
				addr++;
				break;
			case OV.DIRECT_WORD:
				addr += 2;
				break;
			case OV.INDIRECT:
				// Get label value
				let wValue = this.memory[addr] + 256*this.memory[addr+1];

				// Next
				addr += 2;
				break;
			default:
				assert(false);
				break;
		}
		// Add disassembled opcode
	//	lines.push(name);
		// Return
		return addr;
	}


	/**
	 * Disassembles one opcode.
	 * @param addr The address to disassemble.
	 * @param lines The disassembly is added here.
	 * @returns The next address to disassemble.
	 */
	protected disOpcode(addr: number, lines: Array<string>): number {
		// Read memory value
		let value = this.memory[addr];
		addr++;
		// Decode
		let opcode = opcodes[value];
		assert(typeof opcode[0] === 'string');
		let name: string = opcode[0];
		// Next
		const opcodeValue = opcode[1];
		switch (opcodeValue) {
			case OV.NONE:
				break;
			case OV.DIRECT_BYTE:
				let bValue = this.memory[addr];
				name = util.format(name, bValue);
				addr++;
				break;
			case OV.DIRECT_WORD:
			case OV.INDIRECT:
				let wValue = this.memory[addr] + 256*this.memory[addr+1];
				name = util.format(name, wValue);
				addr += 2;
				break;
			default:
				assert(false);
				break;
		}
		// Add disassembled opcode
		lines.push(name);
		// Return
		return addr;
	}

}


	//export default Disassembler;

