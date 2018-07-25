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

┌──────────────────────────────────────┐
│Label collection                      │
│          ┌───────────────────┐       │    Start from the given code
│          │  Collect labels   │       │  labels, check all opcodes for
│          └─────────┬─────────┘       │   branches and add branches to         Mark the code areas.
│                    │                 │         the labels list.
│       ┌────────────┴────────────┐    │
│       │  Find Interrupt Labels  │    │    Find those labels that alter
│       └────────────┬────────────┘    │               code.
│                    │                 │
│       ┌────────────┴────────────┐    │
│       │   Set Special Labels    │    │  Find opcode areas that do not
│       └────────────┬────────────┘    │       start with a label.
│                    │                 │
│       ┌────────────┴────────────┐    │
│       │       Sort Labels       │    │  Such as start of a new memory
│       └────────────┬────────────┘    │           area (ROM).
│                    │                 │
│    ┌───────────────┴──────────────┐  │
│    │ Adjust self-modifying labels │  │   Add offset (e.g. "+1") if
│    └───────────────┬──────────────┘  │          appropriate.
└────────────────────┼─────────────────┘
                     │
                     ▼
    ┌────────────────────────────────┐      Treat flow-through from one
    │  Add flow-through references   │     subroutine to another same as
    └────────────────────────────────┘            "CALL nn; RET".
                     │
                     │
┌────────────────────┼─────────────────┐
│Label modification  ▼                 │
│         ┌────────────────────┐       │  Check if LBLs are actually
│         │ Turn LBL into SUB  │       │     SUBs (subroutines).
│         └────────────────────┘       │
│                                      │
│   ┌────────────────────────────────┐ │
│   │Find local labels in subroutines│ │   Determine local labels
│   └────────────────┬───────────────┘ │    inside subroutines.
└────────────────────┼─────────────────┘ Turn these labels to local
                     │
                     │
┌────────────────────┼─────────────────┐
│References          ▼                 │   Each label gets a parent.
│       ┌────────────────────────┐     │  Self references are removed.
│       │ Add parent references  │     │
│       └────────────┬───────────┘     │
│                    │                 │
│       ┌────────────┴───────────┐     │ All called subroutines are added
│       │Add call list to labels │     │       to subroutine labels.
│       └────────────┬───────────┘     │
└────────────────────┼─────────────────┘
                     │
                     ▼
        ┌─────────────────────────┐        Such as size and cyclomatic
        │    Count Statistics     │                complexity.
        └────────────┬────────────┘
                     │
                     ▼
          ┌────────────────────┐          Loop through the labels list and
          │ Assign label names │            assign names depending on the
          └────────────────────┘                     label type.
                     │
                     │
┌────────────────────┼───────────────────┐
│Output              ▼                   │
│  ┌───────────────────────────────────┐ │    Disassemble the opcode and
│  │Disassemble opcode with label names│ │    exchange the addresses with
│  └───────────────────────────────────┘ │           label names.
│                    │                   │
│                    │                   │
│     ┌──────────────┴─────────────┐     │
│     │ Add all EQU labels to the  │     │   Labels marked as EQU are
│     │beginning of the disassembly│     │        output first.
│     └──────────────┬─────────────┘     │
└────────────────────┼───────────────────┘
                     │
                     ▼
~~~
