// A ^id on anything else, like a plain paragraph, becomes a label at that spot,
// so a reference to it resolves to the surrounding section.
const { rawBlock, rawInline, trailingBlockId, withoutBlockId } = require('../ast');
const { blockLabel } = require('../labels');

function visitParagraph({ note }) {
	return (block) => {
		const id = trailingBlockId(block.c);
		if (!id) return undefined;
		const label = `\\label{${blockLabel(note.slug, id)}}`;
		const rest = withoutBlockId(block.c);
		if (!rest.length) return rawBlock(label);
		block.c = [...rest, rawInline(label)];
		return undefined;
	};
}

module.exports = {
	name: 'blockLabels',
	visitors: (ctx) => {
		const visit = visitParagraph(ctx);
		return { Para: visit, Plain: visit };
	},
};
