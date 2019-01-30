## 1.4.2
- Corrected opcode "SUB A,s" to "SUB s".
- Added new Z80N barrel shift and "JP (C)" opcodes.
- Corrected "JP (IX)" and "JP (IY)" disassembly.
- Made "JP (HL)" etc. a stopping insruction.

## 1.4.1
- Improved decoding of 'NEXTREG': Register names are decoded.
- Internal changes for z80-debug.


## 1.4.0
- "--opcode": User opcode extensions
- Branch labels that jump into the middle of an opcode adjusted. These use offsets now (e.g. "JP LBL1+1").
- Warnings added for wrong branch labels.
- Warnings added for code that is accessed as data (self-modifying code).
- Corrected handling of apostrophes in argument files.


## 1.3.0
- Output of flowcharts:
  "--flowchartout" and "--flowchartaddresses: Output flow-chart for a particular address (subroutine).
- "--dot..." renamed to "--callgraph...".


## 1.2.0
- "--dotformat": Formatting of dot node output.
- Changed "--noaddr0" to "--noautomaticaddr". Also suppresses the SNA start address.
- Subroutines are divided into several subroutines if not in a coherent block.
- Opcodes use hex numbers now, comments decimal.
- "--lblsin": Input of labels with comments.


## 1.1.0
- Supports output of callgraphs into dot files for visualization with graphviz.
- Callgraph visualization emphasizes:
  - Code start
  - Leafs
  - Interrupt
- Improved trace file parsing.
- Better interrupt recognition.


## 1.0.0
- Disassembles the given binary via Code-Flow-Grap analysis.
- Divides into data and code area.
- Creates labels from hex addresses.
- Distinguishes labels for subroutines or jump addresses.
- Separates subroutines visually.
- Uses "local" label syntax inside subroutines.
- Points out all callers of a subroutine.
- Customization of the output
- Label prefixes
- List file with or without address and opcode bytes
- Opcodes in upper or lower case
- Can read MAME trace (*.tr) files for better results.
- Supports *.sna (snapshot) files.
- Supports undocumented opcodes.
- Supports Spectrum Next opcodes.


## 0.2.0
- Support for mame .tr (trace) files.

## 0.1.0
Initial version.
