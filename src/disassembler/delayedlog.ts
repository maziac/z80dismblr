
import * as util from 'util';


/**
 * Class used for a delayed logging.
 * I.e. it is logged into a buffer but not directly printed.
 * Then after a certain section is ready one may output the
 * log. This is done by using a 'key'. If key is in the
 * hardcoded 'keyList' then the whole stored logging is printed.
 * Otherwise nothign is printed.
 */
export class DelayedLog {

	/// Static array of DbgLog objects.
	protected static queue = new Array<DelayedLog>();

	/// The list of objects to log.
	protected static keyList = new Set([ 0x0005, 0x02C4 ]);

	/// The saved logged output.
	protected loggedLines = new Array<string>();

	/// Tab level for the output
	protected tabLevel = 1;

	/// Will be set if everything should be logged.
	protected key: any;

	/**
	 * Saves the logs to this logging object.
	 * @param args The format string and arguments.
	 */
	public static log(...args) {
		const lastIndex = this.queue.length-1;
		if(lastIndex < 0)
			return;
		// Get current log lines
		const logObj = this.queue[lastIndex];
		// Store line
		let line = '';
		if(args) {
			const format = args[0];
			if(format) {
				args.splice(0,1);
				line = util.format(format, ...args);
			}
			else {
				line = util.format(args);
			}
			const tabs = '.' + ' '.repeat(4-1);
			line = tabs.repeat(logObj.tabLevel) + '[' + line + ']';
		}
		logObj.loggedLines.push(line);
	}


	/**
	 * Log if key is in list.
	 * 'handler' should return the string to be logged but is only called if the key is correct.
	 * @param handler
	 */
	public static logIf(key: any, handler:() => string) {
		if(!this.keyList.has(key))
			return;
		const lastIndex = this.queue.length-1;
		if(lastIndex < 0)
			return;
		// Get current log lines
		const logObj = this.queue[lastIndex];
		logObj.key = key;
		const s = handler();
		this.log(s);
	}


	/**
	 * Starts logging.
	 * A new DelayedLog object is created and all logging goes here.
	 * Has to be ended with endLog.
	 */
	public static startLog() {
		// Create new log object
		const logObj = new DelayedLog();
		// Store it
		this.queue.push(logObj);
	}


	/**
	 * Shows the current log if  ifFulfilled is true.
	 * ifFulfilled key is in the keyList.
	 *
	 */
	public static stopLog() {
		const logObj = this.queue.pop();
		if(!logObj)
			return;
		if(!logObj.key)
			return;
		// Log
		console.log(this.getNumber(logObj.key) + ':');
		// Get current log lines
		console.log(logObj.loggedLines.join('\n'));
		console.log('\n');
	}


	/**
	 * Increase tabulator.
	 */
	public static pushTab() {
		const lastIndex = this.queue.length-1;
		if(lastIndex < 0)
			return;
		const logObj = this.queue[lastIndex];
		logObj.tabLevel ++;
	}


	/**
	 * Decrease tabulator.
	 */
	public static popTab() {
		const lastIndex = this.queue.length-1;
		if(lastIndex < 0)
			return;
		const logObj = this.queue[lastIndex];
		logObj.tabLevel --;
	}


	/**
	 * Returns a converted number. Converted into a string as hex and decimal.
	 * @param value Value to convert.
	 */
	public static getNumber(value: any) {
		let hex = value.toString(16);
		hex = hex.toUpperCase();
		const k = 4 - hex.length;
		if(k > 0)
			hex = "0".repeat(k) + hex;
		const s = hex + ' (' + value.toString() + ')';
		return s;
	}
}
