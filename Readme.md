# z80-dismblr

z80dismblr is a Z80 commandline disassembler written in typescript.

**Note: The disassembler is not complete yet. The current version doesn't output good results yet. I have put it for myself in github. Please wait a little while (a few weeks) until this is usable.**


## Features

- Disassembles the given binary by stepping through all branches.
- Divides into data and code area.
- Creates labels from hex addresses.
- Distinguishes labels for subroutines or jump addresses.
- Separates subroutines visually.
- Uses "local" label syntax inside subroutines.
- Points out all callers of a subroutine.
- Customization of the output
	- Label prefixes
	- list file with or without address and opcode bytes
	- Opcodes in upper or lower case
- Can read MAME trace (*.tr) files for better results.
- Supports *.sna (snapshot) files.
- Supports *.z80 (snapshot) files.
- Supports undocumented opcodes.
- Supports Spectrum Next opcodes.


## Installation


## Usage

Note: Usage is shown here for MacOS only, should work similar for Linux and Windows.

To create an assembler listing for the snapshot file of 'myfile.sna' just use:
~~~
$ ./z80dismblr-macos --sna myfile.sna > myfile.list
~~~~

It reads in the file (which is in SNA file format) and writes it to stdout which is redirected into the 'myfile.list' file.

The disassembly looks like this:
~~~
; Subroutine is referenced by 3 locations:
; 0x8e67(in SUB156), 0x8e3e(in LBL088), 0x8e87(in LBL089)
8E73 SUB157:
8E73 79           LD   A,C
8E74 0F           RRCA
8E75 0F           RRCA
8E76 0F           RRCA
8E77 0F           RRCA
8E78 0F           RRCA
8E79 E6 07        AND  7      ; 07h
8E7B 6F           LD   L,A
8E7C 78           LD   A,B
8E7D 0F           RRCA
8E7E 0F           RRCA
8E7F E6 38        AND  56     ; 38h, '8'
8E81 B5           OR   L
8E82 C9           RET


; Label is referenced by 1 location:
; 0x7537(in LBL013)
8E83 LBL089:
8E83 ED 4B C4 95  LD   BC,(DATA166) ; 95C4h
8E87 CD 73 8E     CALL SUB157 ; 8E73h
8E8A 26 8D        LD   H,141  ; 8Dh, -115
8E8C 0E 08        LD   C,8    ; 08h
8E8E 91           SUB  A,C
8E8F 6F           LD   L,A
8E90 2D           DEC  L
8E91 CB 46        BIT  0,(HL)
8E93 20 1A        JR   NZ,.lbl089_loop2 ; 8EAFh
8E95 2C           INC  L
~~~

A SNA filecontains an entry point into the code. So it is not necessary to provide a'--codelabel'.
However, the entry point in the SNA file might not be very good for disassembly purposes in that case
prepare more information via '--codelabel'.


You can also read in binary files (without headers), e.g. MAME roms.
For binary files you have to provide additional info of the offset address
of the loaded file.
~~~
$ ./z80dismblr-macos --bin 0 rom1.bin --bin 0x1000 rom2.bin --bin 0x2000 rom3.bin --codelabel 0x800 MAIN_START --codelabel 0 INIT > roms.list
~~~~
This will load 3 binary files (rom1.bin, rom2.bin and rom3.bin).
rom1.bin starts at address 0, rom2.bin at address 0x1000 and rom3.bin at address 0x2000.
There are 2 initial labels where code starts: at 0x800 the main program starts. At address 0 the initialization starts.

If nothing is known about a program you can only assume that program code starts at address 0, but you have to provide at least one address via --codelabel.

If you know nothing about the code the better way will be to provide a MAME trace file. I.e. you run MAME with the debugger and the trace option
and save it to a file, e.g. myfile.tr.
Now you start a disassembly and provide the file:
~~~
$ ./z80dismblr-macos --bin 0 rom1.bin --bin 0x1000 rom2.bin --bin 0x2000 rom3.bin --tr myfile.tr > roms.list
~~~
Note that you can but you don't have to provide a --codelable in this case.


You can higly customize the appearance of the output, e.g. you can specify if the address is shown in front of each line or if the opcode bytes are shown.

~~~
; Subroutine is referenced by 1 location:
; 0xe1f1(in SUB305)
SUB156:
             bit  0,e
             jr   z,.sub156_l ; 8E67h
             ld   hl,36353 ; 8E01h, -29183
             ld   (hl),c
             inc  hl
             ld   (hl),b
.sub156_l:
             call sub157 ; 8E73h
             ld   h,141  ; 8Dh, -115
             ld   l,a
.sub156_loop:
             ld   (hl),e
             inc  hl
             dec  d
             jr   nz,.sub156_loop ; 8E6Dh
             ret
~~~

Please use
~~~
$ ./z80dismblr-macos -h
~~~
to print a help for all allowed arguments.


# Config file

Instead of a big argument list you can also pass all arguments via a file.
The format is exactly the same as on the commandline.
To disassemble the rom file from above you would need a file with
the following contents:
~~~
$ cat argsfile
--bin 0 rom1.bin
--bin 0x1000 rom2.bin
--bin 0x2000 rom3.bin
--tr myfile.tr
~~~

~~~
$ ./z80dismblr-macos --args argsfile > roms.list
~~~



## How it works



