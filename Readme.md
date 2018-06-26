# TODO

- Limit for labels: if above a number is recognized as label.
- static register values: statically retrieve the values of the registers in order to
assign labels e.g. to BS in "LD (BC),a".
LD BC,nn: load nn to BC
INC BC: increment BC
- sna Unterstützung
- Spectrum Standard labels optional hinzufügen. Memory und Ports.
- Was mach ich mit Labeln, die im Binary nicht auftauchen. Port labels sowieso und MemoryLabels die ausserhalb sind.
	- Vielleicht einfach als EQU aufführen
- Was mach ich mit Data Labels, die in die Mitte eines Opcodes weisen. Also z.B. für Self-modifying code.
-> Am Besten am Ende nachprüfen, ob solcher Code existiert. Dann das Label in ein Label+offset umwandeln. D.h. dann wird dafür ein LAbel an der Opcode-Start Adresse erzeugt und im Opcode, der das Label benutzt wird dieses Label+offset angezeigt.
- Self-modifying code sollte im Kommentar dabei stehen.