//import * as util from 'util';
import * as assert from 'assert';
import { Memory, MAX_MEM_SIZE } from './memory';
//import { Opcode } from './opcodes';
import { Label, LabelType } from './label';


//var assert = require('assert');


/// For storing info about the label.
interface LabelInfo {
	/// The name of the label.
	name: string;

	/// The type of the label
	type: LabelType;
}

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
		switch(opcode.valueType) {
			case LabelType.CODE_LBL:
			case LabelType.CODE_SUB:
			case LabelType.DATA_LBL:
			case LabelType.CODE_LOCAL_LBL:
			case LabelType.CODE_LOOP:
				// Use label
				this.labels.set(addr, new Label(opcode.valueType));
				break;
			case LabelType.NUMBER_WORD:
				// use word as label only under ceratin circumstances
				if(this.useNumberAsLabel(opcode.value))
					this.labels.set(addr, new Label(opcode.valueType));
			break;
			case LabelType.NUMBER_BYTE:
				// byte value -> no label
			break;
			default:
				assert(false);
			break;
		}

		// Next
		return addr + opcode.length;
	}

}


	//export default Disassembler;

