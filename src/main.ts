import { Disassembler } from './disasm';


class Startup {
    public static main(): number {
        let snaPath;
        const dasm = new Disassembler();

        // Get arguments
        const args = process.argv.splice(2);

        // Check for help
        if(args.length == 0) {
            this.printHelp();
            return 0;
        }

        // Iterate all arguments
        let arg;
        while(arg = args.shift()) {
            // Check for error
            if(!arg.startsWith('--')) {
                // error
                console.log("Unknown option: '" + arg + "'");
                return 1;
            }

            // Check option
            switch(arg) {
                // Help
                case '--help':
                case '-help':
                case '-h':
                    this.printHelp();
                    return 0;

                // SNA file
                case '--sna':
                    const path = args.shift();
                    if(!path) {
                        console.log('No path given.');
                        return 1;
                    }
                    dasm.readSnaFile(path);
                    break;

                default:
                    console.log("Unknown argument: '" + arg + "'");
                    return 1;
            }
        }

        // Execute

        return 0;
    }


    /**
     * Prints command line help.
     */
    protected static printHelp() {
        console.log('Help');
    }
}



Startup.main();