// An image alone in its paragraph becomes a numbered figure, with an optional
// ^id for references. What happens to the file itself is up to assets.js.
const { trailingBlockId, withoutBlockId, decodeTarget } = require('../ast');
const { blockLabel } = require('../labels');

const DEFAULT_WIDTH = '70%';

function figure(ctx) {
	return (block) => {
		const id = trailingBlockId(block.c);
		const inlines = id ? withoutBlockId(block.c) : block.c;
		const images = inlines.filter((node) => node.t === 'Image');
		if (!images.length) return undefined;
		if (inlines.length !== 1) {
			ctx.diagnostics.error('An image must be alone on its line to become a figure.', ctx.note.path);
			return undefined;
		}

		const image = inlines[0];
		const [attr, caption, [src]] = image.c;
		const file = decodeTarget(src);
		const path = ctx.vault.resolve(file, ctx.note.path);
		if (!path) {
			ctx.diagnostics.error(`Image "${file}" doesn't exist.`, ctx.note.path);
			return undefined;
		}
		if (!attr[2].some(([name]) => name === 'width')) attr[2] = [...attr[2], ['width', DEFAULT_WIDTH]];
		image.c = [attr, [], [ctx.assets.request(path), '']];

		const label = id ? blockLabel(ctx.note.slug, id) : '';
		return {
			t: 'Figure',
			c: [[label, [], []], [null, caption.length ? [{ t: 'Plain', c: caption }] : []], [{ t: 'Plain', c: [image] }]],
		};
	};
}

module.exports = {
	name: 'figures',
	visitors: (ctx) => {
		const visit = figure(ctx);
		return { Para: visit, Plain: visit };
	},
};
