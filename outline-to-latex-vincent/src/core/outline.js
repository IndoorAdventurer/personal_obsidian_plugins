// Reads the outline note: nested lists of links, optionally split into parts by
// `## part` headings. Anything outside the lists is free text for yourself.
const { splitFrontmatter } = require('./frontmatter');

const MAX_DEPTH = 3;
const LIST_ITEM = /^([ \t]*)(?:[-*+]|\d+[.)])[ \t]+(.*)$/;
const LINK_ITEM = /^\[\[([^\]|#]+)(?:\|([^\]]*))?\]\]\s*(?:%%.*%%\s*)?$/;
const PART_HEADING = /^##[ \t]+(.+?)[ \t]*$/;

function parseOutline(text, diagnostics, outlinePath) {
	const { data, body } = splitFrontmatter(text);
	const items = [];
	const seen = new Set();
	let part = 'body';
	let indents = [];
	let inCode = false;

	for (const line of body.split(/\r?\n/)) {
		if (/^\s*(```|~~~)/.test(line)) inCode = !inCode;
		if (inCode) continue;

		const heading = PART_HEADING.exec(line);
		if (heading) {
			part = heading[1].toLowerCase().replace(/[^a-z0-9]+/g, '-');
			indents = [];
			continue;
		}
		const listItem = LIST_ITEM.exec(line);
		if (!listItem) continue;

		const width = listItem[1].replace(/\t/g, '    ').length;
		if (!indents.length) {
			if (width > 0) {
				diagnostics.error(`Outline line "${line.trim()}" is indented but has no parent.`, outlinePath);
				continue;
			}
			indents.push(width);
		} else if (width > indents[indents.length - 1]) {
			indents.push(width);
		} else {
			while (indents[indents.length - 1] > width) indents.pop();
			if (indents[indents.length - 1] !== width) {
				diagnostics.error(`Outline line "${line.trim()}" doesn't line up with an earlier level.`, outlinePath);
				continue;
			}
		}

		const depth = indents.length;
		const link = LINK_ITEM.exec(listItem[2].trim());
		if (!link) {
			diagnostics.error(`Outline line "${line.trim()}" must be a single [[link]].`, outlinePath);
			continue;
		}
		if (depth > MAX_DEPTH) {
			diagnostics.error(`"${link[1]}" is at depth ${depth}, the outline allows ${MAX_DEPTH}.`, outlinePath);
			continue;
		}
		const name = link[1].trim();
		if (seen.has(name.toLowerCase())) {
			diagnostics.error(`"${name}" appears twice in the outline.`, outlinePath);
			continue;
		}
		seen.add(name.toLowerCase());
		items.push({ name, alias: link[2] ? link[2].trim() : null, depth, part });
	}

	return { frontmatter: data, items };
}

module.exports = { parseOutline, MAX_DEPTH };
