
/// A categorization (and priorization) of the numbers (labels) in the opcodes.
/// The higher the number, the higher the prio.
export const enum NumberType {
	// No label
	NONE = 0,
	// "relative-label"-type, i.e. JR
	CODE_RELATIVE_LBL,
	// "loop"-type
	CODE_RELATIVE_LOOP,
	// "LBL"-type
	CODE_LBL,
	// "SUB"-type
	CODE_SUB,
	// "TST"-type
	CODE_RST,
	// A relative index like (IX+5) or (IY-3)
	RELATIVE_INDEX,
	// "BYTE"-type
	NUMBER_BYTE,
	// "WORD"-type
	NUMBER_WORD,
	// "WORD"-type for ZX Next command "PUSH $nnnn"
	NUMBER_WORD_BIG_ENDIAN,
	// "Data LBL"-type
	DATA_LBL,
	// Label for "out/in" command
	PORT_LBL	// TODO: Port needs other handling. Is another space, i.e. a memory label nd a port label could have same number.
}

