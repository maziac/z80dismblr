//import * as util from 'util';
import * as assert from 'assert';
import { Memory, MemAttribute } from './memory';
import { Opcode, OpcodeFlag } from './opcode';
import { NumberType } from './numbertype'
import { Label } from './label'
import { EventEmitter } from 'events';
import { Format } from './format';
import { readFileSync } from 'fs';



export class Disassembler extends EventEmitter {

	/// The memory area to disassemble.
	public memory = new Memory();

	/// The labels.
	protected labels = new Map<number,Label>();

	/// Temporarily offset labels. Just an offset number ot the address of the real label.
	protected offsetLabels = new Map<number,number>();

	// An array with the (sorted) addresses for all labels
	//protected sortedParentLabelAddresses = new Array<number>();

	/// Queue for start addresses only addresses of opcodes
	protected addressQueue = new Array<number>();

	/// Choose opcodes in lower or upper case.
	public opcodesLowerCase = true;

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

	/// Choose to add the opcode bytes also, e.g. "CB 01" for "RLC C"
	public addOpcodeBytes = true;

	/// Label prefixes
	public labelSubPrefix = "SUB";
	public labelLblPrefix = "LBL";
	public labelRstPrefix = "RST";
	public labelDataLblPrefix = "DATA";
	public labelSelfModifyingPrefix = "SELF_MOD";
	public labelLocalLablePrefix = "_l";
	public labelLoopPrefix = "_loop";

	/// The calculated number of occurences of a label type.
	protected labelSubCountDigits;
	protected labelLblCountDigits;
	protected labelDataLblCountDigits;
	protected labelSelfModifyingCountDigits;
	protected labelSubCount;
	protected labelLblCount;
	protected labelDataLblCount;
	protected labelSelfModifyingCount;

	/// Column areas. e.g. area for the bytes shown before each command
	public clmsAddress = 5;		///< size for the starting address (if any)
	public clmnsBytes = 4*3 + 1;	///< 4* length of hex-byte
	public clmnsOpcodeFirstPart = 4 + 1;	///< First part of the opcodes, e.g. "LD" in "LD A,7"
	public clmsnOpcodeTotal = 5 + 6 + 1;		///< Total length of the opcodes. After this an optional comment may start.

	/// For debugging:
	protected DBG_COLLECT_LABELS = 0;


	/**
	 * Initializes the Opcode formatting.
	 */
	constructor() {
		super();
		Opcode.setConvertToLabelHandler(value => {
			let valueName;
			let label;
			let offsString = '';
			if(this.labels)
				label = this.labels.get(value);
			if(!label) {
				// Check for offset label
				const offs = this.offsetLabels.get(value);
				if(offs) {
					label = this.labels.get(value+offs);
					if(label)
						offsString = (offs > 0) ? ''+(-offs) : '+'+(-offs);
				}
			}
			if(label)
				valueName = label.name + offsString;
			return valueName;
		});
	}


	/**
	 * Disassembles the  memory area.
	 * Disassembly is done in a few passes.
	 * @returns An array of strings with the disassembly.
	 */
	public disassemble(): Array<string> {
		// 1. Pass: Collect labels
		this.collectLabels();

		// 2. Find self-modifying code
		this.adjustSelfModifyingLabels();

		// 3. Count number of types of labels
		this.countTypesOfLabels();

		// 4. Assign label names
		this.assignLabelNames();

		// 5. Pass: Disassemble opcode with label names
		const disLines = this.disassembleMemory();

		// 6. Add all EQU labels to the beginning of the disassembly
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
	 * Define the memory area to disassemble.
	 * @param origin The start address of the memory area.
	 * @param memory The memory area.
	 */
	public setMemory(origin:number, memory: Uint8Array) {
		this.memory.setMemory(origin, memory);
		// Set start label
		this.setLabel(origin, 'BIN_START_'+origin, NumberType.DATA_LBL);
		//const size = memory.length;
		//this.setLabel(origin+size, 'BIN_END_'+origin, NumberType.DATA_LBL);
	}


	/**
	 * Reads a memory area as binary from a file.
	 * @param origin The start address of the memory area.
	 * @param path The file path to a binary file.
	 */
	public readBinFile(origin: number, path: string) {
		const bin = readFileSync(path);
		this.setMemory(origin, bin);
	}

	/**
	 * Reads a .sna (ZX snapshot) file directly. Takes the start address from the .sna file.
	 * @param path The file path to a binary file.
	 */
	public readSnaFile(path: string) {
		let sna = readFileSync(path);
		const header = sna.slice(0, 27);
		const bin = sna.slice(27);
		// Read start address
		const sp = header[23] + 256*header[24];	// Stackpointer
		const start = bin[sp-0x4000] + 256*bin[sp-1-0x4000];	// Get start address from stack
		this.setMemory(0x4000, bin);
		// Set start label
		this.setLabel(start, 'LBL_MAIN_START_'+start, NumberType.CODE_LBL);
	}


	/**
	 * You can set one (or more) initial labels here.
	 * At least one lable should be set, so that the disassembly
	 * algorithm knows where to start from.
	 * More labels could be set e.g. to tell where the interrupt starts at.
	 * Optionally a name for the label can be given.
	 * @param address The address of the label.
	 * @param name An optional name for the label.
	 * @param type of the label. Default is CODE_LBL.
	 */
	public setLabel(address: number, name?: string, type = NumberType.CODE_LBL) {
		const label = new Label(type);
		this.labels.set(address, label);
		(label.name as any) = name;	// allow undefined
		// Check if out of range
		const attr = this.memory.getAttributeAt(address);
		if(attr & MemAttribute.ASSIGNED) {
			if(type == NumberType.CODE_LBL
				|| type == NumberType.CODE_RELATIVE_LBL
				|| type == NumberType.CODE_RELATIVE_LOOP
				|| type == NumberType.CODE_RST
				|| type == NumberType.CODE_SUB
			)
				this.addressQueue.push(address);
		}
		else {
			// out of range -> EQU
			label.isEqu = true;
		}
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
				const line =  Format.addSpaces(label.name+':', this.clmnsBytes) + this.rightCase('EQU ') + Format.fillDigits(address.toString(), ' ', 5) + ' ; ' + Format.getVariousConversionsForWord(address);
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
			//console.log('address=0x' + address.toString(16));
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
				opcode = Opcode.getOpcodeAt(this.memory, address);
				if(this.DBG_COLLECT_LABELS)
					console.log(Format.getHexString(address) + '\t' + opcode.disassemble(undefined, true).mnemonic)

				// Check if memory area has already been PARTLY disassembled
				const len = opcode.length;
				let memAddress = address;
				for(let i=1; i<len; i++) {
					memAddress ++;
					attr = this.memory.getAttributeAt(memAddress);
					if(attr & MemAttribute.CODE) {
						// It has already been disassembled -> error.
						assert(attr & MemAttribute.CODE_FIRST, 'Internal error: Expected CODE_FIRST');
						const otherOpcode = Opcode.getOpcodeAt(this.memory, memAddress);
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

			if(this.DBG_COLLECT_LABELS)
				console.log('\n');
		}

		// Sort all labels by address
		this.labels = new Map([...this.labels.entries()].sort(([a], [b]) => a-b ));
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
	 * @param referenceAddresses Array with addresses that reference the label. Usually only the opcode address.
	 * @param type The LabelType.
	 * @param attr The memory attribute at address.
	 */
	protected setFoundLabel(address: number, referenceAddresses: number[], type: NumberType, attr: MemAttribute) {
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
		label.references.push(...referenceAddresses);
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
			let vType = opcode.valueType;
			if(vType == NumberType.CODE_RELATIVE_LBL) {
				// A relative jump backwards will become a "loop"
				if(branchAddress <= opcodeAddress)
					vType = NumberType.CODE_RELATIVE_LOOP;
			}
			this.setFoundLabel(branchAddress, [opcodeAddress], vType, attr);

			// Check if code from the branching address has already been disassembled
			if(attr & MemAttribute.CODE) {
				// It has already been disassembled
				if(!(attr & MemAttribute.CODE_FIRST)) {
					// The branch address would jump into the middle of an instruction -> error
					let branchOpcodeAddress = branchAddress;
					do {	// Find start of opcode.
						branchOpcodeAddress --;
						if(branchAddress-branchOpcodeAddress > 4)
							assert(false, 'Internal error: Could not find start of opcode.');
					} while(!(this.memory.getAttributeAt(branchOpcodeAddress) & MemAttribute.CODE_FIRST));
					// Get opcode to branch to
					const branchOpcode = Opcode.getOpcodeAt(this.memory, branchOpcodeAddress);
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
		else if(opcode.valueType == NumberType.DATA_LBL) {
			// It's a data label, like "LD A,(nn)"
			const address = opcode.value;
			const attr = this.memory.getAttributeAt(address);

			// Create new label or prioritize if label already exists
			this.setFoundLabel(address, [opcodeAddress], opcode.valueType, attr);
		}

		// Everything fine
		return true;
	}


	/**
	 * Finds data labels that point into code areas.
	 * If the pointer points to the start of the opcode nothing needs to be done here.
	 * Everything is handled by the assignLabelNames method.
	 * But if the pointer points into the middle of an instruction the label
	 * need to be adjusted:
	 * 1. The current label is exchanged with an offset label
	 * 2. Another label is created at the start of the opcode.
	 */
	protected adjustSelfModifyingLabels() {
		const changeMap = new Map<number,Label>();

		// Loop through all labels
		for( let [address, label] of this.labels) {
			switch(label.type) {
				case NumberType.DATA_LBL:
					const memAttr = this.memory.getAttributeAt(address);
					if(memAttr & MemAttribute.CODE) {
						if(!(memAttr & MemAttribute.CODE_FIRST)) {
							// Hit in the middle of an opcode.
							// Remember to change:
							changeMap.set(address, label);
						}
					}
				break;
			}
		}

		// Now change labels in original map
		for( let [address, label] of changeMap) {
			// Search start of opcode.
			let addrStart = address;
			let attr;
			do {
				addrStart--;
				assert(address - addrStart <= 4);	// Opcode should be smaller than 5 bytes
				attr = this.memory.getAttributeAt(addrStart);
			} while(!(attr & MemAttribute.CODE_FIRST));
			// Use label and put it to the new address
			this.setFoundLabel(addrStart, label.references, label.type, attr);
			// Remove old label
			this.labels.delete(address);
			// Add offset label
			const offs = addrStart - address;	// negative
			this.offsetLabels.set(address, offs);
		}
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
		this.labelSelfModifyingCount = 0;

		// Loop through all labels
		for( let [address,label] of this.labels) {
			switch(label.type) {
				case NumberType.CODE_SUB:
					this.labelSubCount++;
				break;
				case NumberType.CODE_LBL:
					this.labelLblCount++;
				break;
				case NumberType.DATA_LBL:
					const memAttr = this.memory.getAttributeAt(address);
					if(memAttr & MemAttribute.CODE) {
						this.labelSelfModifyingCount++;
					}
					else {
						this.labelDataLblCount++;
					}
				break;
			}
		}

		// Calculate digit counts
		this.labelSubCountDigits = this.labelSubCount.toString().length;
		this.labelLblCountDigits = this.labelLblCount.toString().length;
		this.labelDataLblCountDigits = this.labelDataLblCount.toString().length;
		this.labelSelfModifyingCountDigits = this.labelSelfModifyingCount.toString().length;
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
		let dataSelfModifyingIndex = 1;	// SELF_MOD

		// prefixes for the local labels are dependent on the surrounding code (e.g. sub routine)
		let localPrefix = "lbl0";	// Just in case

		let parentLabel;
		const relLabels = new Array<Label>();
		const relLoopLabels = new Array<Label>();

		// Loop through all labels (labels is sorted by address)
		for( let [address,label] of this.labels) {
			// Check if label was already set (e.g. from commandline)
			if(label.name)
				continue;

			// Check for parent label
			const type = label.type;
			if(type == NumberType.CODE_SUB || type == NumberType.CODE_LBL || type == NumberType.CODE_RST) {
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
				case NumberType.CODE_SUB:
					// Set name
					label.name = this.labelSubPrefix + this.getIndex(subIndex, this.labelSubCountDigits);
					// Use for local prefix
					localPrefix = '.' + label.name.toLowerCase();
					// Next
					subIndex++;
				break;
				case NumberType.CODE_LBL:
					// Set name
					label.name = this.labelLblPrefix + this.getIndex(lblIndex, this.labelLblCountDigits);
					// Use for local prefix
					localPrefix = '.' + label.name.toLowerCase();
					// Next
					lblIndex++;
				break;
				case NumberType.CODE_RST:
					// Set name
					label.name = this.labelRstPrefix + Format.fillDigits(address.toString(), '0', 2);
					// Use for local prefix
					localPrefix = '.' + label.name.toLowerCase();
					// Next
					lblIndex++;
				break;
				case NumberType.DATA_LBL:
					// Check for self.modifying code
					const memAttr = this.memory.getAttributeAt(address);
					if(memAttr & MemAttribute.CODE) {
						assert(memAttr & MemAttribute.CODE_FIRST);
						// Yes, is self-modifying code.
						// Set name
						label.name = this.labelSelfModifyingPrefix + this.getIndex(dataSelfModifyingIndex, this.labelSelfModifyingCountDigits);
						// Next
						dataSelfModifyingIndex++;
					}
					else {
						// Normal data area.
						// Set name
						label.name = this.labelDataLblPrefix + this.getIndex(dataLblIndex, this.labelDataLblCountDigits);
						// Next
						dataLblIndex++;
					}
					// Use for local prefix
					// localPrefix = '.' + label.name.toLowerCase();
				break;
				case NumberType.CODE_RELATIVE_LOOP:
					// Set name
					label.name = localPrefix + this.labelLoopPrefix;
					// Remember label
					relLoopLabels.push(label);
				break;
				case NumberType.CODE_RELATIVE_LBL:
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

		// Check if anything to disassemble
		if(this.labels.size == 0)
			return lines;

		// Loop over all labels
		let address = -1;
		for(const [addr, label] of this.labels) {
			// If first line, print ORG
			if(address == -1) {
				// First line
				if(label.isEqu)
					continue;	// Skip EQUs
				// Print "ORG"
				this.addEmptyLines(lines);
				const orgLine =  ' '.repeat(this.clmnsBytes) + this.rightCase('ORG ') + Format.fillDigits(addr.toString(), ' ', 5) + ' ; ' + Format.getConversionForAddress(addr);
				lines.push(orgLine);
			}
			else {
				// Normal case. All other lines but first line.
				// Check if address has already been disassembled
				const defsSize = addr - address;
				if(defsSize < 0)
					continue;

				// Check if there is a defs-area (e.g. an undefined are between 2 mem blocks)
				if( defsSize > 0) {
					// Print "DEFS"
					this.addEmptyLines(lines);
					const defsString = this.rightCase('DEFS ') + defsSize;
					const comment = Format.getHexString(defsSize) + 'h, undefined data';
					let line = this.formatDisassembly(address, 0, defsString, comment);
					lines.push(line);
				}
			}

			// Use address
			address = addr;
			let prevMemoryAttribute = MemAttribute.DATA;

			// disassemble until stop-code
			while(true) {
				//console.log('disMem: address=0x' + address.toString(16))
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
					if(type == NumberType.CODE_SUB || type == NumberType.CODE_LBL || type == NumberType.DATA_LBL) {
						this.addEmptyLines(lines);
					}
					// Add comment with references
					if((type == NumberType.CODE_SUB && this.addReferencesToSubroutines)
					|| (type == NumberType.CODE_LBL && this.addReferencesToAbsoluteLabels)
					|| (type == NumberType.DATA_LBL && this.addReferencesToDataLabels)) {
						// First line: Reference count
						const refCount = addrLabel.references.length;
						let refLine = (type == NumberType.CODE_SUB) ? '; Subroutine' : '; Label';
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
									s += '(in ' + parentLabel.name + ')';
								}
								return s;
							});
							refLine = '; ' + refArray.join(', ');
							lines.push(refLine);
						}
					}

					// Add label on separate line
					let labelLine = addrLabel.name + ':';
					if(this.startLinesWithAddress) {
						labelLine =   Format.addSpaces(Format.getHexString(address), this.clmsAddress)+ labelLine;
					}
					lines.push(labelLine);
				}

				// Check if code or data should be disassembled
				let addAddress;
				let line;
				if(attr & MemAttribute.CODE) {
					// CODE

					// Read opcode at address
					const opcode = Opcode.getOpcodeAt(this.memory, address);

					// Disassemble the single opcode
					const opCodeDescription = opcode.disassemble();
					line = this.formatDisassembly(address, opcode.length, opCodeDescription.mnemonic, opCodeDescription.comment);

					addAddress = opcode.length;
				}

				else {
					// DATA
					if(!(prevMemoryAttribute & MemAttribute.DATA))
						this.addEmptyLines(lines);

					// Turn memory to data memory
					attr |= MemAttribute.DATA;

					// Read memory value at address
					let memValue = this.memory.getValueAt(address);

					// Disassemble the data line
					let mainString = this.rightCase('DEFB ') + memValue;
					let comment = Format.getVariousConversionsForByte(memValue);
					line = this.formatDisassembly(address, 1, mainString, comment);

					// Next address
					addAddress = 1;
				}

				// Store
				lines.push(line);

				// Next address
				address += addAddress;

				// Check if the next address is not assigned and put out a comment
				let attrEnd = this.memory.getAttributeAt(address);
				if(!(attrEnd & MemAttribute.ASSIGNED)) {
					lines.push('; End of assigned memory area');
				}

				prevMemoryAttribute = attr;
				// Log
//				console.log('DISASSEMBLY: ' + lines[lines.length-1]);
			}
		}

		// Return
		return lines;
	}


	/**
	 * Formats a disassembly string for output.
	 * @param address The address (for conditional output of the opcode byte values)
	 * @param size The size of the opcode.
	 * @param mainString The opcode string, e.g. "LD HL,35152"
	 * @param commentString An optional comment string.
	 */
	protected formatDisassembly(address: number, size: number, mainString: string, commentString?: string): string {
		let line = '';

		// Add address field?
		if(this.startLinesWithAddress) {
			line = Format.addSpaces(Format.getHexString(address)+' ', this.clmsAddress);
		}

		// Add bytes of opcode?
		let bytesString = '';
		if(this.addOpcodeBytes) {
			for(let i=0; i<size; i++) {
				const memVal = this.memory.getValueAt(address+i);
				bytesString += Format.getHexString(memVal, 2) + ' ';
			}
		}
		line += Format.addSpaces(bytesString, this.clmnsBytes);

		// Add opcode (or defb)
		const arr = mainString.split(' ');
		assert(arr.length > 0);
		arr[0] = Format.addSpaces(arr[0], this.clmnsOpcodeFirstPart-1);	// 1 is added anyway when joining
		let resMainString = arr.join(' ');
		resMainString = Format.addSpaces(resMainString+' ', this.clmsnOpcodeTotal);
		line +=  this.rightCase(resMainString);

		// Add comment
		if(commentString && commentString.length > 0) {
			line += '; ' + commentString;
		}

		// return
		return line;
	}


	/**
	 * Finds the parent label. I.e. the first non relative label that is lower than the given address.
	 * @param address
	 */
	protected getParentLabel(address: number): Label|undefined {
		let prevLabel;
		for(let [addr, label] of this.labels) {
			const type = label.type;
			if(type == NumberType.CODE_SUB || type == NumberType.CODE_LBL) {
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
	 * Depending on 'opcodesLowerCase' the given string will be changed to lowercase.
	 * @param s The string to convert. Must be in upper case.
	 * @returns The same string or the lowercased string.
	 */
	protected rightCase(s: string): string {
		// Lowercase?
		if(this.opcodesLowerCase)
			return s.toLowerCase();
		return s;
	}
}


	//export default Disassembler;

