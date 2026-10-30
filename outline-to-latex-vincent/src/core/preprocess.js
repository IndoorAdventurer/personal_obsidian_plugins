// The text stage: rewrites what pandoc can't parse into what it can. Everything
// else belongs in a rule (src/core/rules), which works on the parsed document.
const { scan } = require('./scan');

const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|svg|pdf)$/i;

function fenceFor(text) {
	const runs = text.match(/`+/g) || [];
	return '`'.repeat(Math.max(0, ...runs.map((run) => run.length)) + 1);
}

// Comments carry over to the .tex. The comments rule finishes the inline ones.
function comment(inner) {
	const trimmed = inner.trim();
	if (!trimmed) return '';
	if (trimmed.includes('\n')) {
		const fence = fenceFor(trimmed).padEnd(3, '`');
		const lines = trimmed.split('\n').map((line) => `% ${line}`.trimEnd());
		return `\n\n${fence}{=latex}\n${lines.join('\n')}\n${fence}\n\n`;
	}
	const fence = fenceFor(trimmed);
	return `${fence}%%${trimmed}${fence}{=latex}`;
}

// ![[file|Caption|w=0.5]]: w is the width as a fraction of the line.
function embed(inner, diagnostics, notePath) {
	const parts = inner.split('|');
	const file = parts.shift().trim();
	if (!IMAGE_EXTENSIONS.test(file)) {
		diagnostics.error(`Embedding "${file}" isn't supported: only images can be embedded.`, notePath);
		return '';
	}
	let attributes = '';
	if (parts.length && /^\s*w=[\d.]+\s*$/.test(parts[parts.length - 1])) {
		const width = parseFloat(parts.pop().split('=')[1]);
		attributes = `{width=${Math.round(width * 100)}%}`;
	}
	return `![${parts.join('|').trim()}](<${file}>)${attributes}`;
}

function preprocess(text, diagnostics, notePath) {
	return scan(text.normalize('NFC'))
		.map((segment) => {
			if (segment.type === 'comment') return comment(segment.inner);
			if (segment.type === 'embed') return embed(segment.inner, diagnostics, notePath);
			return segment.text;
		})
		.join('');
}

module.exports = { preprocess };
