//import * as util from 'util';
import * as assert from 'assert';
import { Memory, MemAttribute } from './memory';
import { Opcode, OpcodeFlag } from './opcode';
import { NumberType } from './numbertype'
import { DisLabel } from './dislabel'
import { EventEmitter } from 'events';
import { Format } from './format';
import { readFileSync } from 'fs';
import { Reference } from './dislabel';



/// Used for subroutine statistics like size or cyclomatic complexity.
interface SubroutineStatistics {
	/// In case of a SUB routine (or RST): The size of the subroutine in bytes.
	sizeInBytes: number;

	/// In case of a SUB routine (or RST): The size of the subroutine in number of instructions.
	countOfInstructions: number;

	/// In case of a SUB routine (or RST): The Cyclomatic Complexity.
	CyclomaticComplexity: number;
}


/**
 * The main Disassembler class.
 */
export class Disassembler extends EventEmitter {

	/// The memory area to disassemble.
	public memory = new Memory();

	/// The labels.
	protected labels = new Map<number,DisLabel>();

	/// Temporarily offset labels. Just an offset number ot the address of the real label.
	protected offsetLabels = new Map<number,number>();

	/// Queue for start addresses only addresses of opcodes
	protected addressQueue = new Array<number>();

	/// Map for statistics (size of subroutines, cyclomatic complexity)
	protected subroutineStatistics = new Map<DisLabel, SubroutineStatistics>();

	/// Choose opcodes in lower or upper case.
	public opcodesLowerCase = true;

	/// Choose how many lines should separate code blocks in the disassembly listing
	public numberOfLinesBetweenBlocks = 2;

	/// Choose if references should be added to SUBs
	public addReferencesToSubroutines = true;

	/// Choose if references should be added to LBLs
	public addReferencesToAbsoluteLabels = true;

	/// Choose if references should be added to RST labels
	public addReferencesToRstLabels = true;

	/// Choose if references should be added to DATA labels
	public addReferencesToDataLabels = true;

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

	public labelIntrptPrefix = "INTRPT_";


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
	public clmnsAddress = 5;		///< size for the address at the beginning of each line. If 0 no address is shown.
	public clmnsBytes = 4*3 + 1;	///< 4* length of hex-byte
	public clmnsOpcodeFirstPart = 4 + 1;	///< First part of the opcodes, e.g. "LD" in "LD A,7"
	public clmsnOpcodeTotal = 5 + 6 + 1;		///< Total length of the opcodes. After this an optional comment may start.

	/// The disassembled lines.
	protected disassembledLines: Array<string>;

	// The SNA start address.
	protected snaStartAddress = -1;

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
	 * Adds address 0 to the labels if it has not been added already.
	 */
	public addAddress0000() {
		// Check for code label at address 0.
		if(this.memory.getAttributeAt(0) & MemAttribute.ASSIGNED) {
			// Check if label exists
			let label0 = this.labels.get(0);
			if(!label0) {
				this.setFixedCodeLabel(0, this.labelLblPrefix + '_ADDR0000h');
			}
			else {
				// Make sure it is a code label
				label0.type = NumberType.CODE_LBL;
			}
			this.addressQueue.push(0);	// Note: if address 0 was already previously pushed it is now pushed again. But it doesn't harm.
		}
	}


	/**
	 * Returns the disassembled lines as a string.
	 * Make sure to run 'disassemble' beforehand.
	 */
	public getDisassembly(): string {
		if(!this.disassembledLines) {
			this.emit('warning', 'No disassembly was done.');
			return '';
		}
		return this.disassembledLines.join('\n');
	}


	/**
	 * Disassembles the  memory area.
	 * Disassembly is done in a few passes.
	 * Afterwards the disassembledLines are set.
	 * @returns An array of strings with the disassembly.
	 */
	public disassemble() {
		// 1. Pass: Collect labels
		this.collectLabels();

		// Do special SNA handling. I.e. check if the SNA start address is meaningful
		if(this.snaStartAddress >= 0) {
			const label = this.labels.get(this.snaStartAddress);
			if(!label)	// if not found by other means.
				this.setLabel(this.snaStartAddress, 'SNA_LBL_MAIN_START_'+this.snaStartAddress.toString(16).toUpperCase(), NumberType.CODE_LBL);
		}

		// 2. Find interrupts
		this.findInterruptLabels();

		// 3. Sort all labels by address
		this.sortLabels();

		// 4. Find self-modifying code
		this.adjustSelfModifyingLabels();

		// 5. Add more references if e.g. a SUB flows through to another SUB.
		this.addFlowThroughReferences();

		// 6. Check if labels "LBL" are subroutines
		this.turnLBLintoSUB();

		// 7. Determine local labels inside subroutines
		this.findLocalLabelsInSubroutines();

		// 8. Remove self referenced labels
		this.addParentReferences();

		// 9. Add 'calls' list to subroutine labels
		this.addCallsListToLabels();

		// 10. Count number of types of labels
		this.countTypesOfLabels();

		// 11. Count statistics (size of subroutines, cyclomatic complexity)
		this.countStatistics();

		// 12. Assign label names
		this.assignLabelNames();

		// 13. Pass: Disassemble opcode with label names
		const disLines = this.disassembleMemory();

		// 14. Add all EQU labels to the beginning of the disassembly
		this.disassembledLines = this.getEquLabelsDisassembly();

		// Add the real disassembly
		this.disassembledLines.push(...disLines);

		// Remove any preceeding empty lines
		while(this.disassembledLines.length) {
			if(this.disassembledLines[0].length > 0)
				break;
				this.disassembledLines.splice(0,1);
		}
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

		/* In most cases (snapshot) this is a random address, so it does not make sense to use it as a label:
		// Set start label
		this.setLabel(start, 'SNA_LBL_MAIN_START_'+start.toString(16).toUpperCase(), NumberType.CODE_LBL);
		*/
		this.addressQueue.push(start);
		this.snaStartAddress = start;
	}


	/**
	 * Clears all labels collected so far.
	 * Useful for dot generation of a particular subroutine.
	 */
	public clearLabels() {
		// get new arrays/maps.
		this.labels = new Map<number,DisLabel>();
		this.offsetLabels = new Map<number,number>();
		this.addressQueue = new Array<number>();
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
	protected setLabel(address: number, name?: string, type = NumberType.CODE_LBL) {
		const label = new DisLabel(type);
		this.labels.set(address, label);
		(label.name as any) = name;	// allow undefined
		// Check if out of range
		const attr = this.memory.getAttributeAt(address);
		if(attr & MemAttribute.ASSIGNED) {
			if(type == NumberType.CODE_LBL
				|| type == NumberType.CODE_LOCAL_LBL
				|| type == NumberType.CODE_LOCAL_LOOP
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
	 * Used to set a label as the user.
	 * I.e. those labels should be fixed, i.e. not changable by the algorithm.
	 * Note: this affects only the change of the type. The name is anyhow not changed if it
	 * has been set by the user.
	 * @param address
	 * @param name
	 */
	public setFixedCodeLabel(address: number, name?: string) {
		const label = new DisLabel(NumberType.CODE_LBL);
		this.labels.set(address, label);
		(label.name as any) = name;	// allow undefined
		// Check if out of range
		const attr = this.memory.getAttributeAt(address);
		if(attr & MemAttribute.ASSIGNED)
			this.addressQueue.push(address);
		else
			label.isEqu = true;	 // out of range -> EQU
		// Set as fixed
		label.isFixed = true;
	}


	/**
	 * Adds the addresses from a call table (in memory) to the labels.
	 * @param address Address of the start of the call table.
	 * @param count The number of jmp addresses.
	 */
	public setJmpTable(address: number, count: number) {
		// Loop over all jmp addresses
		for(let i=0; i<count; i++) {
			// Get address
			let jmpAddress = this.memory.getWordValueAt(address);
			// Set label
			this.setFixedCodeLabel(jmpAddress);
			// Next
			address += 2;
		}
	}


	/**
	 * Reads a MAME .tr (trace) file.
	 * MAME trace files contain the opcode addresses of a run of the program.
	 * These are used as starting points for the disassembly.
	 * If a trace file is given it is normally not required to give additional
	 * label info like start of the program or start of the interrupt rsubroutine.
	 * @param path The file path to the trace (.tr) file. (An ASCII file).
	 * Trace files can become very big, a few seconds already result in MB of data.
	 */
	public useMameTraceFile(path: string) {
		const trace = readFileSync(path).toString();
		if(trace.length < 5)
			return;
	/* Doesn't make sense:
		// Use first address as start address
		const startAddress = trace.substr(0,5);
		this.setLabel(parseInt(startAddress, 16), 'TR_LBL_MAIN_START_'+ startAddress);
	*/
		// Loop over the complete trace file
		const buffer = new Array<boolean>(0x10000);	// initialized to undefined
		let k = 0;
		//let lineNr = 1;
		do {
			//const text = trace.substr(k,100);
			//console.log('log: "' + text + '"');
			const addressString = trace.substr(k,5);
			if(addressString.length == 5 && addressString[4] == ':') {
				// Use address
				const addr = parseInt(addressString, 16);
				buffer[addr] = true;
				k += 5;
			}
			// next
			k = trace.indexOf('\n', k) + 1;
			//lineNr ++;
		} while(k != 0);
		// Now add the addresses to the queue
		for(let addr=0; addr<0x10000; addr++) {
			if(buffer[addr])
				this.addressQueue.push(addr);
		}
	}


	/**
	 * Prints all labels to the console.
	 */
	/*
	public printLabels() {
		for(let [address, label] of this.labels) {
			// Label
			console.log('0x' + address.toString(16) + ': ' + label.name + ', ' +  label.getTypeAsString() + ', EQU=' + label.isEqu);
			// References
			const refArray = label.references.map(value => '0x'+value.toString(16));
			console.log('\tReferenced by: ' + refArray.toString() );
		}
	}
	*/

	/**
	 * Puts all EQU labels in an array of strings.
	 * @returns Array of strings.
	 */
	public getEquLabelsDisassembly(): Array<string> {
		let firstLabel = true;
		const lines = new Array<string>();
		for(let [address, label] of this.labels) {
			// Check if EQU
			if(label.isEqu) {
				if(firstLabel) {
					// At the start of the EQU area print a comment.
					lines.push('; EQU:\n; Data addresses used by the opcodes that point to uninitialized memory areas.\n');
					firstLabel = false;
				}
				// "Disassemble"
				let line =  Format.addSpaces(label.name+':', this.clmnsBytes) + this.rightCase('EQU ') + Format.fillDigits(address.toString(), ' ', 5);
				// Comment: number converter to hex.
				line += ' ; ' + Format.getHexString(address, 4) + 'h.';
				// Comment with references.
				const refArray = this.getReferencesString(label);
				line += ' ' + refArray.join(' ');
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
	 * All labels are stored into this.labels. At the end the list is sorted by the address.
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
					this.emit('warning', 'Trying to disassemble unassigned memory area at 0x' + address.toString(16) + '.');
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

				/*
				// Mark as stop code?
				if(opcode.flags & OpcodeFlag.STOP)
					this.memory.addAttributeAt(address, opcode.length, MemAttribute.CODE_STOP);
				*/

				// Check opcode for labels
				if(!this.disassembleForLabel(opcode, address)) {
					return;
				}

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
	}


	/**
	 * Sets or creates a label and sets its type.
	 * @param address The address for the label.
	 * @param referenceAddresses Array with addresses that reference the label. Usually only the opcode address.
	 * @param type The NumberType.
	 * @param attr The memory attribute at address.
	 */
	protected setFoundLabel(address: number, referenceAddresses: Set<Reference>, type: NumberType, attr: MemAttribute) {
		// Check if label already exists
		let label = this.labels.get(address);
		if(label) {
			// label already exists: prioritize
			if(label.type < type)
				label.type = type;
		}
		else {
			// Label does not exist yet, just add it
			label = new DisLabel(type);
			this.labels.set(address, label);
			// Check if out of range
			if(!(attr & MemAttribute.ASSIGNED))
				label.isEqu = true;
		}

		// Add reference(s). Do a union of both sets.
		//label.references = new Set([...label.references, ...referenceAddresses]);
		for(let ref of referenceAddresses) {
			if(ref.address != address)
				label.references.add(ref);
		}
	}


	/**
	 * Finds interrupt labels. I.e. start of progrma code
	 * that doesn't have any lable yet.
	 * As z80dismblr uses CFG analysis this can normally not happen.
	 * But if you e.g. provide a trace (tr) file this also includes interrupt traces.
	 * So z80dismblr will also follow these paths, but since there
	 * is no label associated this code would be presented without 'Start' label.
	 * 'findInterruptLabels' finds these code parts and assigns a label.
	 * Several rules are used:
	 * - It is checked if a label exists at a change from data or unassigned to opcode area
	 * - For a transition from stop code to opcode and there is no associated label
	 *
	 *
	 */
	protected findInterruptLabels() {
		const foundInterrupts = new Array<number>();
		// Check the whole memory
		let prevAttr = 0;
		let prevCodeAddr = -1;
		for(let address=0xA5F6; address<0x10000; address++) {
			// check memory attribute
			const memAttr = this.memory.getAttributeAt(address);
			if(memAttr & MemAttribute.CODE_FIRST
			&& memAttr & MemAttribute.ASSIGNED) {
				// Check if label exists
				const label = this.labels.get(address);
				if(!label) {
					// Only if label not yet exists

					// Check for transition unassigned or data (= not CODE) to code
					if(!(prevAttr & MemAttribute.ASSIGNED)
					|| !(prevAttr & MemAttribute.CODE)) {
						// Assign label
						this.setFixedCodeLabel(address, this.labelIntrptPrefix);
						foundInterrupts.push(address);
					}
					// Check for transition from stop code
					else if(prevCodeAddr >= 0) {
						const opcode = Opcode.getOpcodeAt(this.memory, prevCodeAddr);
						if(opcode.flags & OpcodeFlag.STOP) {
							// Assign label
							this.setFixedCodeLabel(address, this.labelIntrptPrefix);
							foundInterrupts.push(address);
						}
					}
				}
			}

			// Backup values
			prevAttr = memAttr;
			if(!(memAttr & MemAttribute.CODE))
				prevCodeAddr = -1;
			if(memAttr & MemAttribute.CODE_FIRST)
				prevCodeAddr = address;
		}

		// Add numbers
		const count = foundInterrupts.length;
		if(count > 1) {
			for(let index=0; index<count; index++) {
				const addr = foundInterrupts[index];
				const label = this.labels.get(addr);
				assert(label);
				if(label)
					label.name += index+1;
			}
		}
	}


	/**
	 * Sorts all labels by address.
	 */
	protected sortLabels() {
		this.labels = new Map([...this.labels.entries()].sort(([a], [b]) => a-b ));
	}


	/**
	 * "Disassembles" one label. I.e. the opcode is disassembled and checked if it includes
	 * a label.
	 * If so, the label is stored together with the call information.
	 * @param opcode The opcode to search for a label.
	 * @param opcodeAddress The current address.
	 * @returns false if problem occurred.
	 */
	protected disassembleForLabel(opcode: Opcode, opcodeAddress: number): boolean {

		// Check for branching etc. (CALL, JP, JR)
		if(opcode.flags & OpcodeFlag.BRANCH_ADDRESS) {
			// It is a label.

			// Get branching memory attribute
			const branchAddress = opcode.value;
			const attr = this.memory.getAttributeAt(branchAddress);

			// Create new label or prioritize if label already exists
			let vType = opcode.valueType;
			if(vType == NumberType.CODE_LOCAL_LBL) {
				// A relative jump backwards will become a "loop"
				if(branchAddress <= opcodeAddress)
					vType = NumberType.CODE_LOCAL_LOOP;
			}
			const ref: Reference = {address: opcodeAddress, parent: undefined};
			this.setFoundLabel(branchAddress, new Set([ref]), vType, attr);

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
			const ref: Reference = {address: opcodeAddress, parent: undefined};
			this.setFoundLabel(address, new Set([ref]), opcode.valueType, attr);
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
		const changeMap = new Map<number,DisLabel>();

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
	 * Check if a LBL/SUB references another LBL/SUB just by flow-through.
	 * I.e in.
	 * 	SUB01:
	 * 		LD A,1
	 * 	SUB02:
	 * 		LD B,3
	 * SUB01 would otherwise not reference SUB02 although it flows through which
	 * is equivalent to a JP or CALL;RET.
	 * This "references" are added here.
	 */
	protected addFlowThroughReferences() {
		// Loop through all labels
		for( let [address, label] of this.labels) {
			switch(label.type) {
				case NumberType.CODE_LBL:
				case NumberType.CODE_SUB:
				case NumberType.CODE_RST:

				// Find the next label that is reached not by a JP, JR or CALL
				const found = this.findNextFlowThroughLabel(address);
				if(found) {
					// add reference
					const foundLabel = found.label;
					if(label != foundLabel) {
						const ref: Reference = {address: found.address, parent: undefined};	// label could be assigned to parent, but this leads to bad side effects.
						foundLabel.references.add(ref);
					}
				}

			}
		}
	}


	/**
	 * Finds the next label in the path.
	 * Uses the direct path, i.e. it doesnot follow any branch addresses.
	 * Returns at a STOP code.
	 * Is used to find "flow-through" references. I.e. references from a SUB
	 * to another that are creates because the program flow simply flows
	 * through to the other subroutine instead of jumping to it or calling
	 * it.
	 * @param address The start address of the path.
	 * @returns The found label or undefined if nothing found.
	 */
	protected findNextFlowThroughLabel(address: number,): {label: DisLabel, address: number}|undefined {
		// Check if memory exists
		let memAttr = this.memory.getAttributeAt(address);
		if(!(memAttr & MemAttribute.ASSIGNED)) {
			return undefined;
		}

		// Get opcode
		let opcode = Opcode.getOpcodeAt(this.memory, address);

		// Loop over addresses
		while(!(opcode.flags & OpcodeFlag.STOP)) {
			// Next address
			const prevAddress = address;
			address += opcode.length;

			// Check if label exists
			const foundLabel = this.labels.get(address);
			if(foundLabel) {
				// Check if it is LBL or SUB
				const type = foundLabel.type;
				switch(type) {
					case NumberType.CODE_LBL:
					case NumberType.CODE_SUB:
						return {label: foundLabel, address: prevAddress};
				}
			}

			// Check if memory exists
			const memAttr = this.memory.getAttributeAt(address);
			if(!(memAttr & MemAttribute.ASSIGNED)) {
				return undefined;
			}

			// Get opcode
			opcode = Opcode.getOpcodeAt(this.memory, address);
		}

		// nothing found
		return undefined;
	}


	/**
	 * Checks if LBLs are SUBs and if so turns them into SUBs.
	 * Therefore it iterates through all LBL labels.
	 * Then it walks through the LBL and stops if it finds a RET, RET cc or RETI.
	 * (If it finds a RETI it marks the labels as interrupt.)
	 * Note 1: It does not check necessarily all branches. Once it finds a
	 * RET it assumes that also the other branches will end with a RET.
	 * Note 2: When this function is done there should be only 2 LBL left:
	 * - the main program and
	 * - the interrupt.
	 */
	protected turnLBLintoSUB() {
		// Loop through all labels
		for( let [address, label] of this.labels) {
			if(label.type == NumberType.CODE_LBL) {
				// Find a "RET" on the path
				const addrsArray = new Array<number>();
				const retFound = this.findRET(address, addrsArray);
				if(retFound) {
					// It is a subroutine, so turn the LBL into a SUB.
					label.type = NumberType.CODE_SUB;
				}
			}
		}
	}


	/**
	 * Tries to find a "RET(I)" in the path.
	 * @param address The start address of the path.
	 * @param addrsArray An empty array in the beginning that is filled with
	 * all addresses of the path.
	 * @returns true if an "RET(I)" was found otherwise false.
	 */
	protected findRET(address: number, addrsArray: Array<number>): boolean {
		// Check if memory exists
		const memAttr = this.memory.getAttributeAt(address);
		if(!(memAttr & MemAttribute.ASSIGNED)) {
			//console.log('  stop, not assigned');
			return false;
		}
		// Unfortunately it needs to be checked if address has been checked already
		if(addrsArray.indexOf(address) >= 0)
			return false;	// already checked
		// Check if a label for address exists that already is a subroutine.
		const addrLabel = this.labels.get(address);
		if(addrLabel) {
			const type = addrLabel.type;
			if(type == NumberType.CODE_SUB
			|| type == NumberType.CODE_RST) {
				return true;
			}
		}

		// Add to array
		addrsArray.push(address);

		// check opcode
		const opcode = Opcode.getOpcodeAt(this.memory, address);

		// Check if RET(I)
		if(opcode.name.toUpperCase().startsWith("RET"))
			return true;

		// Now check next address
		if(!(opcode.flags & OpcodeFlag.STOP)) {
			const nextAddress = address + opcode.length;
			const res = this.findRET(nextAddress, addrsArray);
			if(res)
				return true;
		}

		// And maybe branch address (but not a CALL)
		if(opcode.flags & OpcodeFlag.BRANCH_ADDRESS) {
			if(!(opcode.flags & OpcodeFlag.CALL)) {
				const branchAddress = opcode.value;
				const res = this.findRET(branchAddress, addrsArray);
				return res;
			}
		}

		// no RET
		return false;
	}


	/**
	 * After Labels have been assigned:
	 * Iterate through all subroutine labels.
	 * Walkthrough each subroutine and store the address belonging to the
	 * subroutine in an (temporary) array. The subroutine ends if each branch
	 * ends with a stop code (RET or JP).
	 * Then iterate the array.
	 * Each address with a Label of type CODE_LBL/SUB is checked. If it contains
	 * reference addresses outside the range of the array then it stays a CODE_LBL/SUB
	 * otherwise it is turned into a local label CODE_LOCAL_LBL or CODE_LOCAL_LOOP.
	 */
	protected findLocalLabelsInSubroutines() {
		// Loop through all labels
		for( let [address, label] of this.labels) {
			switch(label.type) {
				case NumberType.CODE_SUB:
				case NumberType.CODE_RST:
					// Get all addresses belonging to the subroutine
					const addrsArray = new Array<number>();
					this.getSubroutineAddresses(address, addrsArray);
					// Iterate array
					for(let addr of addrsArray) {
						// get corresponding label
						const addrLabel = this.labels.get(addr);
						// Check label
						if(!addrLabel)
							continue;
						if(addrLabel.type != NumberType.CODE_LBL
						&& addrLabel.type != NumberType.CODE_SUB)
							continue;
						if(addrLabel.isFixed)
							continue;
						// It is a CODE_LBL. Check references.
						const refs = addrLabel.references;
						let outsideFound = false;
						for(const ref of refs) {
							if(addrsArray.indexOf(ref.address) < 0) {
								// Found an address outside of the subroutine,
								// I.e. leave the label unchanged.
								outsideFound = true;
								break;
							}
						}
						if(!outsideFound) {
							// No reference outside the subroutine found
							// -> turn CODE_LBL into local label
							addrLabel.type = NumberType.CODE_LOCAL_LBL;
							// If any reference addr is bigger than address use CODE_LOCAL_LOOP,
							// otherwise CODE_LOCAL_LBL
							for(const ref of refs) {
								const diff = ref.address - addr;
								if(diff >= 0 && diff <= 128) {
									// Use loop
									addrLabel.type = NumberType.CODE_LOCAL_LOOP;
									break;
								}
							}
						}
					}
			}
		}
	}


	/**
	 * Returns an array with all addresses used by the subroutine
	 * goven at 'address'.
	 * Works recursively.
	 * @param address The start address of the subroutine.
	 * @param addrsArray An empty array in the beginning that is filled with
	 * all addresses of the subroutine.
	 */
	protected getSubroutineAddresses(address: number, addrsArray: Array<number>) {
		//console.log('Address=' + address + ', addrsArray.length=' + addrsArray.length);
		// Check if memory exists
		const memAttr = this.memory.getAttributeAt(address);
		if(!(memAttr & MemAttribute.ASSIGNED)) {
			//console.log('  stop, not assigned');
			return;
		}
		// Unfortunately it needs to be checked if address has been checked already
		if(addrsArray.indexOf(address) >= 0)
			return;	// already checked
		// Add to array
		addrsArray.push(address);
		// check opcode
		const opcode = Opcode.getOpcodeAt(this.memory, address);
		const opcodeClone = {...opcode};	// Required otherwise opcode is overwritten on next call to 'getOpcodeAt' if it's the same opcode.

		/*
		// Subroutine ends here. Also at a JP. A JP is interpreted as "CALL nn; RET"
		if(opcode.flags & OpcodeFlag.STOP) {
			//console.log('  stop');
			return;
		}
		*/

		/*
		// Subroutine ends at RET (unconditional)
		const ocName = opcode.name.toUpperCase();
		if(ocName == "RET" || ocName == "RETI")
			return;
		*/

		// Now check next address
		if(!(opcodeClone.flags & OpcodeFlag.STOP)) {
			const nextAddress = address + opcodeClone.length;
			this.getSubroutineAddresses(nextAddress, addrsArray);
		}

		// And maybe branch address
		if(opcodeClone.flags & OpcodeFlag.BRANCH_ADDRESS) {
			if(!(opcodeClone.flags & OpcodeFlag.CALL)) {
				const branchAddress = opcodeClone.value;
				this.getSubroutineAddresses(branchAddress, addrsArray);
			}
		}
	}


	/**
	 * Iterates through all Label.references and sets its parent label.
	 * References to itself are removed.
	 */
	protected addParentReferences() {
		for( let [, label] of this.labels) {
			// Remove self references, e.g. a subroutine that includes a loop that
			// jumps to itself and add all parent labels.
			const refs = label.references;
			for(let ref of refs) {
				ref.parent = this.getParentLabel(ref.address);
				if(ref.parent == label) {
					// delete it, it references itself
					refs.delete(ref);
				}
			}
		}
	}


	/**
	 * Adds the 'calls'-list to the subroutine labels.
	 * The reference list already includes the references (subroutines) who
	 * call the label.
	 * Now a list should be added to the label which contains all called
	 * subroutines.
	 * This is for call-graphs and for the comments in the listing.
	 */
	protected addCallsListToLabels() {
		for( let [, label] of this.labels) {
			switch(label.type) {
				case NumberType.CODE_SUB:
				case NumberType.CODE_RST:
					// go through references
					const refs = label.references;
					for(const ref of refs) {
						// Get parent
						const parent = ref.parent;
						if(parent) {
							// add label to call list of parent
							parent.calls.push(label);
						}
					}
			}
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



	/**
	 * Calculates the statistics like size or cyclomatic complexity of all
	 * subroutines.
	 * Fills the 'subroutineStatistics' map.
	 */
	protected countStatistics() {
		// Loop through all labels
		for( let [address, label] of this.labels) {
			switch(label.type) {
				case NumberType.CODE_SUB:
				case NumberType.CODE_RST:
					// Get all addresses belonging to the subroutine
					const addresses = new Array<number>();
					const statistics = this.countAddressStatistic(address, addresses);
					statistics.CyclomaticComplexity ++;	// Add 1 as default
					this.subroutineStatistics.set(label, statistics);
			}
		}
	}


	/**
	 * Calculates statistics like size or cyclomatic complexity.
	 * Works recursively.
	 * @param address The start address of the subroutine.
	 * @param addresses An empty array in the beginning that is filled with
	 * all addresses of the subroutine. Used to escape from loops.
	 * @returns statistics: size so far, cyclomatic complexity.
	 */
	protected countAddressStatistic(address: number, addresses: Array<number>) : SubroutineStatistics {
		let statistics = {sizeInBytes:0, countOfInstructions:0, CyclomaticComplexity:0};

		let opcodeClone;
		do {
			// Check if memory exists
			const memAttr = this.memory.getAttributeAt(address);
			if(!(memAttr & MemAttribute.ASSIGNED)) {
				return statistics;
			}
			// Unfortunately it needs to be checked if address has been checked already
			if(addresses.indexOf(address) >= 0)
				return statistics;	// already checked
			// Add to array
			addresses.push(address);
			// check opcode
			const opcode = Opcode.getOpcodeAt(this.memory, address);
			opcodeClone = {...opcode};	// Required otherwise opcode is overwritten on next call to 'getOpcodeAt' if it's the same opcode.

			// Add statistics
			statistics.sizeInBytes += opcodeClone.length;
			statistics.countOfInstructions ++;
			// Cyclomatic complexity: add 1 for each conditional branch
			if(opcodeClone.flags & OpcodeFlag.BRANCH_ADDRESS) {
				// Now exclude unconditional CALLs, JPs and JRs
				if(opcode.name.indexOf(',') >= 0 )
					statistics.CyclomaticComplexity ++;
			}
			else if(opcodeClone.name.toUpperCase().startsWith("RET ")) {
				// It is a conditional return (note the ' ' at the end of RET)
				statistics.CyclomaticComplexity ++;
			}

			// And maybe branch address
			if(opcodeClone.flags & OpcodeFlag.BRANCH_ADDRESS) {
				if(!(opcodeClone.flags & OpcodeFlag.CALL)) {
					// Only branch if no CALL, but for conditional and conditional JP or JR.
					// At last check if the JP/JR might jump to a subroutine. This wouldn't be followed.
					const branchAddress = opcodeClone.value;
					const branchLabel = this.labels.get(branchAddress);
					let isSUB = false;
					if(branchLabel)
						if(branchLabel.type == NumberType.CODE_SUB
						|| branchLabel.type == NumberType.CODE_RST)
							isSUB = true;
					// Only if no subroutine
					if(!isSUB) {
						const addStat = this.countAddressStatistic(branchAddress, addresses);
						statistics.sizeInBytes += addStat.sizeInBytes;
						statistics.countOfInstructions += addStat.countOfInstructions;
						statistics.CyclomaticComplexity += addStat.CyclomaticComplexity;
					}
				}
			}

			// Next
			address += opcodeClone.length;

			// Stop at flow-through
			const nextLabel = this.labels.get(address);
			if(nextLabel) {
				const type = nextLabel.type;
				if(type == NumberType.CODE_SUB
				|| type == NumberType.CODE_RST)
					break;	// Stop when entering another subroutine.
			}

		} while(!(opcodeClone.flags & OpcodeFlag.STOP));

		// return
		return statistics;
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
		const relLabels = new Array<DisLabel>();
		const relLoopLabels = new Array<DisLabel>();

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
					label.name = (label.belongsToInterrupt) ? this.labelIntrptPrefix : '' + this.labelSubPrefix + this.getIndex(subIndex, this.labelSubCountDigits);
					// Use for local prefix
					localPrefix = '.' + label.name.toLowerCase();
					// Next
					subIndex++;
				break;
				case NumberType.CODE_LBL:
					// Set name
					label.name = (label.belongsToInterrupt) ? this.labelIntrptPrefix : '' + this.labelLblPrefix + this.getIndex(lblIndex, this.labelLblCountDigits);
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
				case NumberType.CODE_LOCAL_LOOP:
					// Set name
					label.name = localPrefix + this.labelLoopPrefix;
					// Remember label
					relLoopLabels.push(label);
				break;
				case NumberType.CODE_LOCAL_LBL:
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
	 * Adds the indexes and the parentLabel to the relative labels.
	 * @param relLabels The relative (relative or loop) labels within a parent.
	 * @param parentLabel The parentLabel (SUB or LBL)
	 */
	protected assignRelLabelNames(relLabels: Array<DisLabel>, parentLabel: DisLabel) {
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
	 * Creates a human readable string telling which locations reference this address
	 * and which locations are called (if it is a subroutine).
	 * @param addrLabel The label for which the references are requested.
	 * @return An array of string with statistics about the label. E.g. for
	 * subroutines is tells the soze , cyclomatic complexity, all callers and all callees.
	 */
	protected getReferencesString(addrLabel: DisLabel) {
		const lineArray = new Array<string>();
		const refCount = addrLabel.references.size;
		let line1;

		// Name
		const type = addrLabel.type;
		let name;
		switch(type) {
			case NumberType.CODE_SUB: name = 'Subroutine'; break;
			case NumberType.CODE_RST: name = 'Restart'; break;
			case NumberType.DATA_LBL: name = 'Data'; break;
			default: name = 'Label'; break;
		}

		// Aggregate output string
		switch(type) {
			case NumberType.CODE_SUB:
			case NumberType.CODE_RST:
			{
				// Line 1
				line1 = name;
				const stat = this.subroutineStatistics.get(addrLabel);
				if(stat)
					line1 += ': Size=' + stat.sizeInBytes + ', CC=' + stat.CyclomaticComplexity + '.';
				else
					line1 += '.';
				lineArray.push(line1);
				// Line 2
				let line2 = 'Called by: ';
				let first = true;
				for(const ref of addrLabel.references) {
					if(!first)
						line2 += ', ';
					const s = Format.getHexString(ref.address, 4) + 'h';
					if(ref.parent)
						line2 += ref.parent.name + '[' + s +']';
					else
						line2 += s;
					first = false;
				}
				// Check if anything has been output
				line2 += (addrLabel.references.size > 0) ? '.' : '-';
				lineArray.push(line2);
				// Line 3
				let line3 = 'Calls: ';
				first = true;
				for(const callee of addrLabel.calls) {
					if(!first)
						line3 += ', ';
					line3 += callee.name
					first = false;
				}
				// Check if anything has been output
				line3 += (addrLabel.calls.length > 0) ? '.' : '-';
				lineArray.push(line3);
				break;
			}

			default:
			{
				line1 = name + ' is referenced by ' + refCount + ' location';
				if(refCount != 1)
					line1 += 's';
				line1 += (refCount > 0) ? ':' : '.';
				lineArray.push(line1);

				// 2nd line
				if(refCount > 0) {
					// Second line: The references
					const refArray = [...addrLabel.references].map(elem => {
						const addr = elem.address;
						let s = Format.getHexString(addr, 4) + 'h';
						const parentLabel = elem.parent;
						if(parentLabel) {
							// Add e.g. start of subroutine
							s += '(in ' + parentLabel.name + ')';
						}
						return s;
					});
					const line2 = refArray.join(', ');
					lineArray.push(line2);
				}
				break;
			}
		}
		// return
		return lineArray;
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
			if(label.isEqu)
				continue;	// Skip EQUs

			// If first line, print ORG
			if(address == -1) {
				// First line
				// Print "ORG"
				this.addEmptyLines(lines);
				const orgLine =  ' '.repeat(this.clmnsBytes) + this.rightCase('ORG ') + Format.fillDigits(addr.toString(), ' ', 5) + ' ; ' + Format.getConversionForAddress(addr);
				lines.push(orgLine);
			}
			else {
				// Normal case. All other lines but first line.
				const unassignedSize = addr - address;
				if(unassignedSize < 0)
					continue;

				// Print new "ORG"
				this.addEmptyLines(lines);
				const orgLine =  ' '.repeat(this.clmnsBytes) + this.rightCase('ORG ') + Format.fillDigits(addr.toString(), ' ', 5) + ' ; ' + Format.getConversionForAddress(addr);
				lines.push(orgLine);
			}

			// Use address
			address = addr;
			let prevMemoryAttribute = MemAttribute.DATA;

			let prevStopCode = false;

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
					if(type == NumberType.CODE_SUB || type == NumberType.CODE_LBL || type == NumberType.DATA_LBL || type == NumberType.CODE_RST) {
						this.addEmptyLines(lines);
					}
					// Add comment with references
					if((type == NumberType.CODE_SUB && this.addReferencesToSubroutines)
					|| (type == NumberType.CODE_LBL && this.addReferencesToAbsoluteLabels)
					|| (type == NumberType.CODE_RST && this.addReferencesToRstLabels)
					|| (type == NumberType.DATA_LBL && this.addReferencesToDataLabels)) {
						// Get line wit hreferences
						const refArray = this.getReferencesString(addrLabel).map(s => '; '+s);
						lines.push(...refArray);
					}

					// Add label on separate line
					let labelLine = addrLabel.name + ':';
					if(this.clmnsAddress > 0) {
						labelLine = Format.addSpaces(Format.getHexString(address), this.clmnsAddress)+ labelLine;
					}
					lines.push(labelLine);
				}

				// Check if code or data should be disassembled
				let addAddress;
				let line;
				prevStopCode = false;
				if(attr & MemAttribute.CODE) {
					// CODE

					// Add empty lines in case there is no label, but the previous area was DATA or there was a stop opcode.
					if(!addrLabel) {
						if(prevStopCode || (prevMemoryAttribute & MemAttribute.DATA)) {
							this.addEmptyLines(lines);
						}
					}

					// Read opcode at address
					const opcode = Opcode.getOpcodeAt(this.memory, address);

					// Disassemble the single opcode
					const opCodeDescription = opcode.disassemble();
					line = this.formatDisassembly(address, opcode.length, opCodeDescription.mnemonic, opCodeDescription.comment);

					prevStopCode = ((opcode.flags & OpcodeFlag.STOP) != 0);

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
		const memory = (this.addOpcodeBytes) ? this.memory : undefined;
		return Format.formatDisassembly(memory, this.opcodesLowerCase, this.clmnsAddress, this.clmnsBytes, this.clmnsOpcodeFirstPart, this.clmsnOpcodeTotal, address, size, mainString, commentString);
	}


	/**
	 * Finds the parent label. I.e. the first non relative label that is lower than the given address.
	 * @param address
	 */
	protected getParentLabel(address: number): DisLabel|undefined {
		let prevLabel;
		for(let [addr, label] of this.labels) {
			const type = label.type;
			if(type == NumberType.CODE_SUB || type == NumberType.CODE_LBL) {
				if(addr > address) {
					// found
					return prevLabel;
				}
				// store previous
				prevLabel = label;
			}
		}
		// Nothing found
		return prevLabel;
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



	/**
	 * Returns the labels call graph in dot syntax.
	 * Every main labels represents a bubble.
	 * Arrows from one bubble to the other represents
	 * calling the function.
	 * @param name The name of the graph.
	 */
	public getCallGraph(name: string): string {
		let text;

		// header
		text = 'digraph ' + name + '\n{\n';

		// Iterate through all subroutine labels
		for(let [, label] of this.labels) {
			// Skip other labels
			if(label.type != NumberType.CODE_SUB && label.type != NumberType.CODE_LBL && label.type != NumberType.CODE_RST)
				continue;
			//console.log(label.name + '(' + Format.getHexString(address) + '):')

/*			// List each parent only once
			const parents = new Set<DisLabel>();
			for(const ref of label.references) {
				const par = ref.parent;
				if(par)
					parents.add(par);
			}
			// Print all references as callers:
			for(let refLabel of parents) {
				text += refLabel.name + ' -> ' + label.name + ';\n';
				//console.log('  ' + Format.getHexString(ref.address) + ': parent=' + ((refLabel) ? refLabel.name : 'undefined'));
			}
*/

			// List each callee only once
			const callees = new Set<DisLabel>();
			for(const callee of label.calls) {
				callees.add(callee);
			}
			// Print all called labels:
			for(const refLabel of callees) {
				text += label.name + ' -> ' + refLabel.name + ';\n';
			}
		}


		// ending
		text += '}\n';

		// return
		return text;
	}

}

