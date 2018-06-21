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

export class Disassembler {

	/// The memory area to disassemble.
	protected memory: Uint8Array;



	/**
	 * Define the memory area to disassemble.
	 * @param memory The memory area.
	 */
	public setMemory(memory: Uint8Array) {
		this.memory = memory;
	}


	/**
	 * Disassembles the  memory area.
	 * @returns An array of strings with the disassembly.
	 */
	public disassemble(): Array<string> {
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
	 * Disassembles one opcode.
	 * @param addr The address to disassemble.
	 * @param lines The disassembly is added here.
	 * @returns The disassembly.
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

