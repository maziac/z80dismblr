import * as assert from 'assert';
//import { CodeLocation } from './codelocation';


/// A categorization (and priorization) of the numbers (labels) in the opcodes.
/// The higher the number, the higher the prio.
export const enum NumberType {
	// No label
	NONE = 0,
	// "relative-label"-type, i.e. JR
	CODE_RELATIVE_LBL,
	// "loop"-type
	CODE_RELATIVE_LOOP,
	// "LBL"-type
	CODE_LBL,
	// "SUB"-type
	CODE_SUB,
	// "TST"-type
	CODE_RST,
	// A relative index like (IX+5) or (IY-3)
	RELATIVE_INDEX,
	// "BYTE"-type
	NUMBER_BYTE,
	// "WORD"-type
	NUMBER_WORD,
	// "WORD"-type for ZX Next command "PUSH $nnnn"
	NUMBER_WORD_BIG_ENDIAN,
	// "Data LBL"-type
	DATA_LBL,
	// Label for "out/in" command
	PORT_LBL	// TODO: Port needs other handling. Is another space, i.e. a memory label nd a port label could have same number.
}


/**
 * Class for the labels.
 */
export class Label {

	/// The type of the label, e.g. if it is data or program code.
	public type: NumberType;

	/// The name of the label, e.g. "SUB001" or ".sub001_loop5"
	public name: string;

	/// The "parent" label: Either a subroutine or a code label.
	/// Used for local label naming.
	public parent: Label;

	/// The code locations that reference the label.
	public references = Array<number>();

	/// True if it is an EQU label. A label whose memory was not given as binary value.
	/// I.e. outside the range of the given memory.
	public isEqu = false;

	/**
	 * Constructor: Initializes memory.
	 */
 	constructor (type: NumberType) {
		this.type = type;
	}


	/**
	 * returns the LabelType enum as string.
	 * For debugging.
	 */
	public getTypeAsString(): string {
		switch(this.type) {
			case NumberType.NONE:	return "NONE";
			case NumberType.CODE_RELATIVE_LBL:	return "CODE_RELATIVE_LBL";
			case NumberType.CODE_RELATIVE_LOOP:	return "CODE_RELATIVE_LOOP";
			case NumberType.CODE_LBL:	return "CODE_LBL";
			case NumberType.CODE_SUB:	return "CODE_SUB";
			case NumberType.CODE_RST:	return "CODE_RST";
			case NumberType.RELATIVE_INDEX:	return "RELATIVE_INDEX";
			case NumberType.NUMBER_BYTE:	return "NUMBER_BYTE";
			case NumberType.NUMBER_WORD:	return "NUMBER_WORD";
			case NumberType.NUMBER_WORD_BIG_ENDIAN:	return "NUMBER_WORD_BIG_ENDIAN";
			case NumberType.DATA_LBL:	return "DATA_LBL";
			case NumberType.PORT_LBL:	return "PORT_LBL";
		}
		// Unknown
		assert(false);
	}
}

