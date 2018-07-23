//import * as assert from 'assert';
//import { CodeLocation } from './codelocation';
import { NumberType, getNumberTypeAsString } from './numbertype';


/// Used for a reference to a label.
export interface Reference {
	/// The address of the reference.
	address: number;
	/// The parent to the address.
	parent: DisLabel|undefined;
}


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

	/// The code locations that reference the label. (prents are the 'callers'.)
	public references = new Set<Reference>();

	/// A list with all called subroutine labels. (for statistics)
	public calls = new Array<DisLabel>();

	/// True if it is an EQU label. A label whose memory was not given as binary value.
	/// I.e. outside the range of the given memory.
	public isEqu = false;

	/// Set to true if label belongs to an interrupt.
	public belongsToInterrupt = false;

	/// Determines if the type etc. might be changed.
	/// E.g. used if the user sets a label, so that it is not changed afterwards.
	public isFixed = false;


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
		return getNumberTypeAsString(this.type);
	}


	/**
	 * @returns The label name.
	 */
	public getName() {
		return this.name;
	}
}
