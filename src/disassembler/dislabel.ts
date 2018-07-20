import * as assert from 'assert';
//import { CodeLocation } from './codelocation';
import { NumberType } from './numbertype';

/**
 * Class for the labels used for disassembly.
 */
export class DisLabel {

	/// The type of the label, e.g. if it is data or program code.
	public type: NumberType;

	/// The name of the label, e.g. "SUB001" or ".sub001_loop5"
	public name: string;

	/// The "parent" label: Either a subroutine or a code label.
	/// Used for local label naming.
	public parent: DisLabel;

	/// The code locations that reference the label.
	public references = Array<number>();

	/// True if it is an EQU label. A label whose memory was not given as binary value.
	/// I.e. outside the range of the given memory.
	public isEqu = false;

	/// Set to true if label belongs to an interrupt.
	public belongsToInterrupt = false;

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
			case NumberType.CODE_LOCAL_LBL:	return "CODE_RELATIVE_LBL";
			case NumberType.CODE_LOCAL_LOOP:	return "CODE_RELATIVE_LOOP";
			case NumberType.CODE_LBL:	return "CODE_LBL";
			case NumberType.CODE_SUB:	return "CODE_SUB";
			case NumberType.CODE_RST:	return "CODE_RST";
			case NumberType.RELATIVE_INDEX:	return "RELATIVE_INDEX";
			case NumberType.NUMBER_BYTE:	return "NUMBER_BYTE";
			case NumberType.NUMBER_WORD:	return "NUMBER_WORD";
			case NumberType.NUMBER_WORD_BIG_ENDIAN:	return "NUMBER_WORD_BIG_ENDIAN";
			case NumberType.DATA_LBL:	return "DATA_LBL";
			//case NumberType.SELF_MODIFYING_CODE:	return "SELF_MODIFYING_CODE";
			case NumberType.PORT_LBL:	return "PORT_LBL";
		}
		// Unknown
		assert(false);
	}


	/**
	 * @returns The label name.
	 */
	public getName() {
		return this.name;
	}
}
