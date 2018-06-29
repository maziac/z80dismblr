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
}


/**
 * Class used for unknown opcodes.
 * Calculates length on its own.
 */
class OpcodeUnknown extends Opcode {
	constructor(prefixCode: number, code: number) {
		// Create length and name from opcode
		let length = 0;
		let name = '';
		let bCode = (prefixCode<<8) + code;
		do {
			length ++;
			const codeString = (bCode & 0xFF).toString(16).toUpperCase();
			name = '0'.repeat(2-codeString.length) + codeString + 'h, ' + name;
			// next
			bCode >>= 8;
		} while(bCode);
		name = 'defb ' + name.substr(0, name.length-2) + '\t; UNKNOWN OPCODE';
		super(code, name, LabelType.NONE, length);
	}
}


class OpcodeCB extends Opcode {
	constructor(code: number, name: string, value?: LabelType.NONE, length?: number) {
		super(code, name, value, length);
		this.length += 1;	// one more
	}
}

class OpcodeDD extends Opcode {
	constructor(code: number, name: string, value?: LabelType.NONE, length?: number) {
		super(code, name, value, length);
		this.length += 1;	// one more
	}
}

class OpcodeED extends Opcode {
	constructor(code: number, name: string, value?: LabelType.NONE, length?: number) {
		super(code, name, value, length);
		this.length += 1;	// one more
	}
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


/// Opcodes that start with 0xCB.
export const OpcodesCB: Array<Opcode> = [
	...Array<number>(0x7E).fill(0).map((value, index) =>
		new Opcode(index,"lll")),
	...([] as Array<Opcode>).fill(new Opcode(9,"lll"), 0, 0x7E),
	new OpcodeCB(0x7E, "LD A,(IX+#n)"),
	...Array<number>( 0x100-0x7E-1).fill(0).map((value, index) =>
	new Opcode(index+0x7E+1,"lll"))
];

/// Opcodes that start with 0xDD.
export const OpcodesDD: Array<Opcode> = [
	...Array<number>(0x09).fill(0).map((value, index) => new OpcodeUnknown(0xDD, index)),

	new OpcodeDD(0x09, "ADD  IX,BC    "),
	...Array<number>(0x0F).fill(0).map((value, index) => new OpcodeUnknown(0xDD, 0x0A+index)),

	new OpcodeDD(0x19, "ADD  IX,DE    "),
	...Array<number>(0x07).fill(0).map((value, index) => new OpcodeUnknown(0xDD, 0x1A+index)),

	new OpcodeDD(0x21, "LD   IX,&0000 "),
	new OpcodeDD(0x22, "LD  (&0000),IX"),
	new OpcodeDD(0x23, "INC  IX       "),
	new OpcodeDD(0x24, "INC  IXH      "),
	new OpcodeDD(0x25, "DEC  IXH      "),
	new OpcodeDD(0x26, "LD   IXH,&00  "),
	...Array<number>(0x02).fill(0).map((value, index) => new OpcodeUnknown(0xDD, 0x27+index)),

	new OpcodeDD(0x29, "ADD  IX,IX    "),
	new OpcodeDD(0x2A, "LD  IX,(&0000)"),
	new OpcodeDD(0x2B, "DEC  IX       "),
	new OpcodeDD(0x2C, "INC  IXL      "),
	new OpcodeDD(0x2D, "DEC  IXL      "),
	new OpcodeDD(0x2E, "LD   IXL,&00  "),
	...Array<number>(0x05).fill(0).map((value, index) => new OpcodeUnknown(0xDD, 0x2F+index)),

	new OpcodeDD(0x34, "INC  (IX+0)   "),
	new OpcodeDD(0x35, "DEC  (IX+0)   "),
	new OpcodeDD(0x36, "LD  (IX+0),&00"),
	...Array<number>(0x02).fill(0).map((value, index) => new OpcodeUnknown(0xDD, 0x37+index)),

	new OpcodeDD(0x39, "ADD  IX,SP    "),
	...Array<number>(0x0A).fill(0).map((value, index) => new OpcodeUnknown(0xDD, 0x3A+index)),

	new OpcodeDD(0x44, "LD   B,IXH    "),
	new OpcodeDD(0x45, "LD   B,IXL    "),
	new OpcodeDD(0x46, "LD   B,(IX+0) "),
	...Array<number>(0x05).fill(0).map((value, index) => new OpcodeUnknown(0xDD, 0x47+index)),

	new OpcodeDD(0x4C, "LD   C,IXH    "),
	new OpcodeDD(0x4D, "LD   C,IXL    "),
	new OpcodeDD(0x4E, "LD   C,(IX+0) "),
	...Array<number>(0x05).fill(0).map((value, index) => new OpcodeUnknown(0xDD, 0x4F+index)),

	new OpcodeDD(0x54, "LD   D,IXH    "),
	new OpcodeDD(0x55, "LD   D,IXL    "),
	new OpcodeDD(0x56, "LD   D,(IX+0) "),
	...Array<number>(0x05).fill(0).map((value, index) => new OpcodeUnknown(0xDD, 0x57+index)),

	new OpcodeDD(0x5C, "LD   E,IXH    "),
	new OpcodeDD(0x5D, "LD   E,IXL    "),
	new OpcodeDD(0x5E, "LD   E,(IX+0) "),

	new OpcodeUnknown(0xDD, 0x5F),

	new OpcodeDD(0x60, "LD   IXH,B    "),
	new OpcodeDD(0x61, "LD   IXH,C    "),
	new OpcodeDD(0x62, "LD   IXH,D    "),
	new OpcodeDD(0x63, "LD   IXH,E    "),
	new OpcodeDD(0x64, "LD   IXH,IXH  "),
	new OpcodeDD(0x65, "LD   IXH,IXL  "),
	new OpcodeDD(0x66, "LD   H,(IX+0) "),
	new OpcodeDD(0x67, "LD   IXH,A    "),
	new OpcodeDD(0x68, "LD   IXL,B    "),
	new OpcodeDD(0x69, "LD   IXL,C    "),
	new OpcodeDD(0x6A, "LD   IXL,D    "),
	new OpcodeDD(0x6B, "LD   IXL,E    "),
	new OpcodeDD(0x6C, "LD   IXL,IXH  "),
	new OpcodeDD(0x6D, "LD   IXL,IXL  "),
	new OpcodeDD(0x6E, "LD   L,(IX+0) "),
	new OpcodeDD(0x6F, "LD   IXL,A    "),
	new OpcodeDD(0x70, "LD   (IX+0),B "),
	new OpcodeDD(0x71, "LD   (IX+0),C "),
	new OpcodeDD(0x72, "LD   (IX+0),D "),
	new OpcodeDD(0x73, "LD   (IX+0),E "),
	new OpcodeDD(0x74, "LD   (IX+0),H "),
	new OpcodeDD(0x75, "LD   (IX+0),L "),

	new OpcodeUnknown(0xDD, 0x76),

	new OpcodeDD(0x77, "LD   (IX+0),A "),
	...Array<number>(0x04).fill(0).map((value, index) => new OpcodeUnknown(0xDD, 0x78+index)),

	new OpcodeDD(0x7C, "LD   A,IXH    "),
	new OpcodeDD(0x7D, "LD   A,IXL    "),
	new OpcodeDD(0x7E, "LD   A,(IX+0) "),
	...Array<number>(0x05).fill(0).map((value, index) => new OpcodeUnknown(0xDD, 0x7F+index)),

	new OpcodeDD(0x84, "ADD  A,IXH    "),
	new OpcodeDD(0x85, "ADD  A,IXL    "),
	new OpcodeDD(0x86, "ADD  A,(IX+0) "),
	...Array<number>(0x05).fill(0).map((value, index) => new OpcodeUnknown(0xDD, 0x87+index)),

	new OpcodeDD(0x8C, "ADC  A,IXH    "),
	new OpcodeDD(0x8D, "ADC  A,IXL    "),
	new OpcodeDD(0x8E, "ADC  A,(IX+0) "),
	...Array<number>(0x05).fill(0).map((value, index) => new OpcodeUnknown(0xDD, 0x8F+index)),

	new OpcodeDD(0x94, "SUB  A,IXH    "),
	new OpcodeDD(0x95, "SUB  A,IXL    "),
	new OpcodeDD(0x96, "SUB  A,(IX+0) "),
	...Array<number>(0x05).fill(0).map((value, index) => new OpcodeUnknown(0xDD, 0x97+index)),

	new OpcodeDD(0x9C, "SBC  A,IXH    "),
	new OpcodeDD(0x9D, "SBC  A,IXL    "),
	new OpcodeDD(0x9E, "SBC  A,(IX+0) "),
	...Array<number>(0x05).fill(0).map((value, index) => new OpcodeUnknown(0xDD, 0x9F+index)),

	new OpcodeDD(0xA4, "AND  IXH      "),
	new OpcodeDD(0xA5, "AND  IXL      "),
	new OpcodeDD(0xA6, "AND  (IX+0)   "),
	...Array<number>(0x05).fill(0).map((value, index) => new OpcodeUnknown(0xDD, 0xA7+index)),

	new OpcodeDD(0xAC, "XOR  IXH      "),
	new OpcodeDD(0xAD, "XOR  IXL      "),
	new OpcodeDD(0xAE, "XOR  (IX+0)   "),
	...Array<number>(0x05).fill(0).map((value, index) => new OpcodeUnknown(0xDD, 0xAF+index)),

	new OpcodeDD(0xB4, "OR   IXH      "),
	new OpcodeDD(0xB5, "OR   IXL      "),
	new OpcodeDD(0xB6, "OR   (IX+0)   "),
	...Array<number>(0x05).fill(0).map((value, index) => new OpcodeUnknown(0xDD, 0xB7+index)),

	new OpcodeDD(0xBC, "CP   IXH      "),
	new OpcodeDD(0xBD, "CP   IXL      "),
	new OpcodeDD(0xBE, "CP   (IX+0)   "),
	...Array<number>(0x22).fill(0).map((value, index) => new OpcodeUnknown(0xDD, 0xBF+index)),

	new OpcodeDD(0xE1, "POP  IX       "),

	new OpcodeUnknown(0xDD, 0xE2),

	new OpcodeDD(0xE3, "EX   (SP),IX  "),

	new OpcodeUnknown(0xDD, 0xE4),

	new OpcodeDD(0xE5, "PUSH IX       "),
	...Array<number>(0x03).fill(0).map((value, index) => new OpcodeUnknown(0xDD, 0xE6+index)),

	new OpcodeDD(0xE9, "JP   (IX)     "),
	...Array<number>(0x100-0xE9-1).fill(0).map((value, index) => new OpcodeUnknown(0xDD, 0xEA+index))
];

/// Opcodes that start with 0xED.
export const OpcodesED: Array<Opcode> = [
	new OpcodeED(0x7E, "LD A,(IX+#n)"),
];


/// Opcodes that start with 0xFDCB.
export const OpcodesFDCB: Array<Opcode> = [
	new OpcodeFDCB(0x7E, "LD A,(IX+#n)"),
];

/// Opcodes that start with 0xFD.
export const OpcodesFD: Array<Opcode> = [
	OpcodesFDCB as any,
];


// Normal Opcodes
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
	OpcodesCB as any,
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
	OpcodesDD as any,
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
	OpcodesED as any,
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
	OpcodesFD as any,
	new Opcode(0xFE, "CP	#n"),
	new Opcode(0xFF, "RST	&38"),
];


