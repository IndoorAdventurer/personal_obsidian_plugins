// The tree decides the level of a note's title, and ## becomes \paragraph.
// Note frontmatter: `latex-heading: false` leaves the title out (for an abstract),
// `latex-numbered: false` makes it unnumbered (for acknowledgements).
const { stringify } = require('../ast');
const { sectionLabel, headingLabel } = require('../labels');

const PARAGRAPH_LEVEL = 4;

module.exports = {
	name: 'headings',
	visitors: ({ note }) => ({
		Header(node) {
			const [level, attr, inlines] = node.c;
			if (level === 1) {
				if (note.frontmatter['latex-heading'] === false) return null;
				attr[0] = sectionLabel(note.slug);
				if (note.frontmatter['latex-numbered'] === false) attr[1] = [...attr[1], 'unnumbered'];
				node.c[0] = note.depth;
			} else {
				attr[0] = headingLabel(note.slug, stringify(inlines));
				node.c[0] = PARAGRAPH_LEVEL;
			}
			return undefined;
		},
	}),
};
