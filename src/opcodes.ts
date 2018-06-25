//import * as util from 'util';
//import * as assert from 'assert';
//import { Memory, MAX_MEM_SIZE } from './memory';
import { LabelType } from './label'
//import { Opcode } from './opcodes';


/// Classifies opcodes.
export enum OpcodeFlag {
	NONE = 0,
	BRANCH_ADDRESS = 0x01,	///< contains a branch address, e.g. jp, jp cc, jr, jr cc, call, call cc.
	CALL = 0x02,	///< is a subroutine call, e.g. call or call cc
	STOP = 0x04,	///< is a stop-code. E.g. ret, reti, jp or jr. Disassembly procedure stops here.
}


/**
 * Class for Opcodes.
 * Contains the name, formatting, type and possibly a value.
 */
export class Opcode {
	/// The code (byte value) of the opcode
	public code: number;	/// Used to test if all codes are in the right place.

	/// The name of the opcode, e.g. "LD A,%d"
	public name: string;
	/// Opcode flags: branch-address, call, stop
	public flags: OpcodeFlag;
	/// The additional value in the opcode, e.g. nn or n
	public valueType: LabelType;
	/// The length of the opcode + value
	public length: number;

	/// The value (if any) used in the opcode, e.g. nn in "LD HL,nn"
	/// Is only a temporary value, decoded for the current instruction.
	public value: number;

	/**
	 * Constructor.
	 */
	constructor(code: number, name: string, value?: LabelType.NONE, length?: number) {
		this.code = code;
		this.flags = OpcodeFlag.NONE;
		this.valueType = LabelType.NONE;
		this.value = 0;
		this.length = 1;	// default
		// Retrieve valueType and opcode flags from name
		let k;
		if((k = name.indexOf('#n')) > 0) {
			if(name.substr(k+2,1) == 'n') { // i.e. '#nn'
				// Word
				this.length = 3;
				// substitute formatting
				name = name.substr(0,k) + '%s' + name.substr(k+3);
				// store type
				const indirect = name.substr(k-1,1);
				if(indirect == '(') {
					// Enclosed in brackets ? E.g. "(20fe)" -> indirect (this is no call or jp)
					this.valueType = LabelType.DATA_LBL;
				}
				else {
					// now check for opcode flags
					if(name.startsWith("CALL")) {
						this.flags |= OpcodeFlag.CALL | OpcodeFlag.BRANCH_ADDRESS;
						this.valueType = LabelType.CODE_SUB;
					}
					else if(name.startsWith("JP")) {
						this.flags |= OpcodeFlag.BRANCH_ADDRESS;
						this.valueType = LabelType.CODE_LBL;
						// Now check if it is conditional, i.e. if there is a ',' in the opcode
						// If it is not conditional it is a stop-code.
						if(name.indexOf(',') < 0) {
							// not conditional -> stop-code
							this.flags |= OpcodeFlag.STOP;
						}
					}
					else {
						// Either call nor jp
						this.valueType = LabelType.NUMBER_WORD;
					}
				}
			}
			else {
				// Byte
				this.length = 2;
				// substitute formatting
				name = name.substr(0,k) + '%s' + name.substr(k+2);
				// store type
				this.valueType = LabelType.NUMBER_BYTE;

				// now check for opcode flags
				if(name.startsWith("DJNZ")) {
					this.valueType = LabelType.CODE_RELATIVE_LOOP;
					this.flags |= OpcodeFlag.BRANCH_ADDRESS;
				}
				if(name.startsWith("JR")) {
					this.valueType = LabelType.CODE_RELATIVE_LBL;
					this.flags |= OpcodeFlag.BRANCH_ADDRESS;
					// Now check if it is conditional, i.e. if there is a ',' in the opcode
					// If it is not conditional it is a stop-code.
					if(name.indexOf(',') < 0) {
						// not conditional -> stop-code
						this.flags |= OpcodeFlag.STOP;
					}
				}
				else if(name.startsWith("IN") || name.startsWith("OUT")) {
					// a port
					this.valueType = LabelType.PORT_LBL;
				}
			}
		}
		else if(name.startsWith("RET")) {	// "RET" or "RET cc"
			// If it is not conditional it is a stop-code.
			if(name.substr(name.length-1,1) == '\t') {	// last character is no TAB
				// not conditional -> stop-code
				this.flags |= OpcodeFlag.STOP;
			}
		}

		// Store
		this.name = name;
	}

	/**
	 * Static method to create an Opcode object from a value.
	 */
	public static fromValue(val) {
		if(val< 0 || val>=Opcodes.length)
			throw new Error('Opcode 0x' + val.toString(16) + ' unknown.');
		const opcode = Opcodes[val];
		return opcode;
	}
}


class OpcodeDD extends Opcode {
}

class OpcodeCB extends Opcode {
}

class OpcodeED extends Opcode {
}


class OpcodeFDCB extends Opcode {
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


export const Opcodes: Array<Opcode> = [
	new Opcode(0x00, "NOP	"),
	new Opcode(0x01, "LD	BC,#nn"),
	new Opcode(0x02, "LD	(BC),A"),
	new Opcode(0x03, "INC	BC"),
	new Opcode(0x04, "INC	B"),
	new Opcode(0x05, "DEC	B"),
	new Opcode(0x06, "LD	B,#n"),
	new Opcode(0x07, "RLCA	"),
	new Opcode(0x08, "EX	AF,AF'"),
	new Opcode(0x09, "ADD	HL,BC"),
	new Opcode(0x0A, "LD	A,(BC)"),
	new Opcode(0x0B, "DEC	BC"),
	new Opcode(0x0C, "INC	C"),
	new Opcode(0x0D, "DEC	C"),
	new Opcode(0x0E, "LD	C,#n"),
	new Opcode(0x0F, "RRCA	"),
	new Opcode(0x10, "DJNZ	#n"),
	new Opcode(0x11, "LD	DE,#nn"),
	new Opcode(0x12, "LD	(DE),A"),
	new Opcode(0x13, "INC	DE"),
	new Opcode(0x14, "INC	D"),
	new Opcode(0x15, "DEC	D"),
	new Opcode(0x16, "LD	D,#n"),
	new Opcode(0x17, "RLA	"),
	new Opcode(0x18, "JR	#n"),
	new Opcode(0x19, "ADD	HL,DE"),
	new Opcode(0x1A, "LD	A,(DE)"),
	new Opcode(0x1B, "DEC	DE"),
	new Opcode(0x1C, "INC	E"),
	new Opcode(0x1D, "DEC	E"),
	new Opcode(0x1E, "LD	E,#n"),
	new Opcode(0x1F, "RRA	"),
	new Opcode(0x20, "JR	NZ,#n"),
	new Opcode(0x21, "LD	HL,#nn"),
	new Opcode(0x22, "LD	(#nn),HL"),
	new Opcode(0x23, "INC	HL"),
	new Opcode(0x24, "INC	H"),
	new Opcode(0x25, "DEC	H"),
	new Opcode(0x26, "LD	H,#n"),
	new Opcode(0x27, "DAA	"),
	new Opcode(0x28, "JR	Z,#n"),
	new Opcode(0x29, "ADD	HL,HL"),
	new Opcode(0x2A, "LD	HL,(#nn)"),
	new Opcode(0x2B, "DEC	HL"),
	new Opcode(0x2C, "INC	L"),
	new Opcode(0x2D, "DEC	L"),
	new Opcode(0x2E, "LD	L,#n"),
	new Opcode(0x2F, "CPL	"),
	new Opcode(0x30, "JR	NC,#n"),
	new Opcode(0x31, "LD	SP,#nn"),
	new Opcode(0x32, "LD	(#nn),A"),
	new Opcode(0x33, "INC	SP"),
	new Opcode(0x34, "INC	(HL)"),
	new Opcode(0x35, "DEC	(HL)"),
	new Opcode(0x36, "LD	(HL),#n"),
	new Opcode(0x37, "SCF	"),
	new Opcode(0x38, "JR	C,#n"),
	new Opcode(0x39, "ADD	HL,SP"),
	new Opcode(0x3A, "LD	A,(#nn)"),
	new Opcode(0x3B, "DEC	SP"),
	new Opcode(0x3C, "INC	A"),
	new Opcode(0x3D, "DEC	A"),
	new Opcode(0x3E, "LD	A,#n"),
	new Opcode(0x3F, "CCF	"),
	new Opcode(0x40, "LD	B,B"),
	new Opcode(0x41, "LD	B,C"),
	new Opcode(0x42, "LD	B,D"),
	new Opcode(0x43, "LD	B,E"),
	new Opcode(0x44, "LD	B,H"),
	new Opcode(0x45, "LD	B,L"),
	new Opcode(0x46, "LD	B,(HL)"),
	new Opcode(0x47, "LD	B,A"),
	new Opcode(0x48, "LD	C,B"),
	new Opcode(0x49, "LD	C,C"),
	new Opcode(0x4A, "LD	C,D"),
	new Opcode(0x4B, "LD	C,E"),
	new Opcode(0x4C, "LD	C,H"),
	new Opcode(0x4D, "LD	C,L"),
	new Opcode(0x4E, "LD	C,(HL)"),
	new Opcode(0x4F, "LD	C,A"),
	new Opcode(0x50, "LD	D,B"),
	new Opcode(0x51, "LD	D,C"),
	new Opcode(0x52, "LD	D,D"),
	new Opcode(0x53, "LD	D,E"),
	new Opcode(0x54, "LD	D,H"),
	new Opcode(0x55, "LD	D,L"),
	new Opcode(0x56, "LD	D,(HL)"),
	new Opcode(0x57, "LD	D,A"),
	new Opcode(0x58, "LD	E,B"),
	new Opcode(0x59, "LD	E,C"),
	new Opcode(0x5A, "LD	E,D"),
	new Opcode(0x5B, "LD	E,E"),
	new Opcode(0x5C, "LD	E,H"),
	new Opcode(0x5D, "LD	E,L"),
	new Opcode(0x5E, "LD	E,(HL)"),
	new Opcode(0x5F, "LD	E,A"),
	new Opcode(0x60, "LD	H,B"),
	new Opcode(0x61, "LD	H,C"),
	new Opcode(0x62, "LD	H,D"),
	new Opcode(0x63, "LD	H,E"),
	new Opcode(0x64, "LD	H,H"),
	new Opcode(0x65, "LD	H,L"),
	new Opcode(0x66, "LD	H,(HL)"),
	new Opcode(0x67, "LD	H,A"),
	new Opcode(0x68, "LD	L,B"),
	new Opcode(0x69, "LD	L,C"),
	new Opcode(0x6A, "LD	L,D"),
	new Opcode(0x6B, "LD	L,E"),
	new Opcode(0x6C, "LD	L,H"),
	new Opcode(0x6D, "LD	L,L"),
	new Opcode(0x6E, "LD	L,(HL)"),
	new Opcode(0x6F, "LD	L,A"),
	new Opcode(0x70, "LD	(HL),B"),
	new Opcode(0x71, "LD	(HL),C"),
	new Opcode(0x72, "LD	(HL),D"),
	new Opcode(0x73, "LD	(HL),E"),
	new Opcode(0x74, "LD	(HL),H"),
	new Opcode(0x75, "LD	(HL),L"),
	new Opcode(0x76, "HALT	"),
	new Opcode(0x77, "LD	(HL),A"),
	new Opcode(0x78, "LD	A,B"),
	new Opcode(0x79, "LD	A,C"),
	new Opcode(0x7A, "LD	A,D"),
	new Opcode(0x7B, "LD	A,E"),
	new Opcode(0x7C, "LD	A,H"),
	new Opcode(0x7D, "LD	A,L"),
	new Opcode(0x7E, "LD	A,(HL)"),
	new Opcode(0x7F, "LD	A,A"),
	new Opcode(0x80, "ADD	A,B"),
	new Opcode(0x81, "ADD	A,C"),
	new Opcode(0x82, "ADD	A,D"),
	new Opcode(0x83, "ADD	A,E"),
	new Opcode(0x84, "ADD	A,H"),
	new Opcode(0x85, "ADD	A,L"),
	new Opcode(0x86, "ADD	A,(HL)"),
	new Opcode(0x87, "ADD	A,A"),
	new Opcode(0x88, "ADC	A,B"),
	new Opcode(0x89, "ADC	A,C"),
	new Opcode(0x8A, "ADC	A,D"),
	new Opcode(0x8B, "ADC	A,E"),
	new Opcode(0x8C, "ADC	A,H"),
	new Opcode(0x8D, "ADC	A,L"),
	new Opcode(0x8E, "ADC	A,(HL)"),
	new Opcode(0x8F, "ADC	A,A"),
	new Opcode(0x90, "SUB	A,B"),
	new Opcode(0x91, "SUB	A,C"),
	new Opcode(0x92, "SUB	A,D"),
	new Opcode(0x93, "SUB	A,E"),
	new Opcode(0x94, "SUB	A,H"),
	new Opcode(0x95, "SUB	A,L"),
	new Opcode(0x96, "SUB	A,(HL)"),
	new Opcode(0x97, "SUB	A,A"),
	new Opcode(0x98, "SBC	A,B"),
	new Opcode(0x99, "SBC	A,C"),
	new Opcode(0x9A, "SBC	A,D"),
	new Opcode(0x9B, "SBC	A,E"),
	new Opcode(0x9C, "SBC	A,H"),
	new Opcode(0x9D, "SBC	A,L"),
	new Opcode(0x9E, "SBC	A,(HL)"),
	new Opcode(0x9F, "SBC	A,A"),
	new Opcode(0xA0, "AND	B"),
	new Opcode(0xA1, "AND	C"),
	new Opcode(0xA2, "AND	D"),
	new Opcode(0xA3, "AND	E"),
	new Opcode(0xA4, "AND	H"),
	new Opcode(0xA5, "AND	L"),
	new Opcode(0xA6, "AND	(HL)"),
	new Opcode(0xA7, "AND	A"),
	new Opcode(0xA8, "XOR	B"),
	new Opcode(0xA9, "XOR	C"),
	new Opcode(0xAA, "XOR	D"),
	new Opcode(0xAB, "XOR	E"),
	new Opcode(0xAC, "XOR	H"),
	new Opcode(0xAD, "XOR	L"),
	new Opcode(0xAE, "XOR	(HL)"),
	new Opcode(0xAF, "XOR	A"),
	new Opcode(0xB0, "OR	B"),
	new Opcode(0xB1, "OR	C"),
	new Opcode(0xB2, "OR	D"),
	new Opcode(0xB3, "OR	E"),
	new Opcode(0xB4, "OR	H"),
	new Opcode(0xB5, "OR	L"),
	new Opcode(0xB6, "OR	(HL)"),
	new Opcode(0xB7, "OR	A"),
	new Opcode(0xB8, "CP	B"),
	new Opcode(0xB9, "CP	C"),
	new Opcode(0xBA, "CP	D"),
	new Opcode(0xBB, "CP	E"),
	new Opcode(0xBC, "CP	H"),
	new Opcode(0xBD, "CP	L"),
	new Opcode(0xBE, "CP	(HL)"),
	new Opcode(0xBF, "CP	A"),
	new Opcode(0xC0, "RET	NZ"),
	new Opcode(0xC1, "POP	BC"),
	new Opcode(0xC2, "JP	NZ,#nn"),
	new Opcode(0xC3, "JP	#nn"),
	new Opcode(0xC4, "CALL	NZ,#nn"),
	new Opcode(0xC5, "PUSH	BC"),
	new Opcode(0xC6, "ADD	A,#n"),
	new Opcode(0xC7, "RST	#n"),
	new Opcode(0xC8, "RET	Z"),
	new Opcode(0xC9, "RET	"),
	new Opcode(0xCA, "JP	Z,#nn"),
	new OpcodeCB(0xCB, "CB-----"),	// TODO
	new Opcode(0xCC, "CALL	Z,#nn"),
	new Opcode(0xCD, "CALL	#nn"),
	new Opcode(0xCE, "ADC	A,#n"),
	new Opcode(0xCF, "RST	&08"),
	new Opcode(0xD0, "RET	NC"),
	new Opcode(0xD1, "POP	DE"),
	new Opcode(0xD2, "JP	NC,#nn"),
	new Opcode(0xD3, "OUT	(#n),A"),
	new Opcode(0xD4, "CALL	NC,#nn"),
	new Opcode(0xD5, "PUSH	DE"),
	new Opcode(0xD6, "SUB	A,#n"),
	new Opcode(0xD7, "RST	&10"),
	new Opcode(0xD8, "RET	C"),
	new Opcode(0xD9, "EXX	"),
	new Opcode(0xDA, "JP	C,#nn"),
	new Opcode(0xDB, "IN	A,(#n)"),
	new Opcode(0xDC, "CALL	C,#nn"),
	new OpcodeDD(0xDD, "DD-----"),	// TODO
	new Opcode(0xDE, "SBC	A,#n"),
	new Opcode(0xDF, "RST	&18"),
	new Opcode(0xE0, "RET	PO"),
	new Opcode(0xE1, "POP	HL"),
	new Opcode(0xE2, "JP	PO,#nn"),
	new Opcode(0xE3, "EX	(SP),HL"),
	new Opcode(0xE4, "CALL	PO,#nn"),
	new Opcode(0xE5, "PUSH	HL"),
	new Opcode(0xE6, "AND	#n"),
	new Opcode(0xE7, "RST	&20"),
	new Opcode(0xE8, "RET	PE"),
	new Opcode(0xE9, "JP	(HL)"),
	new Opcode(0xEA, "JP	PE,#nn"),
	new Opcode(0xEB, "EX	DE,HL"),
	new Opcode(0xEC, "CALL	PE,#nn"),
	new OpcodeED(0xED, "ED-----"),	// TODO
	new Opcode(0xEE, "XOR	#n"),
	new Opcode(0xEF, "RST	&28"),
	new Opcode(0xF0, "RET	P"),
	new Opcode(0xF1, "POP	AF"),
	new Opcode(0xF2, "JP	P,#nn"),
	new Opcode(0xF3, "DI	"),
	new Opcode(0xF4, "CALL	P,#nn"),
	new Opcode(0xF5, "PUSH	AF"),
	new Opcode(0xF6, "OR	#n"),
	new Opcode(0xF7, "RST	&30"),
	new Opcode(0xF8, "RET	M"),
	new Opcode(0xF9, "LD	SP,HL"),
	new Opcode(0xFA, "JP	M,#nn"),
	new Opcode(0xFB, "EI	"),
	new Opcode(0xFC, "CALL	M,#nn"),
	new OpcodeFDCB(0xFD, "FD-----"),	// TODO
	new Opcode(0xFE, "CP	#n"),
	new Opcode(0xFF, "RST	&38"),
];


