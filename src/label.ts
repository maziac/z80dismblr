//import * as assert from 'assert';



/// A categorization (and priorization) of the labels.
/// The higher the number, the higher the prio.
export const enum LabelType {
	// No label
	NONE = 0,
	// "local-label"-type
	CODE_LOCAL_LBL,
	// "loop"-type
	CODE_LOOP,
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


/**
 * Class to hold and access the memory.
 */
export class Label {

	/// The type of the label, e.g. if it is data or program code.
	public type: LabelType;

	/// The name of the label, e.g. "SUB001" or ".sub001_loop5"
	public name: string;


	/**
	 * Constructor: Initializes memory.
	 */
 	constructor (type: LabelType) {
		this.type = type;
	}
}

