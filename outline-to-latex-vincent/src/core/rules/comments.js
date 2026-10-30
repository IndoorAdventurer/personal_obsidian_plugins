// %% comments carry over to the .tex as % comments. preprocess.js hands them over
// as raw inlines starting with %%. They can't sit in a heading or caption, where
// a % would swallow part of a LaTeX command, so they're dropped there.
const isComment = (node) => node.t === 'RawInline' && node.c[1].startsWith('% ');

module.exports = {
	name: 'comments',
	visitors: () => ({
		RawInline(node) {
			if (node.c[0] !== 'latex' || !node.c[1].startsWith('%%')) return undefined;
			return { t: 'RawInline', c: ['latex', `% ${node.c[1].slice(2)}\n`] };
		},
		Header(node) {
			node.c[2] = node.c[2].filter((inline) => !isComment(inline));
		},
		Image(node) {
			node.c[1] = node.c[1].filter((inline) => !isComment(inline));
		},
	}),
};
