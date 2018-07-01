
//var assert = require('assert');


export class UtilityClass {

	/// Choose opcodes in lower or upper case.
	public hexNumbersLowerCase = false;

	/**
	 * Returns a hex string with a fixed number of digits.
	 * @param value The value to convert.
	 * @param countDigits The number of digits.
	 * @returns a string, e.g. "04fd".
	 */
	public getHexString(value:number, countDigits = 4): string {
		let s = value.toString(16);
		if(!this.hexNumbersLowerCase)
			s = s.toUpperCase();
		return this.fillDigits(s, '0', countDigits);
	}


	/**
	 * If string is smaller than countDigits the string is filled with 'fillCharacter'.
	 * Used to fill a number up with '0' or spaces.
	 */
	public fillDigits(valueString:string, fillCharacter: string, countDigits: number): string {
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
	public getVariousConversionsForByte(byteValue: number): string {
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
	public getVariousConversionsForWord(wordValue: number): string {
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


export const Utility = new UtilityClass();
