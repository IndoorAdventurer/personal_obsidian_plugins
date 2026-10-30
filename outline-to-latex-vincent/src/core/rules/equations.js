// $$...$$ with a ^id becomes a numbered equation you can refer to. Without one it
// stays unnumbered. Environments that number themselves, like align, are not
// wrapped in an equation.
const { rawBlock, rawInline, trailingBlockId, withoutBlockId } = require('../ast');
const { blockLabel } = require('../labels');

const NUMBERING_ENV = /^\\begin\{(align|alignat|gather|multline|flalign)\*?\}/;
const HARD_TAG = /\\tag\*?\{[^}]*\}/;

// A blank line inside display math is a LaTeX error.
const clean = (math) => math.trim().replace(/\n\s*\n/g, '\n');

function numbered(math, label) {
	const start = NUMBERING_ENV.exec(math);
	if (start) return math.replace(start[0], `${start[0]}\\label{${label}}`);
	return `\\begin{equation}\\label{${label}}\n${math}\n\\end{equation}`;
}

function visitParagraph(ctx) {
	return (block) => {
		if (!block.c.some((node) => node.t === 'Math' && node.c[0].t === 'DisplayMath')) return undefined;

		const id = trailingBlockId(block.c);
		const inlines = id ? withoutBlockId(block.c) : block.c;
		let lastMath = -1;
		inlines.forEach((node, index) => {
			if (node.t === 'Math' && node.c[0].t === 'DisplayMath') lastMath = index;
		});

		const out = inlines.map((node, index) => {
			if (node.t !== 'Math' || node.c[0].t !== 'DisplayMath') return node;
			let math = clean(node.c[1]);
			if (HARD_TAG.test(math)) {
				ctx.diagnostics.warn('Hard-coded \\tag in an equation. Use a ^id and a reference instead.', ctx.note.path);
				if (id && index === lastMath) math = math.replace(HARD_TAG, '').trim();
			}
			if (id && index === lastMath) return rawInline(numbered(math, blockLabel(ctx.note.slug, id)));
			return { t: 'Math', c: [node.c[0], math] };
		});

		if (id && out.length === 1) return rawBlock(out[0].c[1]);
		block.c = out;
		return undefined;
	};
}

module.exports = {
	name: 'equations',
	visitors: (ctx) => {
		const visit = visitParagraph(ctx);
		return { Para: visit, Plain: visit };
	},
};
