import { readFileSync } from 'fs';

//import * as util from 'util';
//import * as assert from 'assert';


export const MAX_MEM_SIZE = 0x10000;


/// Classification of memory addresses.
export enum MemAttribute {
	/// Unassigned memory
	UNUSED = 0,
	/// Unknown area (code or data)
	ASSIGNED = 0x01,
	/// Code area
	CODE = 0x02,
	/// First byte of an opcode
	CODE_FIRST = 0x04,
	/// Data area
	DATA = 0x08
}

/**
 * Class to hold and access the memory.
 */
export class Memory {

	/// The resulting memory area.
	protected memory = new Uint8Array(MAX_MEM_SIZE);

	/// An attribute field for the memory.
	protected memoryAttr = new Array<MemAttribute>(MAX_MEM_SIZE);


	/**
	 * Constructor: Initializes memory.
	 */
 	constructor () {
		// Init memory
		for(let i=0; i<MAX_MEM_SIZE; i++) {
			this.memory[i] = 0;
			this.memoryAttr[i] = MemAttribute.UNUSED;
		}
	}


	/**
	 * Define the memory area to disassemble.
	 * @param origin The start address of the memory area.
	 * @param memory The memory area.
	 */
	public setMemory(origin:number, memory: Uint8Array) {
		const size = memory.length;
		for(let i=0; i<size; i++) {
			const addr = (origin+i) & (MAX_MEM_SIZE-1);
			this.memory[addr] = memory[i];
			this.memoryAttr[addr] |= MemAttribute.ASSIGNED;
		}
	}


	/**
	 * Reads a memory area as binary from a file.
	 * @param origin The start address of the memory area.
	 * @param path The file path to a binary file.
	 */
	public readBinFile(origin: number, path: string) {
		let bin = readFileSync(path);
		this.setMemory(origin, bin);
	}


	/**
	 * Returns the memory value at address.
	 * @param address The address to retrieve.
	 * @returns It's value.
	 */
	public getValueAt(address: number) {
		return this.memory[address&(MAX_MEM_SIZE-1)];
	}


	/**
	 * Returns the word memory value at address.
	 * @param address The address to retrieve.
	 * @returns It's value.
	 */
	public getWordValueAt(address: number) {
		const word = this.memory[address&(MAX_MEM_SIZE-1)] + 256*this.memory[(address+1)&(MAX_MEM_SIZE-1)];
		return word;
	}


	/**
	 * Returns the word memory value at address in big endian.
	 * @param address The address to retrieve.
	 * @returns It's value.
	 */
	public getBigEndianWordValueAt(address: number) {
		const word = 256*this.memory[address&(MAX_MEM_SIZE-1)] + this.memory[(address+1)&(MAX_MEM_SIZE-1)];
		return word;
	}


	/**
	 * Return memory attribute.
	 * @param address At address
	 * @returns The memory attribute.
	 */
	public getAttributeAt(address: number): MemAttribute {
		const attr = this.memoryAttr[address++];
		return attr;
	}


	/**
	 * Adds (ORs) a memory attribute for an address.
	 * @param address The memory address
	 * @param length The size of the memory area to change.
	 * @param attr The attribute to set (e.g. CODE or DATA)
	 */
	public addAttributeAt(address: number, length: number, attr: MemAttribute) {
		for(let i=0; i<length; i++)
			this.memoryAttr[address++] |= attr;
	}
}

