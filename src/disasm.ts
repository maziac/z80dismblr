import * as util from 'util';
import * as assert from 'assert';
import { Memory, MemAttribute, MAX_MEM_SIZE } from './memory';
import { Opcode, OpcodeFlag } from './opcodes';
import { Label, LabelType } from './label';
import { EventEmitter } from 'events';



export class Disassembler extends EventEmitter {

	/// The memory area to disassemble.
	public memory = new Memory();

	/// The labels.
	protected labels = new Map<number,Label>();

	/// Queue for start addresses.
	protected addressQueue = new Array<number>();

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
	protected labelSubCount;
	protected labelLblCount;
	protected labelDataLblCount;


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
	 * You can set one (or more) initial labels here.
	 * At least one lable should be set, so that the disassembly
	 * algorithm knows wehre to start from.
	 * More labels could be set e.g. to tell where the interrupt starts at.
	 * Optionally a name for the label can be given.
	 * @param address The address of the label.
	 * @param name An optional name for the label.
	 */
	public setLabel(address: number, name?: string) {
		this.addressQueue.push(address);
		const label = new Label(LabelType.CODE_LBL);
		this.labels.set(address, label);
		// Check if out of range
		const attr = this.memory.getAttributeAt(address);
		if(!(attr & MemAttribute.ASSIGNED))
			label.isEqu = true;

		// TODO: use name
	}


	/**
	 * Prints all labels to the console.
	 */
	public printLabels() {
		for(let [address, label] of this.labels) {
			console.log( '0x' + address.toString(16) + ': ' + label.name + ', ' +  label.getTypeAsString() + ', EQU=' + label.isEqu);
		}
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
		let address;
		let opcode;

		// get new address from queue
		while((address = this.addressQueue.shift()) != undefined) {
			// disassemble until stop-code
			do {
				// Check if memory has already been disassembled
				let attr = this.memory.getAttributeAt(address);
				if(attr & MemAttribute.CODE)
					break;	// Yes, already disassembled
				if(!(attr & MemAttribute.ASSIGNED)) {
					// Error: tying to disassemble unassigned memory areas
					this.emit('warning', 'Warning: Trying to disassemble unassigned memory area at 0x' + address.toString(16) + '.');
					break;
				}

				// Read memory value
				opcode = this.memory.getOpcodeAt(address);

				// Check if memory area has already been PARTLY disassembled
				const len = opcode.length;
				let memAddress = address;
				for(let i=1; i<len; i++) {
					memAddress ++;
					attr = this.memory.getAttributeAt(memAddress);
					if(attr & MemAttribute.CODE) {
						// It has already been disassembled -> error.
						assert(attr & MemAttribute.CODE_FIRST, 'Internal error: Expected CODE_FIRST');
						const otherOpcode = this.memory.getOpcodeAt(memAddress);
						// emit warning
						this.emit('warning', 'Aborting disassembly: Ambiguous disassembly: Trying to disassemble opcode "' + opcode.name + '" at address 0x' + address.toString(16) + ' but address 0x' + memAddress.toString(16) + ' alrady contains opcode "' + otherOpcode.name + '".');
						return;
					}
				}

				// Mark memory area
				this.memory.addAttributeAt(address, 1, MemAttribute.CODE_FIRST);
				this.memory.addAttributeAt(address, opcode.length, MemAttribute.CODE);

				// Check opcode for labels
				if(!this.disassembleForLabel(opcode, address))
					return;

				// Check for stop code. (JP, JR, RET)
				if(opcode.flags & OpcodeFlag.STOP)
					break;

				// Next address
				address += opcode.length;

				// Check for end of disassembly (JP, RET)
			} while(!(opcode.flags & OpcodeFlag.STOP));
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
	 * Sets or creates a label and sets its type.
	 * @param address The address for the label.
	 * @param type The LabelType.
	 * @param attr The memory attribute at address.
	 */
	protected setFoundLabel(address: number, type: LabelType, attr: MemAttribute) {
		// Check if label already exists
		const label = this.labels.get(address);
		if(label) {
			// label already exists: prioritize
			if(label.type < type)
				label.type = type;
		}
		else {
			// Label does not exist yet, just add it
			const label = new Label(type);
			this.labels.set(address, label);
			// Check if out of range
			if(!(attr & MemAttribute.ASSIGNED))
				label.isEqu = true;
		}

	}

	/**
	 * "Disassembles" one label. I.e. the opcode is disassembled and checked if it includes
	 * a label.
	 * If so, the label is stored together with the call infromation.
	 * @param opcode The opcode to search for a label.
	 * @param address The current address. (Used only for warning)
	 * @returns false if problem occurred.
	 */
	protected disassembleForLabel(opcode: Opcode, address: number): boolean {
		/*
		// Decode label
		let createNewLabel = false;
		switch(opcode.valueType) {
			case LabelType.CODE_LBL:
			case LabelType.CODE_SUB:
			case LabelType.DATA_LBL:
			case LabelType.CODE_RELATIVE_LBL:
			case LabelType.CODE_RELATIVE_LOOP:
				// Use label
				createNewLabel = true;
				break;
			case LabelType.NUMBER_WORD:
				// use word as label only under certain circumstances
				/* TODO: no idea yet how to handle this:
				if(this.useNumberAsLabel(opcode.value))
					createNewLabel = true;
				/
			break;
			case LabelType.NUMBER_BYTE:
				// byte value -> no label
			break;
			default:
				// no label
			break;
		}
		*/

		// Check for branching etc. (CALL, JP, JR)
		if(opcode.flags & OpcodeFlag.BRANCH_ADDRESS) {
			// It is a label.

			// Get branching memory attribute
			let branchAddress = opcode.value;
			const attr = this.memory.getAttributeAt(branchAddress);

			// Create new label or prioritize if label already exists
			this.setFoundLabel(branchAddress, opcode.valueType, attr);

			// Check if code from the branching address has already been disassembled
			if(attr & MemAttribute.CODE) {
				// It has already been disassembled
				if(!(attr & MemAttribute.CODE_FIRST)) {
					// The branch address would jump into the middle of an instruction -> error
					let branchOpcodeAddress = branchAddress;
					do {	// Find start of opcode.
						branchOpcodeAddress --;
						assert(branchAddress-branchOpcodeAddress > 4, 'Internal error: Could not find start of opcode.');
					} while(!(this.memory.getAttributeAt(branchOpcodeAddress) & MemAttribute.CODE_FIRST));
					// Get opcode to branch to
					const branchOpcode = this.memory.getOpcodeAt(branchOpcodeAddress);
					// emit warning
					this.emit('warning', 'Aborting disassembly: Ambiguous disassembly: encountered branch instruction into the middle of an opcode. Opcode "' + opcode.name + '" at address 0x' + address.toString(16) + ' would branch into "' + branchOpcode.name + '" at address 0x' + branchOpcodeAddress.toString(16) + '.');
					return false;
				}
			}
			else {
				// It has not been disassembled yet
				if(attr & MemAttribute.ASSIGNED) {
					// memory location exists, so queue it for disassembly
					this.addressQueue.push(branchAddress);
				}
			}
		}
		else if(opcode.valueType == LabelType.DATA_LBL) {
			// It's a data label, like "LD A,(nn)"
			const address = opcode.value;
			const attr = this.memory.getAttributeAt(address);

			// Create new label or prioritize if label already exists
			this.setFoundLabel(address, opcode.valueType, attr);
		}

		// Everything fine
		return true;
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
		this.labelSubCountDigits = 4;
		this.labelLblCountDigits = 4;
		this.labelDataLblCountDigits = 4;
		this.labelSubCount = 0;
		this.labelLblCount = 0;
		this.labelDataLblCount = 0;

		// Loop through all labels
		for( let [,label] of this.labels) {
			switch(label.type) {
				case LabelType.CODE_SUB:
					this.labelSubCount++;
				break;
				case LabelType.CODE_LBL:
					this.labelLblCount++;
				break;
				case LabelType.DATA_LBL:
					this.labelDataLblCount++;
				break;
			}
		}

		// Calculate digit counts
		this.labelSubCountDigits = this.labelSubCount.toString().length;
		this.labelLblCountDigits = this.labelLblCount.toString().length;
		this.labelDataLblCountDigits = this.labelDataLblCount.toString().length;
	}


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
				case LabelType.CODE_RELATIVE_LOOP:
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

