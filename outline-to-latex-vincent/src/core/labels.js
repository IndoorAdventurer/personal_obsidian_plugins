// The one place that decides what LaTeX labels and file names look like.
function slugify(text) {
	return text
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

const sectionLabel = (noteSlug) => `sec:${noteSlug}`;
const headingLabel = (noteSlug, heading) => `sec:${noteSlug}:${slugify(heading)}`;
// Obsidian block IDs are only unique per note, so the note is part of the label.
const blockLabel = (noteSlug, id) => `${noteSlug}:${id}`;

module.exports = { slugify, sectionLabel, headingLabel, blockLabel };
