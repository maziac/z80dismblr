# Z80DISMBLR SW Design

## Overview

~~~~
┌───────────────────────────────────────────────────┐   ┌──────────┐
│                                                   │   │          │
│                   Disassembler                    │   │          │
│                                                   │   │          │
└───────────────────────────────────────────────────┘   │          │
                                                        │          │
┌───────────────┐  ┌──────────────┐  ┌──────────────┐   │  Format  │
│    Memory     │  │              │  │              │   │          │
│ ┌────────────┐│  │              │  │              │   │          │
│ │    Base    ││  │    Opcode    │  │   DisLabel   │   │          │
│ │   Memory   ││  │              │  │              │   │          │
│ └────────────┘│  │              │  │              │   │          │
└───────────────┘  └──────────────┘  └──────────────┘   └──────────┘
~~~~

**Disassembler**: The main class. Does step through the process shown in the flow diagram below.

**Memory**: The bin file is loaded here. Several memory areas are possible.
**BaseMemory**: Base class for 'memory'.

**Opcode**: Defines all opcodes for disassembly.

**DisLabel**: The found labels (addresses) are stored in an array.

**Format**: Helper methods to format strings.


## Flow diagram

~~~
                                     Start from the given code
           ┌───────────────────┐   labels, check all opcodes for
           │  Collect labels   │    branches and add branches to         Mark the code areas.
           └───────────────────┘          the labels list.
                     │
                     ▼
        ┌─────────────────────────┐
        │Find self-modifying code │   Find those labels that alter
        └─────────────────────────┘              code.
                     │
┌────────────────────┼─────────────────┐
│Mofdify Labels      ▼                 │
│   ┌────────────────────────────────┐ │  Treat flow-through from one
│   │  Add flow-through references   │ │ subroutine to another same as
│   └────────────────────────────────┘ │         CALL nn; RET.
│                    │                 │
│                    ▼                 │
│         ┌────────────────────┐       │  Check if LBLs are actually
│         │ Turn LBL into SUB  │       │     SUBs (subroutines).
│         └────────────────────┘       │
│                    │                 │
│                    ▼                 │
│   ┌────────────────────────────────┐ │   Determine local labels
│   │Find local labels in subroutines│ │    inside subroutines.
│   └────────────────────────────────┘ │ Turn these labels to local
│                    │                 │
│                    ▼                 │
│       ┌────────────────────────┐     │   Each label gets a parent.
│       │ Add parent references  │     │  Self references are removed.
│       └────────────────────────┘     │
│                    │                 │
│                    ▼                 │
│       ┌────────────────────────┐     │ All called subroutines are added
│       │Add call list to labels │     │       to subroutine labels.
│       └────────────────────────┘     │
│                    │                 │
└────────────────────┼─────────────────┘
                     │
┌────────────────────┼─────────────────┐
│Label naming        ▼                 │
│   ┌────────────────────────────────┐ │   Count the maximum number of labels per
│   │Count number of types of labels │ │   type. Used to determine the number of
│   └────────────────────────────────┘ │    digits for the names of the labels.
│                    │                 │
│                    ▼                 │
│         ┌────────────────────┐       │  Loop through the labels list and
│         │ Assign label names │       │    assign names depending on the
│         └────────────────────┘       │             label type.
│                    │                 │
└────────────────────┼─────────────────┘
                     │
┌────────────────────┼───────────────────┐
│Output              ▼                   │
│  ┌───────────────────────────────────┐ │
│  │Disassemble opcode with label names│ │
│  └───────────────────────────────────┘ │    Disassemble the opcode and
│                    │                   │    exchange the addresses with
│                    ▼                   │           label names.
│     ┌────────────────────────────┐     │
│     │ Add all EQU labels to the  │     │
│     │beginning of the disassembly│     │
│     └────────────────────────────┘     │   Labels marked as EQU are
└────────────────────────────────────────┘        output first.
~~~
