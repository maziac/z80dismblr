import { Disassembler } from './disasm';
import { readFileSync } from 'fs';


class Startup {

    /// String containing all whitespaces.
    protected static whiteSpaces = ' \t\n\r';

    /// The disassembler instance.
    protected static dasm = new Disassembler();

    /**
     * Main function. Called on startup.
     */
    public static main(): number {
        try {

            // Get arguments
            const args = process.argv.splice(2);

            // Check for help
            if(args.length == 0) {
                this.printHelp();
                return 0;
            }

            // Go through arguments
            this.processArgs(args);

            // Execute
            const lines = this.dasm.disassemble();

            // Temporary output
            console.log(lines.slice(0,20).join('\n'));

        }
        catch(e) {
            console.log(e);
            return 1;
        }

        return 0;
    }


    /**
     * Prints command line help.
     */
    protected static printHelp() {
        console.log(`
z80dismblr is a disassembler for Z80 code binaries. The disassembly will be
simply written to stdout.

Example usages:

$ z80dismblr --sna myfile.sna > myfile.list
This will write the disassembly of the snapshot file 'myfile.sna' to file 'myfile.list'.

$ z80dismblr --bin 0x8000 myfile.obj --codelable 0x9000 > myfile.list
This will write the disassembly of the binary file file 'myfile.obj' to file 'myfile.list'.
The binary file starts at address 0x8000 and the code entry point start at
0x9000 (i.e. here begins the code area).

General usage:
z80dismblr [options]
    -h|-help|--help Print this help.
    --args file: Instead of an argument list on the command line it is also possible
        to provide the arguments in a file. There is no special format, just
        provide the arguments. May conatin newlines.
    --sna file: Read in a snapshot file. (Snapshot files contain a code start
        address.)
    --bin start file: Read in a plain binary. 'start' is the address in memory for the read binary.
        --codelabel or --tr is mandatory to
        obtain any disassembly results.
    --tr file: Add a MAME trace file. This can be used instead of --codelabel.
        Providing a trace file will increase the quality of the
        disassembly output.
    --codelabel address [labelname]: Known addresses (like the code start
        address) can be given here. If no sna file is given at least one
        codelabel is required so  that disassembly can start from that address.
    --jmptable address size: If it is known that a jump-table exists in memory
        then its address and size can be given here. 'size' is the number of addresses.

    Prefixes: It is possible to customize the label naming. There are different
    types of labels. For each label type you can define its prefix.
        --subprefix prefix: Prefix for subroutines, e.g. '--subprefix MYSUB'.
        --lblprefix prefix: Prefix for adresses reached by a 'JP'.
        --datalblprefix prefix: Prefix for data areas.
        --locallblprefix prefix: Prefix for local lable, those reached with a (positive)
        'JR'. Note that in front of this prefix the subroutines main prefix is added.
        --localloopprefix prefix: Similar to the local lables but for negative relative jumps.
        `);
    }


    /**
     * Processes teh command line arguments or the arguments read from a file.
     * @param args List of arguments.
     */
    protected static processArgs(args: Array<string>) {
        // Iterate all arguments
        let arg;
        let path;
        let addressString;
        let addr;
        let text;
        while(arg = args.shift()) {
            // Check option
            switch(arg) {
                // Help
                case '--help':
                case '-help':
                case '-h':
                    this.printHelp();
                    return 0;

                // arguments file
                case '--args':
                    path = args.shift();
                    if(!path) {
                        throw arg + ': No path given.';
                    }
                    // Read arguments from file
                    const fileArgs = this.readArgsFromFile(path);
                    // Process
                    this.processArgs(fileArgs);
                    break;

                // SNA file
                case '--sna':
                    path = args.shift();
                    if(!path) {
                        throw arg + ': No path given.';
                    }
                    this.dasm.readSnaFile(path);
                    break;

                // SNA file
                case '--bin':
                    // get origin
                    const originString = args.shift();
                    const origin = this.parseValue(originString);
                    if(isNaN(origin)) {
                        throw arg + ": Not a number: " + originString;
                    }
                    // get path
                    path = args.shift();
                    if(!path) {
                        throw arg + ': No path given.';
                    }
                    // set memory
                    this.dasm.memory.readBinFile(origin, path);
                    break;

                // TRACE (.tr) file
                case '--tr':
                    path = args.shift();
                    if(!path) {
                        throw arg + ': No path given.';
                    }
                    this.dasm.useMameTraceFile(path);
                    break;

                // set a code label
                case '--codelabel':
                    // parse address
                    addressString = args.shift();
                    addr = this.parseValue(addressString);
                    if(isNaN(addr)) {
                        throw arg + ": Not a number: " + addressString;
                    }
                    // Now optional name
                    let labelName = args.shift();
                    if(labelName)
                        if(labelName.startsWith('--')) {
                            // is the next arguments
                            args.unshift(labelName);
                            labelName = undefined;
                        }
                    // Set label
                    this.dasm.setLabel(addr, labelName);
                    break;

                // set a jump table
                case '--jmptable':
                    // parse address
                    addressString = args.shift();
                    addr = this.parseValue(addressString);
                    if(isNaN(addr)) {
                        throw arg + ": Not a number: " + addressString;
                    }
                    // Now the size
                    const sizeString = args.shift();
                    const size = this.parseValue(sizeString);
                    if(isNaN(size)) {
                        throw arg + ": Not a number: " + sizeString;
                    }
                    // Set jump table
                    this.dasm.setJmpTable(addr, size);
                    break;


                // Prefixes

                // SUB prefix
                case '--subprefix':
                    // get prefix
                    text = args.shift();
                    if(!text || test.length == 0)
                        throw arg + ": No prefix given";
                    // Set prefix
                    this.dasm.labelSubPrefix = text;
                    break;

                // LBL prefix
                case '--lblprefix':
                    // get prefix
                    text = args.shift();
                    if(!text || test.length == 0)
                        throw arg + ": No prefix given";
                    // Set prefix
                    this.dasm.labelLblPrefix = text;
                    break;

                // Data label prefix
                case '--datalblprefix':
                    // get prefix
                    text = args.shift();
                    if(!text || test.length == 0)
                        throw arg + ": No prefix given";
                    // Set prefix
                    this.dasm.labelDataLblPrefix = text;
                    break;

                // Local lable prefix
                case '--locallblprefix':
                    // get prefix
                    text = args.shift();
                    if(!text || test.length == 0)
                        throw arg + ": No prefix given";
                    // Set prefix
                    this.dasm.labelLocalLablePrefix = text;
                    break;

                // Local loop prefix
                case '--localloopprefix':
                    // get prefix
                    text = args.shift();
                    if(!text || test.length == 0)
                        throw arg + ": No prefix given";
                    // Set prefix
                    this.dasm.labelLoopPrefix = text;
                    break;



            default:
                    throw "Unknown argument: '" + arg + "'";
                    return 1;
            }
        }
    }

    /**
     * Reads argument list from a file.
     * @param path The path to the file.
     * @return List of strings, like args.
     */
    protected static readArgsFromFile(path: string): Array<string> {
        const argsData = readFileSync(path).toString();
        const args = new Array<string>();
        let k = 0;
        while(true) {
            // skip whitespaces
            k = this.skipWhiteSpaces(argsData, k);

            // Check if first character is a ' or "
            const val = argsData[k];
            let l;
            if(val == '"' || val == "'") {
                // Search for ending
                k ++;
                l = argsData.indexOf(val, k);
                if(l < 0) {
                    throw "Couldn't find closing " + val + " in " + path;
                }
                // get string
                const arg = argsData.substr(k, l-k);
                args.push(arg);
                // next
                l ++;
            }
            else {
                // search for next whitespace (== ending)
                l = this.findWhiteSpace(argsData, k+1);
             }

             // get string
             const arg = argsData.substr(k, l-k);
             args.push(arg);

             // next
             k = l;
        }

        // return
        return args;
    }


    /**
     * Skips white spaces.
     * @param s The string to search.
     * @param i The start index.
     * @return The index of the first non-whitespace.
     */
    protected static skipWhiteSpaces(s: string, i: number): number {
        const len = s.length;
        while(i < len) {
            const val = s[i];
            if(this.whiteSpaces.indexOf(val) < 0)
                break;
            // next
            i ++;
        }
        return i;
    }


    /**
     * Finds the next white spaces.
     * @param s The string to search.
     * @param i The start index.
     * @return The index of the first whitespace.
     */
    protected static findWhiteSpace(s: string, i: number): number {
        const len = s.length;
        while(i < len) {
            const val = s[i];
            if(this.whiteSpaces.indexOf(val) >= 0)
                break;
            // next
            i ++;
        }
        return i;
    }


    /**
	 * Parses a string and converts it to a number.
	 * The string might be decimal or in an hex format.
	 * If the string begins with '0x' or '$' or ends with 'h' or 'H'
	 * it is assumed to be a hex value.
	 * If the string ends with 'b' or 'B' a bit value is assumed.
	 * Otherwise decimal is used.
	 * If the string starts with _ a flag value is assumed. I.e. following flags
	 * are allowed: SZHPNC
	 * Otherwise decimal is used.
	 * @param valueString The string to convert. Ignores case.
	 * @returns The value of valueString. Can also return NaN in error cases.
	 */
	public static parseValue(valueString: string|undefined): number {
        if(!valueString)
            return NaN;

		const match = /^\s*((0x|\$)([0-9a-f]+)([^0-9a-f]*))?(([0-9a-f]+)h(.*))?(([01]+)b(.*))?(_([szhnpc]+)([^szhnpc])*)?((-?[0-9]+)([^0-9]*))?('([\S ]+)')?/i.exec(valueString);
		if(!match)
			return NaN;	// Error during parsing

		const ghex = match[3];	// 0x or $
		const ghex_empty = match[4];	// should be empty

		const ghexh = match[6];	// h
		const ghexh_empty = match[7];	// should be empty

		const gbit = match[9];	// b
		const gbit_empty = match[10];	// should be empty

		var gflags = match[12];	// _
		const gflags_empty = match[13];	// should be empty

		const gdec = match[15];	// decimal
		const gdec_empty = match[16];	// should be empty

		var gchar = match[18];	// ASCII character

		// Hex
		if(ghex) {
			if(ghex_empty)
				return NaN;
			return parseInt(ghex, 16);
		}
		if(ghexh) {
			if(ghexh_empty)
				return NaN;
			return parseInt(ghexh, 16);
		}

		// Decimal
		if(gdec) {
			if(gdec_empty)
				return NaN;
			return parseInt(gdec, 10);;
		}
		// Bits
		if(gbit) {
			if(gbit_empty)
				return NaN;
			return parseInt(gbit, 2);
		}

		// Check if status flag value
		if(gflags) {
			if(gflags_empty)
				return NaN;
			gflags = gflags.toLowerCase()
			var flags = 0;
			if(gflags.includes('s')) flags |= 0x80;
			if(gflags.includes('z')) flags |= 0x40;
			if(gflags.includes('h')) flags |= 0x10;
			if(gflags.includes('p')) flags |= 0x04;
			if(gflags.includes('n')) flags |= 0x02;
			if(gflags.includes('c')) flags |= 0x01;
			return flags;
		}

		// ASCII character
		if(gchar) {
			if(gchar.length < 1)
				return NaN;
			return gchar.charCodeAt(0);
		}

		// Unknown
		return NaN;
    }

}



Startup.main();