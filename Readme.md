# z80dismblr

z80dismblr is a Z80 command line disassembler written in typescript.

Note: The work on z80dismblr is not continued. Instead it has been incorporated into [DeZog](https://github.com/maziac/DeZog) debugger and has been extended there.
It turned out that inside a debugger the disassembler can be used more interactively and effective.


## Features

- Supports binary and *.sna (snapshot) files.
- Can read MAME trace (*.tr) files for better results.
- Supports undocumented opcodes.
- Supports Spectrum Next opcodes.
- Graphical visualization via Graphivz .dot of
  - call graphs
  - flow-charts
- Disassembles the given binary via Code-Flow-Graph analysis.
- Divides into data and code area.
- Separates subroutines visually.
- Creates labels from hex addresses.
- Uses "local" label syntax inside subroutines.
- Points out all callers/callees of a subroutine.
- Customization of the output
  - Label prefixes
  - List file with or without address and opcode bytes
  - Opcodes in upper or lower case


## Installation

<!--
You can either install the npm z80dismblr package or use the provided executables directly.

npm install:
~~~
$ npm install z80dismblr
~~~

If you want to use the executable instead you find executables for Windows, Mac and Linux [here](https://github.com/maziac/z80dismblr/releases). Simply download and execute from the command line.
-->

At the moment there is no npm install package available but you can install the executable directly.
Executables exist for Windows, Mac and Linux.
Just download [here](https://github.com/maziac/z80dismblr/releases), unzip and execute from the command line.


## Usage

Simply execute the unzipped file from the shell.

_Note: Usage is shown here for MacOS only, it should work similar for Linux and Windows._

To create an assembler listing for the snapshot file 'myfile.sna' just use:
~~~
$ ./z80dismblr-macos --sna myfile.sna --out myfile.list
~~~

It reads in the file (which is in SNA file format) and writes it to the 'myfile.list' file.

For example the disassembly looks like this:
~~~
; Data is referenced by 5 locations:
; 9011h(in SUB164), 9048h(in SUB167), 901Ch(in SUB166), 9031h(in SUB166), 9018h(in SUB165)
8FED DATA146:
8FED 00           DEFB 0      ; 00h

...

; Subroutine: Size=38, CC=4.
; Called by: INTRPT1[A612h].
; Calls: SUB164.
901C SUB166:
901C 2A ED 8F     LD   HL,(DATA146) ; 8FEDh
901F .sub166_loop:
901F 7E           LD   A,(HL)
9020 FE FF        CP   255    ; FFh,   -1
9022 28 11        JR   Z,.sub166_l2 ; 9035h
9024 11 00 30     LD   DE,12288 ; 3000h
9027 CB 77        BIT  6,A
9029 28 01        JR   Z,.sub166_l1 ; 902Ch
902B 1C           INC  E
902C .sub166_l1:
902C 12           LD   (DE),A
902D 32 00 10     LD   (DATA003),A ; 1000h
9030 23           INC  HL
9031 22 ED 8F     LD   (DATA146),HL ; 8FEDh
9034 C9           RET
9035 .sub166_l2:
9035 2A EF 8F     LD   HL,(DATA148) ; 8FEFh
9038 23           INC  HL
9039 23           INC  HL
903A CD 0A 90     CALL SUB164 ; 900Ah
903D 7C           LD   A,H
903E B7           OR   A
903F 20 DE        JR   NZ,.sub166_loop ; 901Fh
9041 C9           RET
~~~

A SNA file contains an entry point into the code. So it is not necessary to provide a'--codelabel'.
However, the entry point in the SNA file might not be very good for disassembly purposes in that case
prepare more information via '--codelabel'.


You can also read in binary files (without headers), e.g. MAME roms.
For binary files you have to provide additional info of the offset address
of the loaded file.
~~~
$ ./z80dismblr-macos --bin 0 rom1.bin --bin 0x1000 rom2.bin --bin 0x2000 rom3.bin --codelabel 0x800 MAIN_START --out roms.list
~~~
This will load 3 binary files (rom1.bin, rom2.bin and rom3.bin).
rom1.bin starts at address 0, rom2.bin at address 0x1000 and rom3.bin at address 0x2000.
There are 2 initial labels where code starts: at 0x800 the main program starts. Address 0 is added automatically as program start.

If you know nothing about the code the better way will be to provide a MAME trace file. I.e. you run MAME with the debugger and the trace option
and save it to a file, e.g. myfile.tr.
Now you start a disassembly and provide the file:
~~~
$ ./z80dismblr-macos --bin 0 rom1.bin --bin 0x1000 rom2.bin --bin 0x2000 rom3.bin --tr myfile.tr --out roms.list
~~~
Note that you can but you don't have to provide a --codelable in this case.


You can higly customize the appearance of the output, e.g. you can suppress the shown address or the opcode bytes.

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


### Arguments File

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
$ ./z80dismblr-macos --args argsfile --out roms.list
~~~


## Statistics

Apart from the disassembly output with the labels and the mnemonics z80dismblr also prints out a few statistics in the comments.
For each subroutines it lists the callers and callees.
Additional the size of the subroutine is shown in bytes and the cyclomatic complexity (CC).

~~~
; Subroutine: Size=27, CC=1.
; Called by: SUB300[D74Ch], SNA_LBL_MAIN_START_A660[CBA0h].
; Calls: SUB042, SUB046, SUB077, SUB086, SUB244, SUB245.
D72E SUB299:
~~~

## Visualization

### Caller Graphs

With the '--callgraphout' option it is possible to let z80dismblr create .dot files for use with [Graphviz](http://www.graphviz.org).

Here is an example for the program "Star Warrior" (48K ZX Spectrum). Use z80dismblr like this:
~~~
$ ./z80dismblr-macos --sna starwarrior.sna --out starwarrior.list --callgraphout starwarrior.dot
~~~

It will generate the 'starwarrior.dot' file from the SNA file.
If you look at the dot file with Graphviz it will look like this:

![](documentation/images/starwarrior_dot.jpg)

Although this looks very confusing on first sight a few things can be learned from this view:

- We get an overview of all subroutines and how there are interconnected. Each arrow means: subroutine "SUBn" calls subroutine "SUBm".
- Each bubble represents a subroutine (or entry point). It contains the name, its size in bytes and its cyclomatic complexity.
- The size of the bubble is related to its size in bytes. I.e. bigger subroutines lead to bigger bubbles.
- We can see the leafs, i.e. the subroutines that do not call other subroutines. Often these are very generic functions like math calculations etc. When doing reverse engineering it is often helpful to start with those functions and work from bottom to top to understand the
higher layer subroutines.
- We can see one or more roots, e.g. the main routine. We can also try a top-down analysis to understand the called subroutines.
- Calls into unassigned memory (i.e. addresses outside of the given binary) are shown in gray.


The highlighted roots:

![](documentation/images/starwarrior_dot_root.jpg)
![](documentation/images/starwarrior_dot_root2.jpg)
![](documentation/images/starwarrior_wrong_sub.jpg)

This example shows 4 roots. Why is this?
1. SNA_LBL_MAIN_START_A660 is the address from the SNA file. Since no other code parts reference (jumps to) it, it is a root. Here truly the program starts.
2. INTRPT1 is the interrupt that is called 50 times per second on the Spectrum.
Normally z80dismblr cannot find interrupts because it uses a CFG analysis and if no location refers to the interrupt z80dismblr cannot see it. So you would have to manually set the interrupt address via an argument to z80dismblr ("--codelabel address"). In this case however the "-tr" option was used and so z80dismblr could additionally analyze the traces and find the interrupt by itself.
3. INTRPT2: This in fact is the real interrupt location. Here a simple "JP INTERPT1" could be found. The reason why z80dismblr did not draw any lines from here is: it is self-modifying code. The binary that z80dismblr analyzed simply contains 3 "NOP" operations. Thus there is no label. The jump operation and the jump location is written by executing the code. But since z80dismblr doesn't do a dynamic analysis it cannot see the these values.
4. SUB007: This looks strange. And indeed, this helped me to find an error in the assembler program. It was hard to find but in the end the code boiled down to the very simple:
~~~
711D:
        ...
        CALL NZ,711D
        ...
~~~
I.e. a recursive call to itself which was wrong coding simply. I didn't intend to write a recursive function.
However z80dismblr thinks 711D is a subroutine because it is called via a CALL so it assigns the 711D as a label ("SUB007"). But no other location refers to 711D so that the address has no caller, i.e. no arrow pointing to it.
z80dismblr will spit out a warning now in cases like the one above:
~~~
$ Warning: Address: 711Dh. A subroutine was found that calls itself recursively but is not called from any other location.
~~~
In the dot graphic the subroutine is highlighted by a different color.

---


A leaf (i.e. a subroutine that does not call any other subroutine):

![](documentation/images/starwarrior_dot_leaf.jpg)


A call to unassigned memory result in a gray bubble (in case of SNA files for the ZX Spectrum this would be calls into the ROM area):

![](documentation/images/starwarrior_dot_equ.jpg)


#### Sub Call Graphs

It is also possible to let z80dismblr generate only a part of the caller graphs e.g. to focus on a certain subroutine.

For this add "--noautomaticaddr" to the commandline. This will prevent that z80dismblr will use address 0000 or the SNA start address automatically.

Additionally add the address of the subroutine you want to see with a "--codelabel" option:
~~~
$ ./z80dismblr-macos --sna starwarrior.sna --callgraphout starwarrior.dot --noautomaticaddr --codelabel 0x735E SUB19
~~~
You can additionally add a label name (here we chose "SUB19" so that it is the same name as in the big caller graph diagram).
You can get the address from the previously created 'starwarrior.list' file.

The result is a call graph just for the subroutine at address 0x753E:

![](documentation/images/starwarrior_sub19.jpg)



### Flow Charts

Via the '--flowchart...' arguments it is possible to create flowcharts of subroutines.

With '--flowchartout filename' you specify the output path. The generated file is a .dot file that can be visualized with [Graphviz](http://www.graphviz.org).

with '--flowchartaddresses addr1 addr2 ... addrN' you can specify one or more subroutines that you want to visualize.

E.g.:
~~~
$ ./z80dismblr-macos --sna starwarrior.sna --flowchartout fc.dot --flowchartaddresses 7015h A3ABh
~~~
will create the following graph:

![starwarrior_fc_dot](documentation/images/starwarrior_fc_dot.jpg)

## "Interactive" Usage

During reverse engineering of a binary at first very little is known about the code.
Then after looking at the disassembly the one or the other subroutine is understood and can be commented with more senseful comments than the one that z80dismblr generates.

Therefore you can input a file with labels and comments via the '--lblsin file' option.

The file is read and substitutes the label name and the comments for a given address.

Here is a small real world example of a printing subroutine.
The original disassembled code:
~~~
; Subroutine: Recursive, Size=44, CC=4.
; Called by: SUB443[D752h], SUB442[D734h], SUB178[8405h], SUB179[8439h], SUB005[706Dh], SUB359[CB27h], self[7631h], SUB006[70A9h], SUB004[7054h].
; Calls: SUB039, SUB055, SUB103.
760A SUB055:
760A 7E           ld   a,(hl)
760B 23           inc  hl
760C FE FF        cp   FFh    	; 255,   -1
760E C8           ret  z
760F FE FE        cp   FEh    	; 254,   -2
7611 28 09        jr   z,.sub055_l1 	; 761Ch
7613 FE FD        cp   FDh    	; 253,   -3
7615 28 15        jr   z,.sub055_l2 	; 762Ch
7617 CD 44 74     call SUB039 	; 7444h
761A 18 EE        jr   SUB055 	; 760Ah
761C .sub055_l1:
761C 7E           ld   a,(hl)
761D 23           inc  hl
761E E5           push hl
761F 66           ld   h,(hl)
7620 6F           ld   l,a
7621 7E           ld   a,(hl)
7622 23           inc  hl
7623 66           ld   h,(hl)
7624 6F           ld   l,a
7625 CD 24 7B     call SUB103 	; 7B24h
7628 .sub055_loop:
7628 E1           pop  hl
7629 23           inc  hl
762A 18 DE        jr   SUB055 	; 760Ah
762C .sub055_l2:
762C 7E           ld   a,(hl)
762D 23           inc  hl
762E E5           push hl
762F 66           ld   h,(hl)
7630 6F           ld   l,a
7631 CD 0A 76     call SUB055 	; 760Ah
7634 18 F2        jr   .sub055_loop 	; 7628h
~~~

After analyzing we find out what the purpose is and how it works so we add comments in a special file:
~~~
; Subroutine to print a text in HL until an end-of-string (0xFF) is found.
; There is a little formatting allowed:
; FEh: the next 2 bytes are interpreted as a number
; FDh: the next 2 bytes are interpreted as a pointer to another text
; (which could also contain formatting.)
760a sub_print_formatted_text_hl

760c ; End of string

760f ; integer (%d)

7613 ; string (%s)
~~~

This results in the more readable disassembly:
~~~
; Subroutine to print a text in HL until an end-of-string (0xFF) is found.
; There is a little formatting allowed:
; FEh: the next 2 bytes are interpreted as a number
; FDh: the next 2 bytes are interpreted as a pointer to another text
; (which could also contain formatting.)
760A sub_print_formatted_text_hl:
760A 7E           ld   a,(hl)
760B 23           inc  hl
760C FE FF        cp   FFh    	; End of string
760E C8           ret  z
760F FE FE        cp   FEh    	; integer (%d)
7611 28 09        jr   z,.sub_print_formatted_text_hl_l1 	; 761Ch
7613 FE FD        cp   FDh    	; string (%s)
7615 28 15        jr   z,.sub_print_formatted_text_hl_l2 	; 762Ch
7617 CD 44 74     call SUB039 	; 7444h
761A 18 EE        jr   sub_print_formatted_text_hl 	; 760Ah
761C .sub_print_formatted_text_hl_l1:
761C 7E           ld   a,(hl)
761D 23           inc  hl
761E E5           push hl
761F 66           ld   h,(hl)
7620 6F           ld   l,a
7621 7E           ld   a,(hl)
7622 23           inc  hl
7623 66           ld   h,(hl)
7624 6F           ld   l,a
7625 CD 24 7B     call SUB102 	; 7B24h
7628 .sub_print_formatted_text_hl_loop:
7628 E1           pop  hl
7629 23           inc  hl
762A 18 DE        jr   sub_print_formatted_text_hl 	; 760Ah
762C .sub_print_formatted_text_hl_l2:
762C 7E           ld   a,(hl)
762D 23           inc  hl
762E E5           push hl
762F 66           ld   h,(hl)
7630 6F           ld   l,a
7631 CD 0A 76     call sub_print_formatted_text_hl 	; 760Ah
7634 18 F2        jr   .sub_print_formatted_text_hl_loop 	; 7628h
~~~

Please note:
- The label for the address is used now not only at address 760A but also in all locations that jump to or call this address. See e.g. address 761A or 7631
- The addresses 7D0C, 760F and 7613 get an inline comment which explains roughly the purpose of the comparison.



## Recommendations

If you know nothing about the binary that you disassemble the output of the z80dismblr might be disappointing.
According to the way how it executes the disassembly (see [How it works](#how-it-works)) it can easily happen that not all code paths are found.

Thus the more you know about the code and the more '--codelabel' entries you can pass as arguments the better.

If you still don't know nothing about the binary then you should get a trace file e.g. from MAME. This trace file is obtained from the MAME debugger while executing the binary.
It's format is a simple disassembly with the first number being the hex address (in ASCII) followed by the disassembly of the executed code.
z80dismblr does mainly look for the hex address and assumes all of these addresses to be CODE area that need to be disassembled. It only looks into the disassembly part of the trace file to find 'jp (hl)' instructions. It uses those to define the right references to the labels.

Please note that using a trace file can result in surprising issues in case of self modifying code.
As z80dismblr doesn't know about dynamic changes you might find code areas with senseless opcodes (or NOPs). This is because the code is re-written by the assembler program during runtime. For code based on ROMs this shouldn't happen, but for code that resides in RAM (e.g. ZX Spectrum programs) this can be an issue.



## How It Works

The z80dismblr uses a [Control-Flow-Graph](https://en.wikipedia.org/wiki/Control_flow_graph) (CFG) to analyze the binary file(s).
I.e. it runs through the code through all possible paths and disassembles it.

Consider the following example:

~~~
0008h 87           ADD  A,A
0009h 30 05        JR   NC,0010h
000Bh 24           INC  H
000Ch C3 10 00     JP   0010h

000Fh FF           ??

0010h 85           ADD  A,L
0011h 6F           LD   L,A
0012h D0           RET  NC
0013h 24           INC  H
0014h 3A 18 00     LD   A,(0018h)
0017h C9           RET

0018h FF           ??
~~~

If z80dismblr is told to start at address 0008h it steps through the code until a branch (JR, JR cc, JP, JP cc, CALL or Call cc) is found.
It then uses the new address as another start point to opcodes.
Depending on the branch instruction it continues to disassemble at the following address or stops (e.g. JP unconditional).

For the code above this leads to the following CFG:
~~~
 ┌──────────────┐
 │ 08h: ADD A,A │      Start
 └──────────────┘
         │
         ▼
 ┌──────────────┐
 │09h: JR NC,10h│───────────┐
 └──────────────┘           │
         │                  ▼
         │          ┌──────────────┐
         │          │  0Bh: INC H  │
         │          └──────────────┘
         │                  │
         │                  ▼
         │          ┌──────────────┐
         │          │ 0Ch: JP 10h  │
         │          └──────────────┘
         │                  │
         ▼                  │
 ┌──────────────┐           │
 │ 10h: ADD A,L │◀──────────┘
 └──────────────┘
         │
         ▼
 ┌──────────────┐
 │ 11h: LD L,A  │
 └──────────────┘
         │
         ▼
 ┌──────────────┐    As the return address is unknown
 │ 12h: RET NC  │    to the disassembler this opcode
 └──────────────┘    doesn't imply branching.
         │
         ▼
 ┌──────────────┐
 │  13h: INC H  │
 └──────────────┘
         │
         ▼
┌─────────────────┐
│14h: LD A,(0018h)│
└─────────────────┘
         │
         ▼
 ┌──────────────┐
 │   17h: RET   │      Stop
 └──────────────┘
~~~

We can see already a few important points:
- The data at addresses 000Fh is not disassembled as this data is not reachable.
- The disassembly will stop if all branch addresses have been analyzed.

Additionally to the CFG analysis there is also a code and data label analysis.
This is why address 0018h can be interpreted.
The disassembler interprets all opcodes that deal with data addresses like in 'LD A,(0018h)'.
This addresses are known to contain data and so the disassembler disassembles the bytes
to a 'DEFB' and assigns a label to it.

Here is the resulting disassembly:
~~~
0008 RST08:
0008 87           ADD  A,A
0009 30 05        JR   NC,RST16 ; 0010h
000B 24           INC  H
000C C3 10 00     JP   RST16  ; 0010h

000F FF           DEFB 255    ; FFh,   -1

0010 RST16:
0010 85           ADD  A,L
0011 6F           LD   L,A
0012 D0           RET  NC
0013 24           INC  H
0014 3A 18 00     LD   A,(LBL_DATA1)
0017 C9           RET

0018 LBL_DATA1:
0018 FF           DEFB 255    ; FFh,   -1
~~~


### Flow-through

Consider the following code:
~~~
SUB1:
             LD   B,34
             LD   D,1

SUB2:
             LD   A,33
             RET

START:
             CALL SUB1
             CALL SUB2
             RET
~~~
There are 2 subroutines SUB1 and SUB2. SUB1 flows-through into SUB2.
So for the disassembler it is not clear to which subroutine the bytes "LD A,33" belong.
This is solved by the following idea:
The code above is logically the same as this:
~~~
SUB1:
             LD   B,34
             LD   D,1
             CALL SUB2    <- Instead of flow-through
             RET          <- Instead of flow-through

SUB2:
             LD   A,33
             RET

START:
             CALL SUB1
             CALL SUB2
             RET
~~~
I.e. z80dismblr wil only treat "LD B,34" and "LD D,1" as belonging to SUB1.
"LD A,33" and the following "RET" belong to SUB2.
Additionally it adds a reference from SUB1 to SUB2 because SUB1 flows-through/calls
SUB2. The references can be found in the comments output of the disassembler.
The result is shown here:
~~~
; Subroutine: Size=4, CC=1.
; Called by: START[8007h].
; Calls: SUB2.
SUB1:
             LD   A,34   ; 22h, '"'
             LD   A,1    ; 01h


; Subroutine: Size=3, CC=1.
; Called by: START[800Ah], SUB1[8002h].
; Calls: -
SUB2:
             LD   A,33   ; 21h, '!'
             RET


; Subroutine: Size=7, CC=1.
; Called by: -
; Calls: SUB1, SUB2.
START:
             CALL SUB1   ; 8000h
             CALL SUB2   ; 8004h
             RET
~~~



## Misc

### Opcode Extensions

It is possible to tweak some opcodes a little bit. I.e. it is possible to instruct z80dismblr to treat the data following the opcode in a special way and add it to the disassembly text of the preceding opcode.

E.g. consider the following assembler listing

~~~
LD A,05h
RST 08h
DEFB 3Eh
LD HL,1234h
~~~

In this example the "RST 8" will modify the stack in such a way that it a) looks for the value following the "RST 8" instruction and b) return to the instruction after the additional byte, i.e. "LD HL,1234h".

To modify opcode you need the '--opcode byte appendtext' argument.

'byte' is the opcode to extend (in this case 0xCF for "RST 8") and 'appendtext' contains the formatting for the additional byte.

I.e. with this argument '--opcode 0xCF ", CODE=#n"' the disassembly will look like:

~~~
LD A,05h
RST 08h, CODE=3Eh  	; Custom opcode
LD HL,1234h
~~~

Please note that without the extended opcode z80dismblr would have interpreted the 3Eh as an opcode. Now it ignores it and the disassembly continues at "LD HL,1234h".



