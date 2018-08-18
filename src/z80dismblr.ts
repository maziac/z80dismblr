import { Disassembler } from './disassembler/disasm';
import { readFileSync, writeFileSync } from 'fs';
import { Opcode } from './disassembler/opcode';
import * as Path from 'path';

class Startup {

    /// String containing all whitespaces.
    protected static whiteSpaces = ' \t\n\r';

    /// The disassembler instance.
    protected static dasm = new Disassembler();

    /// The disassembly output file path.
    protected static outPath: string|undefined;

    /// The caller-graph dot (graphviz) output path.
    protected static callGraphOutPath: string|undefined;

    /// The labels output path.
    protected static lblsOutPath: string|undefined;

    /// The labels input path.
    protected static lblsInPath: string|undefined;

    /// The out path for the flow-chart dot file.
    protected static flowChartOutPath: string|undefined;

    /// The flow chart start address.
    protected static flowChartStartAddresses = new Array<number>();

    /**
     * Main function. Called on startup.
     */
    public static main(): number {
        try {
             // Set defaults
            this.dasm.opcodesLowerCase = true;
            this.dasm.addOpcodeBytes = false;

            // Set error handler
            this.dasm.on('error', msg => {
                // Note: there is no error at the moment.
                console.error('Error: ' + msg);
                return;
            });
            this.dasm.on('warning', msg => {
                console.error('Warning: ' + msg);
            });

            // Get arguments
            const args = process.argv.splice(2);

            // Check for help
            if(args.length == 0) {
                this.printHelp();
                return 0;
            }

            // Go through arguments
            this.processArgs(args);

            // Check if any output is given
            if(!this.outPath && !this.callGraphOutPath) {
                throw "You need to set an output path via '--out' or '--callgraph'.";
            }

            // Lower case opcodes?
            if(this.dasm.opcodesLowerCase)
                Opcode.makeLowerCase();

            // infile with commetns for the labels
            if(this.lblsInPath)
                this.dasm.setAddressComments(this.lblsInPath);

            // Execute
            this.dasm.disassemble();

            // Output disassembly
            if(this.outPath) {
                // disssembly to file
                const text = this.dasm.getDisassembly();
                writeFileSync(this.outPath, text);
            }

            // Output dot (graphviz)
            if(this.callGraphOutPath) {
                // labels/references to dot file
                let name = Path.basename(this.callGraphOutPath);
                const k = name.indexOf('.');
                if(k > 0)
                    name = name.substr(0, k);
                const text = this.dasm.getCallGraph(name);
                writeFileSync(this.callGraphOutPath, text);
            }

            // Output flow-chart file
            if(this.flowChartOutPath) {
                // Check if start address given
                if(this.flowChartStartAddresses.length == 0)
                    throw "You need to set at least one start address for a flow chart with '--flowchartaddresses'";
                const text = this.dasm.getFlowChart(this.flowChartStartAddresses);
                writeFileSync(this.flowChartOutPath, text);
            }

            // Output labels
            if(this.lblsOutPath) {
                const text = this.dasm.getMainLabels();
                writeFileSync(this.lblsOutPath, text);
            }

        }
        catch(e) {
            console.error(e);
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

$ z80dismblr --sna myfile.sna --out myfile.list
This will write the disassembly of the snapshot file 'myfile.sna' to file 'myfile.list'.

$ z80dismblr --bin 0x8000 myfile.obj --codelable 0x9000 --out myfile.list
This will write the disassembly of the binary file file 'myfile.obj' to file 'myfile.list'.
The binary file starts at address 0x8000 and the code entry point start at
0x9000 (i.e. here begins the code area).

General usage:
z80dismblr [options]
    -h|-help|--help: Prints this help.
    -v|-version|--version: Prints the version number.
    --args file: Instead of an argument list on the command line it is also possible
        to provide the arguments in a file. There is no special format, just
        provide the arguments. May conatin newlines.
    --sna file: Read in a ZX Spectrum snapshot file (48k format only, i.e. no ROM bank support).
    --bin start file: Read in a plain binary. 'start' is the address in memory for the read binary. You can use this
        argument several times to read inseveral binary files.
        --codelabel or --tr is mandatory to
        obtain any disassembly results.
    --out file: Output file. z80dismblr will write the disassembly here.
    --tr file: Add a MAME trace file. This can be used instead of --codelabel.
        Providing a trace file will increase the quality of the
        disassembly output.
    --codelabel address [labelname]: Known addresses (like the code start
        address) can be given here. If no sna file is given at least one
        codelabel is required so  that disassembly can start from that address.
        Please note that address 0000h is set automatically.You could of course
        set it e.g. to change the label name.
    --noautomaticaddr: The disassemble will automatically add addresss 0000h or
        (if a SNA file has been used) the SNA start address to the labels
        and start disassembly here. If this option is given this behaviour is suppressed.
    --jmptable address size: If it is known that a jump-table exists in memory
        then its address and size can be given here. 'size' is the number of addresses.
    --clrlabels: Clears all albels collected so far. E.g. can be usd to overrule
    the automatic label found in a sna file. Afterwards new labels can be
    defined.
    Can be useful if you want to list a dot file only for a specfic subroutine.

    Prefixes: It is possible to customize the label naming. There are different
    types of labels. For each label type you can define its prefix.
        --subprefix prefix: Prefix for subroutines, e.g. '--subprefix MYSUB'.
        --lblprefix prefix: Prefix for adresses reached by a 'JP'.
        --rstprefix prefix: Prefix for adresses reached via a 'RST'.
        --datalblprefix prefix: Prefix for data areas.
        --selfmodprefix prefix: For selfmodifying address, default is 'SELF_MOD'.
        --locallblprefix prefix: Prefix for local lable, those reached with a (positive)
        'JR'. Note that in front of this prefix the subroutines main prefix is added.
        --localloopprefix prefix: Similar to the local lables but for negative relative jumps.

    Formatting options:
        --clmnsaddress value: The size of the address field at the beginning of the line.
            If 0 no address is shown. Otherwise the address is shown in hex,
            so senseful numbers start at 4.
        --clmnsbytes value: The length used for the opcode bytes.
        --clmnsopcodefirst value: The size of the first part of the opcode, e.g. 'LD'.
        --clmnsopcodetotal value: The size of the complete opcode, e.g. 'LD  A,(HL)'.
        --uppercase: Use upper case for the opcodes, e.g. 'ld a,(hl)'.
        --addbytes: Print also the byte values of the opcodes (the opcode bytes).

        Dot options:
        --callgraphout file: Output a dot file. This file can be used for visualization
            with graphviz. Each bubble is a function and is connected to other
            functions that it calls. Only main labels are written (i.e. no local labels.)
        --callgraphformat formatstring: You can format the text in the dot nodes.
            E.g. use \'--callgraphformat "\${label}\\n\${address}\\nCC=\${CC}\\nSize=\${size}\\ninstr=\${instructions}\\n"
            will show the label name, it's address, the cyclomatic complexity, the size
            in bytes and the number of instructions. Possible labels are:
            - \${label}: The label name.
            - \${address}: It's address.
            - \${CC}: The cyclomatic complexity of the subroutine.
            - \${size}: The size of the subroutine in bytes.
            - \${instructions}: The number of instructions of the subroutine.
            You can use '\\n' for centered text, and '\\l', '\\r' for left- rightaligned text.
        --callgraphhighlight addr1[=red|green|...] addr2 ... addrN: Highlight the associated
        nodes in the dot file with a color.

        Labels options:
        --lblsin file: Input a file with labels, addresses and comments.
            If a label is specified here it will be used instead of the internally generated
            label.
            Also the comments will be used instead of the generated ones.
            I.e. the more you know about the disassembled sources the more labels
            you can add here with meaningful comments. The format is:
                "; coments before the address" (one or several lines)
                "address [name] ; coments on the same line" (address in hex, name is optional)
                "; coments after the address" (one or several lines)
                newline
            Here is an example:
                ; This is the start of the program.
                8000 prg_start

                8002 ; add x+5

        Flow-Charts:
        --flowchartout file: Output file. A file will be generated that contains the flow-chart
            a particular address (subroutine).
        --flowchartaddresses addr1 addr2 ... addrN: This defines the start addresses of the flow-charts. At least one address is required.
    `);
    }


    /**
     * Processes the command line arguments or the arguments read from a file.
     * @param args List of arguments.
     */
    protected static processArgs(args: Array<string>) {
        // Iterate all arguments
        let arg;
        let path;
        let addressString;
        let addr;
        let text;
        let value;
        while(arg = args.shift()) {
            // Check option
            switch(arg) {
                // Help
                case '--help':
                case '-help':
                case '-h':
                    this.printHelp();
                    process.exit(0);
                    break;

                // Version
                case '--version':
                case '-version':
                case '-v':
                    const pckg = require('../package.json');
                    console.log('Version: ' + pckg.version);
                    process.exit(0);
                    break;

                // Arguments file
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
                    this.dasm.readBinFile(origin, path);
                    break;

                // output disassembly file
                case '--out':
                    this.outPath = args.shift();
                    if(!this.outPath) {
                        throw arg + ': No path given.';
                    }
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
                    this.dasm.setFixedCodeLabel(addr, labelName);
                    break;

                // turn off automatic addresses
                case '--noautomaticaddr':
                    this.dasm.automaticAddresses = false;
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

                // set a code label
                case '--clrlabels':
                    this.dasm.clearLabels();
                    break;


                // Prefixes

                // SUB prefix
                case '--subprefix':
                    // get prefix
                    text = args.shift();
                    if(!text || text.length == 0)
                        throw arg + ": No prefix given";
                    // Set prefix
                    this.dasm.labelSubPrefix = text;
                    break;

                // LBL prefix
                case '--lblprefix':
                    // get prefix
                    text = args.shift();
                    if(!text || text.length == 0)
                        throw arg + ": No prefix given";
                    // Set prefix
                    this.dasm.labelLblPrefix = text;
                    break;

                // RST prefix
                case '--rstprefix':
                    // get prefix
                    text = args.shift();
                    if(!text || text.length == 0)
                        throw arg + ": No prefix given";
                    // Set prefix
                    this.dasm.labelRstPrefix = text;
                    break;

                // Data label prefix
                case '--datalblprefix':
                    // get prefix
                    text = args.shift();
                    if(!text || text.length == 0)
                        throw arg + ": No prefix given";
                    // Set prefix
                    this.dasm.labelDataLblPrefix = text;
                    break;

                // Local label prefix
                case '--locallblprefix':
                    // get prefix
                    text = args.shift();
                    if(!text || text.length == 0)
                        throw arg + ": No prefix given";
                    // Set prefix
                    this.dasm.labelLocalLablePrefix = text;
                    break;

                // Local loop prefix
                case '--localloopprefix':
                    // get prefix
                    text = args.shift();
                    if(!text || text.length == 0)
                        throw arg + ": No prefix given";
                    // Set prefix
                    this.dasm.labelLoopPrefix = text;
                    break;

                // Self modifying prefix
                case '--selfmodprefix':
                    // get prefix
                    text = args.shift();
                    if(!text || text.length == 0)
                        throw arg + ": No prefix given";
                    // Set prefix
                    this.dasm.labelSelfModifyingPrefix = text;
                    break;


                // Formatting

                // Start lines with address
                case '--clmnsaddress':
                    // get value
                    text = args.shift();
                    value = this.parseValue(text);
                    if(isNaN(value))
                       throw arg + ": Wrong value " + text;
                    this.dasm.clmnsAddress = value;
                    break;

                // The opcode bytes
                case '--clmnsbytes':
                    // get value
                    text = args.shift();
                    value = this.parseValue(text);
                    if(isNaN(value))
                       throw arg + ": Wrong value " + text;
                    this.dasm.clmnsBytes = value;
                    break;

                // The size of the first part of the opcode, e.g. 'LD'
                case '--clmnsopcodefirst':
                    // get value
                    text = args.shift();
                    value = this.parseValue(text);
                    if(isNaN(value))
                       throw arg + ": Wrong value " + text;
                    this.dasm.clmnsOpcodeFirstPart = value;
                    break;

                // The size of the complete opcode, e.g. 'LD  A,(HL)'
                case '--clmnsopcodetotal':
                    // get value
                    text = args.shift();
                    value = this.parseValue(text);
                    if(isNaN(value))
                       throw arg + ": Wrong value " + text;
                    this.dasm.clmsnOpcodeTotal = value;
                    break;

                // Use upper case for opcodes
                case '--uppercase':
                    this.dasm.opcodesLowerCase = false;
                    break;

                // print also ocode byte values
                case '--addbytes':
                    this.dasm.addOpcodeBytes = true;
                    break;


                // DOT:

                // output dot file
                case '--callgraphout':
                    this.callGraphOutPath = args.shift();
                    if(!this.callGraphOutPath) {
                        throw arg + ': No path given.';
                    }
                    break;

                // Format string for the dot nodes
                case '--callgraphformat':
                    const dotformat = args.shift();
                    if(!dotformat) {
                        throw arg + ': No format string given.';
                    }
                    this.dasm.dotFormat = dotformat;
                    break;

                // Highlight certain addressed in dot file
                case '--callgraphhighlight':
                    while(true) {
                        // parse address
                        const addressColorString = args.shift();
                        if(!addressColorString)
                            break;
                        // Check for next option
                        if(addressColorString.startsWith('--')) {
                            // is the next arguments
                            args.unshift(addressColorString);
                            break;
                        }
                        // search for '='
                        const k = addressColorString.indexOf('=');
                        let colorString;
                        let addressString
                        if(k >= 0) {
                            // parse color
                            colorString = addressColorString.substr(k+1);
                            addressString = addressColorString.substr(0,k);
                        }
                        else {
                            // use default color
                            colorString = "yellow";
                            addressString = addressColorString;
                        }
                        addr = this.parseValue(addressString);
                        if(isNaN(addr)) {
                            throw arg + ": Not a number: " + addressString;
                        }
                        // Add pair to map
                        this.dasm.setDotHighlightAddress(addr, colorString);
                    }
                    break;


                // Labels in/out:

                // Labels out file (this is an option more for debugging, not mentioned in help)
                case '--lblsout':
                    this.lblsOutPath = args.shift();
                    if(!this.lblsOutPath) {
                        throw arg + ': No path given.';
                    }
                    break;

                // Labels in file
                case '--lblsin':
                    this.lblsInPath = args.shift();
                    if(!this.lblsInPath) {
                        throw arg + ': No path given.';
                    }
                    break;


                // Flow-Charts:

                // Flow-Chart outfile
                case '--flowchartout':
                    this.flowChartOutPath = args.shift();
                    if(!this.flowChartOutPath) {
                        throw arg + ': No path given.';
                    }
                    break;

                // The addresses for the flow charts
                case '--flowchartaddresses':
                    while(true) {
                        // parse address
                        const addressString = args.shift();
                        if(!addressString)
                            break;
                        // Check for next option
                        if(addressString.startsWith('--')) {
                            // is the next arguments
                            args.unshift(addressString);
                            break;
                        }
                        addr = this.parseValue(addressString);
                        if(isNaN(addr)) {
                            throw arg + ": Not a number: " + addressString;
                        }
                       // Add to array
                       this.flowChartStartAddresses.push(addr);
                    }
                    break;


                default:
                    throw "Unknown argument: '" + arg + "'";
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
        const len = argsData.length;
        while(true) {
            let val;
            while(true) {
                // skip whitespaces
                k = this.skipWhiteSpaces(argsData, k);
                if(k >= len)
                    return args;    // End of file reached
                // check for comment
                val = argsData[k];
                if(val != '#')
                    break;
                // skip comment
                k = argsData.indexOf('\n', k+1);
                if(k < 0)
                    return args;  // End of file reached
            }

            // Check if first character is a ' or "
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
        // Will never reach here.
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