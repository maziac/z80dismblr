# z80-dismblr

z80dismblr is a Z80 commandline disassembler written in typescript.

**Note: The disassembler is not complete yet. The current version doesn't output good results yet. I have put it for myself in github. Please wait a little while (a few weeks) until this is usable.**


## Features

- Disassembles the given binary by stepping through all branches.
- Divides into data and code area.
- Creates labels from hex addresses.
- Distinguishes labels for subroutines or jump addresses.
- Uses "local" label syntax inside subroutines.
- Points out all callers of a subroutine.
- Customization of the output
	- Label prefixes
	- list file with or without address and opcode bytes
	- Opcodes in upper or lower case
- Can read MAME trace (*.tr) files for better results.
- Supports *.sna (snapshot) files.
- Supports undocumented opcodes.
- Supports Spectrum Next opcodes.


## Installation


## Usage

No commandline interface yet.



