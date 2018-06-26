import * as assert from 'assert';



/// A categorization (and priorization) of the labels.
/// The higher the number, the higher the prio.
export const enum LabelType {
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
	// "BYTE"-type
	NUMBER_BYTE,
	// "WORD"-type
	NUMBER_WORD,
	// "Data LBL"-type
	DATA_LBL,
	// Label for "out/in" command
	PORT_LBL	// TODO: Port needs other handling. Is another space, i.e. a memory label nd a port label could have same number.
}


/**
 * Class to hold and access the memory.
 */
export class Label {

	/// The type of the label, e.g. if it is data or program code.
	public type: LabelType;

	/// The name of the label, e.g. "SUB001" or ".sub001_loop5"
	public name: string;

	/// True if it is an EQU label. A label whose memory was not given as binary value.
	/// I.e. outside the range of the given memory.
	public isEqu: boolean;

	/**
	 * Constructor: Initializes memory.
	 */
 	constructor (type: LabelType) {
		this.type = type;
		this.isEqu = false;
	}


	/**
	 * returns the LabelType enum as string.
	 * For debugging.
	 */
	public getTypeAsString(): string {
		switch(this.type) {
			case LabelType.NONE:	return "NONE";
			case LabelType.CODE_RELATIVE_LBL:	return "CODE_RELATIVE_LBL";
			case LabelType.CODE_RELATIVE_LOOP:	return "CODE_RELATIVE_LOOP";
			case LabelType.CODE_LBL:	return "CODE_LBL";
			case LabelType.CODE_SUB:	return "CODE_SUB";
			case LabelType.NUMBER_BYTE:	return "NUMBER_BYTE";
			case LabelType.NUMBER_WORD:	return "NUMBER_WORD";
			case LabelType.DATA_LBL:	return "DATA_LBL";
			case LabelType.PORT_LBL:	return "PORT_LBL";
		}
		// Unknown
		assert(false);
	}
}

