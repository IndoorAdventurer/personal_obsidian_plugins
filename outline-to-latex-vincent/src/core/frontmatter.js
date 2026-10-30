const YAML = require('yaml');

// Returns the parsed frontmatter and the note text after it. Throws on invalid YAML.
function splitFrontmatter(text) {
	const match = /^---\r?\n([\s\S]*?)\r?\n?---[ \t]*(?:\r?\n|$)/.exec(text);
	if (!match) return { data: {}, body: text };
	return { data: YAML.parse(match[1]) || {}, body: text.slice(match[0].length) };
}

module.exports = { splitFrontmatter };
