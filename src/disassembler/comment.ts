/**
 * Used for commenting labels (addresses) in the disassembly.
 */
export class Comment {
	/// The line before the statement.
	public linesBefore: Array<string>;
	/// The line on the statement.
	public lineOn: string;
	/// The line after the statement.
	public linesAfter: Array<string>;


	/**
	 * Return a text with a lines array:
	 * Comment before the statement.
	 * Comment after the statement.
	 * Comment a line after the statement.
	 * @param comment The comment object.
	 * @param statement E.g. "SUB001:"
	 * @returns E.g. ";comment", "SUB001:\t; comment", ";comment"
	 */
	public static getLines(comment: Comment|undefined, statement: string): Array<string> {
		if(comment) {
			const arr = new Array<string>();
			if(comment.linesBefore)
				arr.push(...comment.linesBefore.map(s => (s.length > 0) ? '; '+s : ''));
			let text = statement;
			if(comment.lineOn)
				text += '\t; ' + comment.lineOn;
			arr.push(text);
			if(comment.linesAfter)
				arr.push(...comment.linesAfter.map(s => (s.length > 0) ? '; '+s : ''));
			return arr;
		}
		else {
			// no comment
			return [statement];
		}
	}
}
