import * as util from 'util';
import * as assert from 'assert';
import { Memory, MemAttribute } from './memory';
import { Opcode, OpcodeFlag } from './opcodes';
import { Label, LabelType } from './label';
import { EventEmitter } from 'events';



export class Disassembler extends EventEmitter {

	/// The memory area to disassemble.
	public memory = new Memory();

	/// The labels.
	protected labels = new Map<number,Label>();

	// An array with the (sorted) addresses for all labels
	//protected sortedParentLabelAddresses = new Array<number>();

	/// Queue for start addresses.
	protected addressQueue = new Array<number>();

	/// Choose opcodes in lower or upper case.
	public opcodesLowerCase = true;

	/// Choose opcodes in lower or upper case.
	public hexNumbersLowerCase = false;

	/// Choose how many lines should separate code blocks in the disassembly listing
	public numberOfLinesBetweenBlocks = 2;

	/// Choose if references should be added to SUBs
	public addReferencesToSubroutines = true;

	/// Choose if references should be added to LBLs
	public addReferencesToAbsoluteLabels = true;

	/// Choose if references should be added to DATA labels
	public addReferencesToDataLabels = true;

	/// Choose to start every line with the address
	public startLinesWithAddress = true;


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
		const disLines = this.disassembleMemory();

		// 4. Add all EQU labels to the beginning of the disassembly
		const lines = this.getEquLabelsDisassembly();

		// Add the real disassembly
		lines.push(...disLines);

		// Remove any preceeding empty lines
		while(lines.length) {
			if(lines[0].length > 0)
				break;
			lines.splice(0,1);
		}
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
	 * Adds the addresses from a call table (in memory) to the labels.
	 * @param address Address of the start of the call table.
	 * @param count The number of jmp addresses.
	 */
	public setCallTable(address: number, count: number) {
		// Loop over all jmp addresses
		for(let i=0; i<count; i++) {
			// Get address
			let jmpAddress = this.memory.getWordValueAt(address);
			// Set label
			this.setLabel(jmpAddress);
			// Next
			address += 2;
		}
	}


	/**
	 * Prints all labels to the console.
	 */
	public printLabels() {
		for(let [address, label] of this.labels) {
			// Label
			console.log('0x' + address.toString(16) + ': ' + label.name + ', ' +  label.getTypeAsString() + ', EQU=' + label.isEqu);
			// References
			const refArray = label.references.map(value => '0x'+value.toString(16));
			console.log('\tReferenced by: ' + refArray.toString() );
		}
	}


	/**
	 * Puts all EQU labels in an array of strings.
	 * @returns Array of strings.
	 */
	public getEquLabelsDisassembly(): Array<string> {
		const lines = new Array<string>();
		for(let [address, label] of this.labels) {
			// Check if EQU
			if(label.isEqu) {
				// "Disassemble"
				const line = label.name + ':\t EQU ' + this.fillDigits(address.toString(), ' ', 5) + '\t; ' + this.getVariousConversionsForWord(address);
				// Store
				lines.push(line);
			}
		}
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
	 * All labels are stored into this.labels. At teh end the list is sorted by the address.
	 */
	protected collectLabels() {
		let address;
		let opcode;

		// get new address from queue
		while((address = this.addressQueue.shift()) != undefined) {
			// disassemble until stop-code
			do {
				// Trace address
				console.log('collectLabels: address=' + this.getHexString(address) + 'h');

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

		// Sort all labels by address
		this.labels = new Map([...this.labels.entries()].sort());
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
	 * @param opcodeAddress The address that references the label.
	 * @param type The LabelType.
	 * @param attr The memory attribute at address.
	 */
	protected setFoundLabel(address: number, opcodeAddress: number, type: LabelType, attr: MemAttribute) {
		// Check if label already exists
		let label = this.labels.get(address);
		if(label) {
			// label already exists: prioritize
			if(label.type < type)
				label.type = type;
		}
		else {
			// Label does not exist yet, just add it
			label = new Label(type);
			this.labels.set(address, label);
			// Check if out of range
			if(!(attr & MemAttribute.ASSIGNED))
				label.isEqu = true;
		}

		// Add reference
		label.references.push(opcodeAddress);
	}


	/**
	 * "Disassembles" one label. I.e. the opcode is disassembled and checked if it includes
	 * a label.
	 * If so, the label is stored together with the call infromation.
	 * @param opcode The opcode to search for a label.
	 * @param opcodeAddress The current address.
	 * @returns false if problem occurred.
	 */
	protected disassembleForLabel(opcode: Opcode, opcodeAddress: number): boolean {

		// Check for branching etc. (CALL, JP, JR)
		if(opcode.flags & OpcodeFlag.BRANCH_ADDRESS) {
			// It is a label.

			// Get branching memory attribute
			let branchAddress = opcode.value;
			const attr = this.memory.getAttributeAt(branchAddress);

			// Create new label or prioritize if label already exists
			this.setFoundLabel(branchAddress, opcodeAddress, opcode.valueType, attr);

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
					this.emit('warning', 'Aborting disassembly: Ambiguous disassembly: encountered branch instruction into the middle of an opcode. Opcode "' + opcode.name + '" at address 0x' + opcodeAddress.toString(16) + ' would branch into "' + branchOpcode.name + '" at address 0x' + branchOpcodeAddress.toString(16) + '.');
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
			this.setFoundLabel(address, opcodeAddress, opcode.valueType, attr);
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
		let localPrefix = "lbl0";	// Just in case

		let parentLabel;
		const relLabels = new Array<Label>();
		const relLoopLabels = new Array<Label>();

		// Loop through all labels (labels is sorted by address)
		for( let [,label] of this.labels) {
			const type = label.type;

			// Check for parent label
			if(type == LabelType.CODE_SUB || type == LabelType.CODE_LBL) {
				// process previous local labels
				this.assignRelLabelNames(relLabels, parentLabel);
				this.assignRelLabelNames(relLoopLabels, parentLabel);
				relLabels.length = 0;
				relLoopLabels.length = 0;
				// Store new
				parentLabel = label;
		}

			// Process label
			switch(type) {
				case LabelType.CODE_SUB:
					// Set name
					label.name = this.labelSubPrefix + this.getIndex(subIndex, this.labelSubCountDigits);
					// Use for local prefix
					localPrefix = '.' + label.name.toLowerCase();
					// Next
					subIndex++;
				break;
				case LabelType.CODE_LBL:
					// Set name
					label.name = this.labelLblPrefix + this.getIndex(lblIndex, this.labelLblCountDigits);
					// Use for local prefix
					localPrefix = '.' + label.name.toLowerCase();
					// Next
					lblIndex++;
				break;
				case LabelType.DATA_LBL:
					// Set name
					label.name = this.labelDataLblPrefix + this.getIndex(dataLblIndex, this.labelDataLblCountDigits);
					// Use for local prefix
					localPrefix = '.' + label.name.toLowerCase();
					// Next
					dataLblIndex++;
				break;
				case LabelType.CODE_RELATIVE_LOOP:
					// Set name
					label.name = localPrefix + this.labelLoopPrefix;
					// Remember label
					relLoopLabels.push(label);
				break;
				case LabelType.CODE_RELATIVE_LBL:
					// Set name
					label.name = localPrefix + this.labelLocalLablePrefix;
					// Remember label
					relLabels.push(label);
				break;
			}
		}

		// Process the last relative labels
		this.assignRelLabelNames(relLabels, parentLabel);
		this.assignRelLabelNames(relLoopLabels, parentLabel);
	}


	/**
	 * Adds the indexes and the parentLAbel to the relative labels.
	 * @param relLabels The relative (relative or loop) labels within a parent.
	 * @param parentLabel The parentLabel (SUB or LBL)
	 */
	protected assignRelLabelNames(relLabels: Array<Label>, parentLabel: Label) {
		const count = relLabels.length;
		if(count == 1) {
			// No index in case there is only one index
			relLabels[0].parent = parentLabel;
			return;
		}
		// Normal loop (>=2 entries)
		const digitCount = count.toString().length;
		let index = 1;
		for(let relLabel of relLabels) {
			const indexString = this.getIndex(index, digitCount);
			relLabel.name += indexString;
			relLabel.parent = parentLabel;
			// next
			index ++;
		}
	}


	/**
	 * Disassemble opcodes together with label names
	 * Returns an array of strings whichcontains the disassembly.
	 * @returns The disassembly.
	 */
	protected disassembleMemory(): Array<string> {
		let lines = new Array<string>();

		// Loop over all labels
		let address = 0;
		for(const [addr,] of this.labels) {
			// Check if address has already been disassembled
			if(addr < address)
				continue;
			// Check if it is a code label

			// Use address
			address = addr;

			// disassemble until stop-code
			while(true) {
				// Check if memory has already been disassembled
				let attr = this.memory.getAttributeAt(address);
				if(!(attr & MemAttribute.ASSIGNED)) {
					break;	// E.g. an EQU label
				}

				// Check if label needs to be added to line (print label on own line)
				const addrLabel = this.labels.get(address);
				if(addrLabel) {
					// Add empty lines in case this is a SUB or LBL label
					const type = addrLabel.type;
					if(type == LabelType.CODE_SUB || type == LabelType.CODE_LBL || type == LabelType.DATA_LBL) {
						this.addEmptyLines(lines);
					}
					// Add comment with references
					if((type == LabelType.CODE_SUB && this.addReferencesToSubroutines)
					|| (type == LabelType.CODE_LBL && this.addReferencesToAbsoluteLabels)
					|| (type == LabelType.DATA_LBL && this.addReferencesToDataLabels)) {
						// First line: Reference count
						const refCount = addrLabel.references.length;
						let refLine = (type == LabelType.CODE_SUB) ? '; Subroutine' : '; Label';
						refLine += ' is referenced by ' + refCount + ' location';
						if(refCount != 1)
							refLine += 's';
						refLine += (refCount > 0) ? ':' : '.'
						lines.push(refLine);
						if(refCount > 0) {
							// Second line: The references
							const refArray = addrLabel.references.map(addr => {
								let s = '0x'+addr.toString(16);
								const parentLabel = this.getParentLabel(addr);
								if(parentLabel) {
									// Add e.g. start of subroutine
									s += '(in ' + parentLabel.name + ') ';
								}
								return s;
							});
							refLine = '; ' + refArray.toString();
							lines.push(refLine);
						}
					}

					// Add label on separate line
					let labelLine = addrLabel.name + ':';
					if(this.startLinesWithAddress) {
						labelLine =  this.getHexString(address) + '\t' + labelLine;
					}
					lines.push(labelLine);
				}

				// Check if code or data should be disassembled
				if(attr & MemAttribute.CODE) {
					// CODE

					// Read opcode at address
					const opcode = this.memory.getOpcodeAt(address);

					// Disassemble the single opcode
					const opCodeString = this.disassembleOpcode(opcode);
					let line = '\t' + opCodeString;

					// Add address
					if(this.startLinesWithAddress) {
						line = this.getHexString(address) + '\t' + line;
					}

					// Store
					lines.push(line);

					// Next address
					address += opcode.length;

					// Stop diassembly?
					if(opcode.flags & OpcodeFlag.STOP)
						break;
				}

				else {
					// DATA

					// Read memory value at address
					let memValue = this.memory.getValueAt(address);

					// Disassemble the data line
					let line = '\t defb ' + memValue.toString() + '\t; ' + this.getVariousConversionsForByte(memValue);

					// Add address
					if(this.startLinesWithAddress) {
						line = this.getHexString(address) + '\t' + line;
					}

					// Store
					lines.push(line);

					// Next address
					address ++;

					// Note:
					// For data there is no stop-code. I.e. data is disassembled as long as there is no CODE area found. Then in the CODE area a stop-condition might be found.
				}
				// Check for stop code. (JP, JR, RET)
			}
		}

		// Return
		return lines;
	}


	/**
	 * Disassembles one opcode together with a referenced label (if there
	 * is one).
	 * @param opcode The Opcode to disassemble.
	 * @returns A string that contains the disassembly, e.g. "LD A,(DATA_LBL1)"
	 * or "JR Z,.sub1_lbl3".
	 */
	protected disassembleOpcode(opcode: Opcode) {
		// optional comment
		let comment = '';

		// Check if there is any value
		if(opcode.valueType == LabelType.NONE) {
			let name = opcode.name;
			if(this.opcodesLowerCase)
				name = name.toLowerCase();
			return name;
		}

		// Get referenced label name
		let valueName = '';
		if(opcode.valueType == LabelType.CODE_LBL
			|| opcode.valueType == LabelType.CODE_RELATIVE_LBL
			|| opcode.valueType == LabelType.CODE_RELATIVE_LOOP
			|| opcode.valueType == LabelType.CODE_SUB
			|| opcode.valueType == LabelType.DATA_LBL) {
			const label = this.labels.get(opcode.value);
			if(label)
				valueName = label.name;
		}
		else {
			// Use direct value
			let val = opcode.value;
			valueName = val.toString();	// decimal
			// Add comment
			if(opcode.valueType == LabelType.NUMBER_BYTE) {
				// byte
				comment = '\t; ' + this.getVariousConversionsForByte(val);
			}
			else {
				// word
				comment = '\t; ' + this.getVariousConversionsForWord(val);
			}
		}

		// Disassemble
		let name = opcode.name;
		if(this.opcodesLowerCase)
			name = name.toLowerCase();
		const opCodeString = util.format(name, valueName) + comment;
		return opCodeString;
	}


	/**
	 * Finds the parent label. I.e. the first non relative label that is lower than the given address.
	 * @param address
	 */
	protected getParentLabel(address: number): Label|undefined {
		let prevLabel;
		for(let [addr, label] of this.labels) {
			const type = label.type;
			if(type == LabelType.CODE_SUB || type == LabelType.CODE_LBL) {
				if(addr >= address) {
					// found
					return prevLabel;
				}
				// store previous
				prevLabel = label;
			}
		}
		// Nothing found
		return undefined;
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


	/**
	 * Adds empty lines to the given array.
	 * The count depends on 'numberOfLinesBetweenBlocks'.
	 * @param lines Array to add the empty lines.
	 */
	protected addEmptyLines(lines: Array<string>) {
		for(let i=0; i<this.numberOfLinesBetweenBlocks; i++) {
			lines.push('');
		}
	}


	/**
	 * Returns a hex string with a fixed number of digits.
	 * @param value The value to convert.
	 * @param countDigits The number of digits.
	 * @returns a string, e.g. "04fd".
	 */
	protected getHexString(value:number, countDigits = 4): string {
		let s = value.toString(16);
		if(!this.hexNumbersLowerCase)
			s = s.toUpperCase();
		return this.fillDigits(s, '0', countDigits);
	}


	/**
	 * If string is smaller than countDigits the string is filled with 'fillCharacter'.
	 * Used to fill a number up with '0' or spaces.
	 */
	protected fillDigits(valueString:string, fillCharacter: string, countDigits: number): string {
		const repeat = countDigits-valueString.length;
		if(repeat <= 0)
			return valueString;
		const res = fillCharacter.repeat(repeat) + valueString;
		return res;
	}


	/**
	 * Puts together a few common conversions for a byte value.
	 * E.g. hex, decimal and ASCII.
	 * Used to create the comment for an opcode or a data label.
	 * @param byteValue The value to convert. [-128;255]
	 * @returns A string with all conversions, e.g. "20h, 32, ' '"
	 */
	protected getVariousConversionsForByte(byteValue: number): string {
		// byte
		if(byteValue < 0)
			byteValue = 0x100 + byteValue;
		let result = this.getHexString(byteValue, 2) + "h";
		// Negative?
		let convValue = byteValue;
		if(convValue >= 0x80) {
			convValue -= 0x100;
			result += ', ' + this.fillDigits(convValue.toString(), ' ', 4);
		}
		// Check for ASCII
		if(byteValue >= 32 /*space*/ && byteValue <= 126 /*tilde*/)
			result += ", '" + String.fromCharCode(byteValue) + "'";
		// return
		return result;
	}


	/**
	 * Puts together a few common conversions for a word value.
	 * E.g. hex and decimal.
	 * Used to create the comment for an EQU label.
	 * @param wordValue The value to convert.
	 * @returns A string with all conversions, e.g. "FA20h, -3212"
	 */
	protected getVariousConversionsForWord(wordValue: number): string {
		// word
		let result = this.getHexString(wordValue) + 'h';
		// Negative?
		let convValue = wordValue;
		if(convValue >= 0x8000) {
			convValue -= 0x10000;
			result += ', ' + this.fillDigits(convValue.toString(), ' ', 6);
		}
		// return
		return result;
	}
}


	//export default Disassembler;

