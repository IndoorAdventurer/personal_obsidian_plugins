// [[wikilinks]] become citations and references. classify.js decides which.
const { classifyLink } = require('../classify');
const { isWikilink, rawInline, decodeTarget } = require('../ast');
const { sectionLabel, headingLabel, blockLabel } = require('../labels');

function toLatex(result, ctx) {
	const target = () => ctx.lookup.note(result.key);
	switch (result.kind) {
		case 'cite': {
			const command = result.command || ctx.citeCommand;
			ctx.citeCommandsUsed.add(command);
			return `\\${command}{${ctx.literature.cite(result.key, ctx.note.path)}}`;
		}
		case 'section':
			return `\\cref{${sectionLabel(target().slug)}}`;
		case 'heading':
			return `\\cref{${headingLabel(target().slug, result.heading)}}`;
		case 'block':
			return `\\cref{${blockLabel(target().slug, result.id)}}`;
		default:
			return null;
	}
}

module.exports = {
	name: 'links',
	visitors: (ctx) => ({
		Link(node) {
			if (!isWikilink(node)) return undefined;
			const result = classifyLink(decodeTarget(node.c[2][0]), ctx.note.key, ctx.lookup);

			if (result.kind === 'broken') ctx.diagnostics.error(`Broken reference: ${result.reason}.`, ctx.note.path);
			else if (result.reason) ctx.diagnostics.warn(`Link kept as plain text: ${result.reason}.`, ctx.note.path);

			const latex = toLatex(result, ctx);
			return latex ? rawInline(latex) : node.c[1];
		},
	}),
};
