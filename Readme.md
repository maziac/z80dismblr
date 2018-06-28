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
- EQU Label als decimal ausgeben, dahinter als Kommentar in hex.
- "ld	(32991),hl	; 80DFh, -32545" -> Die "-32545" muss nicht ausgegeben werden. Eigentlich hätte das in Label aufgelöst werden müssen, d.h. vielleicht funktioniert das doch, s. hier:
8007		ld	(23659),a	; 5C6Bh
800C		ld	(32990),a	; 80DEh, -32546
- Möglicherweise kann man alle relativen jumps nach oben als "loop" werten und betiteln.
- Data label sollten auch 1-2 Zeilen space vorher bekommen:
80DB		jp	SUB05
; Label is referenced by 1 location:
; 0x800c (in LBL1)
80DE	DATA2:
- Tabs zwischen dec und char oder mit ' ' auffüllen:
8149		 defb 32	; 20h, 32, ' '
814A		 defb 111	; 6Fh, 111, 'o'
814B		 defb 117	; 75h, 117, 'u'

