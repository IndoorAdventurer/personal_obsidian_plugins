// A ```latex block goes through untouched. With a ^id after it, the block's
// \label{id} gets the same project-wide name as every other label.
const { rawBlock, trailingBlockId } = require('../ast');
const { blockLabel } = require('../labels');

module.exports = {
	name: 'rawLatex',
	visitors: (ctx) => ({
		List(list) {
			const out = [];
			for (let i = 0; i < list.length; i += 1) {
				const block = list[i];
				if (block.t !== 'CodeBlock' || !block.c[0][1].includes('latex')) {
					out.push(block);
					continue;
				}
				let latex = block.c[1];
				const next = list[i + 1];
				const id = next && next.t === 'Para' && next.c.length === 1 ? trailingBlockId(next.c) : null;
				if (id) {
					const label = `\\label{${id}}`;
					if (latex.includes(label)) {
						latex = latex.split(label).join(`\\label{${blockLabel(ctx.note.slug, id)}}`);
					} else {
						ctx.diagnostics.error(`The latex block marked ^${id} needs a ${label} inside it.`, ctx.note.path);
					}
					i += 1;
				}
				out.push(rawBlock(latex));
			}
			return out;
		},
	}),
};
