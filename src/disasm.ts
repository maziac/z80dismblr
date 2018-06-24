import * as util from 'util';
import * as assert from 'assert';
import { Memory, MAX_MEM_SIZE } from './memory';
//import { Opcode } from './opcodes';
import { Label, LabelType } from './label';


//var assert = require('assert');


/*
/// For storing info about the label.
interface LabelInfo {
	/// The name of the label.
	name: string;

	/// The type of the label
	type: LabelType;
}
*/

export class Disassembler {

	/// The memory area to disassemble.
	public memory: Memory;

	/// The labels.
	//protected labels = new Array<LabelInfo>();
	protected labels = new Map<number,Label>();


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

		// 2. Count number of types of labels
		this.countTypesOfLabels();

		// 3. Assign label names
		this.assignLabelNames();

		// 4. Pass: Disassemble opcode with label names
		this.dissambleOpcodes();

		/*
		let lines = new Array<string>();
		let addr = 0;
		let end = addr + this.memory.length;
		while (addr < end) {
			// Determine which opcode
			addr = this.disOpcode(addr, lines);
		}
		*/
		let lines = new Array<string>();
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
		while (addr < MAX_MEM_SIZE) {
			// Determine which opcode
			addr = this.disassembleForLabel(addr);
		}
	}


	/**
	 * Check condition under which a number is counted as label.
	 * @param value
	 * @return true or false.
	 */
	protected useNumberAsLabel(value: number) {
		return (value > 512);
	}


	/**
	 * "Disassembles" one label. I.e. the opcode is disassembled and checked if it includes
	 * a label.
	 * If so, the label is stored together with the call infromation.
	 * @param addr The address to disassemble.
	 * @returns The next address to disassemble.
	 */
	protected disassembleForLabel(addr: number): number {
		// Read memory value
		let opcode = this.memory.getOpcodeAt(addr);
		// Decode label
		let createNewLabel = false;
		switch(opcode.valueType) {
			case LabelType.CODE_LBL:
			case LabelType.CODE_SUB:
			case LabelType.DATA_LBL:
			case LabelType.CODE_LOCAL_LBL:
			case LabelType.CODE_LOOP:
				// Use label
				createNewLabel = true;
				break;
			case LabelType.NUMBER_WORD:
				// use word as label only under ceratin circumstances
				if(this.useNumberAsLabel(opcode.value))
					createNewLabel = true;
			break;
			case LabelType.NUMBER_BYTE:
				// byte value -> no label
			break;
			default:
				assert(false);
			break;
		}

		// It is a label
		if(createNewLabel) {
			// Prioritize if label already exists
			const label = this.labels.get(opcode.value);
			if(label) {
				// label already exists: prioritize
				if(label.type < opcode.valueType)
					label.type = opcode.valueType;
			}
			else {
				// Label does not exist yet, just add it
				this.labels.set(opcode.value, new Label(opcode.valueType));
			}
		}

		// Next
		return addr + opcode.length;
	}


	/**
	 * Count the types of labels.
	 * E.g. count all "SUB" labels to obtain the maximum number.
	 * The maximum number sets the number of digits used for the
	 * label numbering. E.g. with a max number of 78 there would be 2
	 * digits for the label numbering, i.e. "SUBnn".
	 */
	protected countTypesOfLabels() {
		// Count number of SUBs
		// TODO: numbers need to be calculated
		this.labelSubCountDigits = 4;
		this.labelLblCountDigits = 4;
		this.labelDataLblCountDigits = 4;	}


	/// Label prefixes
	public labelSubPrefix = "SUB";
	public labelLblPrefix = "LBL";
	public labelDataLblPrefix = "DATA";
	public labelLocalLablePrefix = "_l";
	public labelLoopPrefix = "_loop";

	/// The calculated number of occurences of a label type.
	protected labelSubCountDigits;
	protected labelLblCountDigits;
	protected labelDataLblCountDigits;

	/// Assign label names.
	/// Is done in 2 passes:
	/// 1. the major labels (e.g. "SUBnnn") are assigned and also the local label names without number.
	/// 2. Now the local label name numbers are assigned.
	/// Reason is that the count of digits for the local label numers is not not upfront.
	protected assignLabelNames() {
		// Start indexes
		let subIndex = 1;	// CODE_SUB
		let lblIndex = 1;	// CODE_LBL
		let dataLblIndex = 1;	// DATA_LBL

		// prefixes for the local labels are dependent on the surrounding code (e.g. sub routine)
		let localPrefix = "lbl0_";	// Just in case

		// Loop through all labels
		for( let [,label] of this.labels) {
			const type = label.type;
			switch(type) {
				case LabelType.CODE_SUB:
					// Set name
					label.name = this.labelSubPrefix + this.getIndex(subIndex, this.labelSubCountDigits);
					// Use for local prefix
					localPrefix = '.' + label.name.toLowerCase() + '_';
					// Next
					subIndex++;
				break;
				case LabelType.CODE_LBL:
					// Set name
					label.name = this.labelLblPrefix + this.getIndex(lblIndex, this.labelLblCountDigits);
					// Use for local prefix
					localPrefix = '.' + label.name.toLowerCase() + '_';
					// Next
					lblIndex++;
				break;
				case LabelType.DATA_LBL:
					// Set name
					label.name = this.labelDataLblPrefix + this.getIndex(dataLblIndex, this.labelDataLblCountDigits);
					// Use for local prefix
					localPrefix = '.' + label.name.toLowerCase() + '_';
					// Next
					dataLblIndex++;
				break;
				case LabelType.CODE_LOOP:
					// Set name
					label.name = localPrefix + this.labelLoopPrefix
				break;
				case LabelType.CODE_SUB:
					// Set name
					label.name = this.labelSubPrefix + this.getIndex(subIndex, this.labelSubCountDigits);
					// Next
					subIndex++;
				break;
			}

			// TODO: 2nd pass with index numbers for the local labels
		}
	}

	// Disassemble opcodes together with label names
	protected dissambleOpcodes() {
		let addr = 0;
		while (addr < MAX_MEM_SIZE) {
			// Get opcode
			let opcode = this.memory.getOpcodeAt(addr);

			// Get label name
			let labelName = '';
			if(opcode.valueType != LabelType.NONE) {
				const label = this.labels.get(opcode.value);
				if(label)
					labelName = label.name;
			}

			// Disassemble
			const opCodeString = util.format(opcode.name, labelName);

			// TODO: print references (callers)

			// Check if label needs to be added to line (print label on own line)
			const addrLabel = this.labels.get(addr);
			if(addrLabel) {
				const line1 = addr.toString(16) + '\t' + addrLabel.name + '\n';
				// TODO: print line
			}

			// Add address
			const line = addr.toString(16) + '\t\t' + opCodeString + '\n'

			// Next
			addr += opcode.length;
		}

	}


	/**
	 * Returns the index as string digits are filled to match countDigits.
	 * @param index The index to convert.
	 * @param countDigits The number of digits to use.
	 */
	protected getIndex(index: number, countDigits: number) {
		const str = index.toString();
		return '0'.repeat(countDigits-str.length) + str;
	}
}


	//export default Disassembler;

