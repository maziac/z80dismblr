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
-> Am Besten am Ende nachprüfen, ob solcher Code existiert. Dann das Label in ein Label+offset umwandeln. D.h. dann wird dafür ein Label an der Opcode-Start Adresse erzeugt und im Opcode, der das Label benutzt wird dieses Label+offset angezeigt.
- Self-modifying code sollte im Kommentar dabei stehen.
- Gesamtes memory loopen
- Unterschiedliche Präfixe für verschiedenen Memory (ROM) Bereiche
- Wissen über ZX Spectrum:
	- Welcher Code benutzt SCREEN oder SCREEN_COLOR
	- Wer benutzt BEEPER
	- Wer benutzt ports
	- automatisch "ROM" Präfix für ROM label benutzen
	- Das sollte
		- im Kommentar der Subroutine (des Labels) stehen und
		- in einem Header. Dort alle Labels aufführen, die die obigen benutzen.
	- arg, das Wissen über HW einschaltet.
- Unterstützung für trc file aus MAME. Dadurch ist es möglich genau zu sehen, welche Adressen als Opcode verwendet werden.
	- keine Angabe von Startlabels mehr nötig
	- vielleicht kann man aus diesen Files auch ersehen, wer auf welchen Speicher zugreift. Z.B. um rauszukriegen, wo die Sprite-Routinen sind.
	-Es wäre vielleicht möglich zu erkennen, wo die const Datenbereiche sind (die nur gelesen werden und nicht geschrieben)
- Möglicherweise kann man alle relativen jumps nach oben als "loop" werten und betiteln.
