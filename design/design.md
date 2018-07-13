# SW Design

## Overview

~~~~
┌───────────────────────────────────────────────────┐   ┌──────────┐
│                                                   │   │          │
│                   Disassembler                    │   │          │
│                                                   │   │          │
└───────────────────────────────────────────────────┘   │          │
                                                        │ Utility  │
┌──────────────┐   ┌──────────────┐  ┌──────────────┐   │          │
│              │   │              │  │              │   │          │
│    Memory    │   │    Opcode    │  │    Label     │   │          │
│              │   │              │  │              │   │          │
└──────────────┘   └──────────────┘  └──────────────┘   └──────────┘
~~~~

**Disassembler**: The main program. Does step through the process shown in the flow diagram below.

**Memory**: The bin file is loaded here. Several memory areas are possible.

**Opcode**: Defines all opcodes for disassembly.

**Label**: The found labels (addresses) are stored in an array.

**Utility**: Helper methods.


## Flow diagram

~~~
                                   Start from the given code
         ┌───────────────────┐   labels, check all opcodes for         Mark the code areas.
         │  Collect labels   │    branches and add branches to
         └───────────────────┘          the labels list.
                   │
                   ▼
      ┌─────────────────────────┐
      │Find self-modifying code │   Find those labels that alter
      └─────────────────────────┘              code.
                   │
                   ▼
  ┌────────────────────────────────┐  Count the maximum number of labels per type.
  │Count number of types of labels │   Used to determine the number of digits for
  └────────────────────────────────┘            the names of the labels.
                   │
                   ▼
        ┌────────────────────┐      Loop through the labels list and assign
        │ Assign label names │        names depending on the label type.
        └────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐   Disassemble the opcode and exchange
│ Disassemble opcode with label names │     the addresses with label names.
└─────────────────────────────────────┘
                   │
                   ▼
    ┌────────────────────────────┐
    │ Add all EQU labels to the  │         Labels marked as EQU are
    │beginning of the disassembly│              output first.
    └────────────────────────────┘
~~~
