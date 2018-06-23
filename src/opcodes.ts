//import * as util from 'util';
//import * as assert from 'assert';
//import { Memory, MAX_MEM_SIZE } from './memory';
import { LabelType } from './label'




/**
 * Class for Opcodes.
 * Contains the name, formatting, type and possibly a value.
 */
export class Opcode {
	/// The name of the opcode, e.g. "LD A,%d"
	public name: string;
	/// The additional value in the opcode, e.g. nn or n
	public valueType: LabelType;
	// The length of the opcode + value
	public length: number;

	// The value (if any) used in the opcode, e.g. nn in "LD HL,nn"
	public value: number;

	/**
	 * Constructor.
	 */
	constructor(name: string, value: LabelType, length: number) {
		this.name = name;
		this.valueType = value;
		this.length = length;
		this.value = 0;
	}

	/**
	 * Static method to create an Opcode object from a value.
	 */
	public static fromValue(val) {
		if(val< 0 || val>=opcodes.length)
			throw new Error('Opcode 0x' + val.toString(16) + ' unknown.');
		const opcode = opcodes[val];
		return opcode;
	}
}



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


const opcodes: Array<Opcode> = [
	new Opcode("NOP", LabelType.NONE, 1),
	new Opcode("LD BC,%d", LabelType.NUMBER_BYTE, 3),
	new Opcode("LD (BC),A", LabelType.NONE, 1),
	new Opcode("INC BC", LabelType.NONE, 1),
	new Opcode("DEC BC", LabelType.NONE, 1),
	new Opcode("LD B,%d", LabelType.NUMBER_BYTE, 2),
	new Opcode("LD (%d),a", LabelType.DATA_LBL, 3),
	new Opcode("CALL %d", LabelType.CODE_SUB, 3),
	new Opcode("JP %d", LabelType.CODE_LBL, 2),
	new Opcode("JR %d", LabelType.CODE_LOOP, 2),
];


