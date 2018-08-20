import { Opcode, OpcodeFlag } from './opcode';
import { BaseMemory } from './basememory';



export class CustomOpcode extends Opcode {
	/// Byte (sequence) opcode for the opcode.
	public opcodes = new Array<number>();

	/// The branch address to 'eval'uate.
	public branchString: string;

	// The values. (value is only used for branch address)
	public values = Array<number>();

	/**
	 *  Constructor: Calculates the opcode length and converts the #n(n) in the name into %s.
	 * @param flags The opcode flags.
	 * @param branchString A string that is evaluated during 'getOpcodeAt.
	 */

	constructor(code: number, name: string, flags: number, branchString: string) {
		super();
		// Copy
		this.code = code;
		this.flags = flags;
		this.branchString = branchString.replace(/\$([0-9])/, "this.values[$1]");
		// Calculate length and convert #n to %s
		let k = 0;
		let text = name + ' ';
		let len = 0;
		this.name = '';
		while((k = text.indexOf("#n",k)) >= 0) {
			// Increment
			len ++;
			// Check for word
			if(text[k+2] == "n") {
				k ++;
				len ++;
			}
			// Next
			k += 2;
		}
		this.length = 1 + len;	// Note: length is also changed from outside depndingon the number of opcodes.
		// Substitute formatting
		this.name = name.replace(/#nn?/g, "%s");
	}

	/// Collect the values.
	public getOpcodeAt(memory: BaseMemory, address: number): Opcode {
		// Get bytes according to the used bytes in the name
		this.values.length = 0;
		let k = 0;
		let text = this.name + ' ';
		let addr = address+1;
		while((k = text.indexOf("#n",k)) >= 0) {
			// Check for word or byte
			let val;
			if(text[k+2] == "n") {
				// 1 word
				val = memory.getWordValueAt(addr);
				addr += 2;
			}
			else {
				// 1 byte
				val = memory.getValueAt(addr);
				addr ++;
			}
			// Store
			this.values.push(val);
		}

		// Set branch address
		try {
			const val = eval(this.branchString);
			this.value = val;
		}
		catch(e) {
			throw Error('Evaluation of branch address failed (' + this.branchString + '): ' + e);
		}
		return this;
	}

	/// Disassemble the values.
	public disassemble(): {mnemonic: string, comment: string} {
		const valuesStrings = this.values.map(val => val.toString());
		const opCodeString = util.format(this.name, ...valuesStrings);
		return {mnemonic: opCodeString, comment: this.comment};
	}
}