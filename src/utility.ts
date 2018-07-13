
//var assert = require('assert');


export class Utility {

	/// Choose opcodes in lower or upper case.
	public static hexNumbersLowerCase = false;

	/**
	 * Returns a hex string with a fixed number of digits.
	 * @param value The value to convert.
	 * @param countDigits The number of digits.
	 * @returns a string, e.g. "04fd".
	 */
	public static getHexString(value:number, countDigits = 4): string {
		let s = value.toString(16);
		if(!Utility.hexNumbersLowerCase)
			s = s.toUpperCase();
		return Utility.fillDigits(s, '0', countDigits);
	}


	/**
	 * If string is smaller than countDigits the string is filled with 'fillCharacter'.
	 * Used to fill a number up with '0' or spaces.
	 */
	public static fillDigits(valueString:string, fillCharacter: string, countDigits: number): string {
		const repeat = countDigits-valueString.length;
		if(repeat <= 0)
			return valueString;
		const res = fillCharacter.repeat(repeat) + valueString;
		return res;
	}


	/**
	 * Adds spaces to the end of the string until the given total length
	 * is reached.
	 * @param s The string.
	 * @param totalLength The total filled length of the resulting string
	 * @returns s + ' ' (several spaces)
	 */
	public static addSpaces(s:string, totalLength: number): string {
		const countString = s.length;
		const repeat = totalLength - countString;
		if(repeat <= 0)
			return s;
		const res = s + ' '.repeat(repeat);
		return res;
	}


	/**
	 * Puts together a few common conversions for a byte value.
	 * E.g. hex, decimal and ASCII.
	 * Used to create the comment for an opcode or a data label.
	 * @param byteValue The value to convert. [-128;255]
	 * @returns A string with all conversions, e.g. "20h, 32, ' '"
	 */
	public static getVariousConversionsForByte(byteValue: number): string {
		// byte
		if(byteValue < 0)
			byteValue = 0x100 + byteValue;
		let result = Utility.getHexString(byteValue, 2) + "h";
		// Negative?
		let convValue = byteValue;
		if(convValue >= 0x80) {
			convValue -= 0x100;
			result += ', ' + Utility.fillDigits(convValue.toString(), ' ', 4);
		}
		// Check for ASCII
		if(byteValue >= 32 /*space*/ && byteValue <= 126 /*tilde*/)
			result += ", '" + String.fromCharCode(byteValue) + "'";
		// return
		return result;
	}


	/**
	 * Converts value to a hex address.
	 * @param value The value to convert.
	 * @returns A string with hex conversion, e.g. "FA20h"
	 */
	public static getConversionForAddress(value: number): string {
		// word
		let result = Utility.getHexString(value) + 'h';
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
	public static getVariousConversionsForWord(wordValue: number): string {
		// word
		let result = this.getConversionForAddress(wordValue);
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

