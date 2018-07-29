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
