# Notes

## Binaries

Use "Run Task...->Build Executables".
This creates thebinaries and zip files for uploading a release.

Manually:
Binaries erzeugen für Linux, Windows und macos:
~~~
$ pkg out/z80dismblr.js
~~~
Erzeugt:
~~~~
z80dismblr-linux
z80dismblr-macos
z80dismblr-win.exe
~~~~
alle ca. 35MB groß.

Nur macos:
~~~
$ pkg out/z80dismblr.js -t macos
~~~

Benutzung:
~~~
./z80dismblr-macos --sna src/tests/data/sw.sna  --uppercase --addbytes --callgraph out/tests/out2.dot --out out/tests/out2.asm --tr src/tests/data/sw.tr
~~~


## npm package

Geht über
~~~
$ npm publish
$ npm pack (erzeugt nur das package, zum Testen)
~~~

Vorher muss man aber mit
~~~
$ npm adduser
~~~
einen User erstellen.
Da hab ich erstmal Abstand von genommen, da ich dafür meine Email public machen müsste.
So wie es aussieht, ist die Email wohl inzwischen aus den npm Profilen auf der Website verschwunden.
Eine ganz klare Aussage dazu konnte ich aber nicht finden, daher hab ich das nicht gemacht.



# TODO

- static register values: statically retrieve the values of the registers in order to
assign labels e.g. to BC in "LD (BC),a".
LD BC,nn: load nn to BC
INC BC: increment BC
- Spectrum Standard labels optional hinzufügen. Memory und Ports.
- Unterschiedliche Präfixe für verschiedenen Memory (ROM) Bereiche
- Next Opcodes abschaltbar.
- Wissen über ZX Spectrum:
	- Welcher Code benutzt SCREEN oder SCREEN_COLOR
	- Wer benutzt BEEPER
	- Wer benutzt ports
	- automatisch "ROM" Präfix für ROM label benutzen
	- Das sollte
		- im Kommentar der Subroutine (des Labels) stehen und
		- in einem Header. Dort alle Labels aufführen, die die obigen benutzen.
	- arg, das Wissen über HW einschaltet.
- Test: Vergleich der Ausgabe mit zesarux. D.h. vielleicht bin-file mit allen Kombinationen erzeugen und durch Zesarux jagen.
- Unterschiedliche zusätzliche Präfixe erlauben für Memory Bereiche. Z.B. Präfix for ROM -> "ROM_SUB001".


# Z80 Assembler

## Features

- data code areas
- macros
- multiple banks (SECTION directive, see e.g. here http://www.crossware.com/xmanuals/az80/index.html)
- code split over miltiple assembler files
- not necessarily opcode support
- output in several files (e.g. for ERPOMs)
- Preprocessing/conditional compilation
- section: .text, .code, .data, .bss, .stack (see also here https://www.softools.com/sasmzilog.htm)
- SNA output
