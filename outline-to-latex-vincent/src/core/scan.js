// Splits note text into segments, for the only two Obsidian constructs pandoc
// can't parse: %% comments and ![[embeds]]. Code and math are recognised so that
// a %% or ![[ inside them is left alone.
//
// Segment types: text, code, math, comment, embed. Concatenating the `text` of
// all segments gives back the input.
function scan(source) {
	const segments = [];
	let i = 0;
	let textStart = 0;

	const emit = (type, end, extra = {}) => {
		if (i > textStart) segments.push({ type: 'text', text: source.slice(textStart, i) });
		segments.push({ type, text: source.slice(i, end), ...extra });
		i = end;
		textStart = end;
	};

	while (i < source.length) {
		if (i === 0 || source[i - 1] === '\n') {
			const end = fencedBlockEnd(source, i);
			if (end !== null) {
				emit('code', end);
				continue;
			}
		}

		const ch = source[i];
		if (ch === '\\') {
			i += 2;
		} else if (ch === '`') {
			let run = 1;
			while (source[i + run] === '`') run += 1;
			const close = source.indexOf('`'.repeat(run), i + run);
			if (close === -1) i += run;
			else emit('code', close + run);
		} else if (source.startsWith('$$', i)) {
			const close = source.indexOf('$$', i + 2);
			if (close === -1) i += 2;
			else emit('math', close + 2);
		} else if (ch === '$') {
			const end = inlineMathEnd(source, i);
			if (end === null) i += 1;
			else emit('math', end);
		} else if (source.startsWith('%%', i)) {
			const close = source.indexOf('%%', i + 2);
			const end = close === -1 ? source.length : close + 2;
			const inner = source.slice(i + 2, close === -1 ? source.length : close);
			emit('comment', end, { inner });
		} else if (source.startsWith('![[', i)) {
			const close = source.indexOf(']]', i);
			const newline = source.indexOf('\n', i);
			if (close === -1 || (newline !== -1 && newline < close)) i += 3;
			else emit('embed', close + 2, { inner: source.slice(i + 3, close) });
		} else {
			i += 1;
		}
	}
	if (i > textStart) segments.push({ type: 'text', text: source.slice(textStart, source.length) });
	return segments;
}

function fencedBlockEnd(source, start) {
	const open = /[ \t>]*(`{3,}|~{3,})[^\n]*(?:\n|$)/y;
	open.lastIndex = start;
	const match = open.exec(source);
	if (!match) return null;
	const fence = match[1];
	let lineStart = open.lastIndex;
	while (lineStart < source.length) {
		let lineEnd = source.indexOf('\n', lineStart);
		if (lineEnd === -1) lineEnd = source.length;
		const line = source.slice(lineStart, lineEnd).replace(/^[ \t>]*/, '').trimEnd();
		if (line.length >= fence.length && line === fence[0].repeat(line.length)) {
			return Math.min(lineEnd + 1, source.length);
		}
		lineStart = lineEnd + 1;
	}
	return source.length;
}

// Same rules as pandoc's tex_math_dollars.
function inlineMathEnd(source, start) {
	const first = source[start + 1];
	if (first === undefined || /\s/.test(first)) return null;
	for (let i = start + 1; i < source.length; i += 1) {
		const ch = source[i];
		if (ch === '\n') return null;
		if (ch === '\\') {
			i += 1;
		} else if (ch === '$') {
			if (/\s/.test(source[i - 1]) || /[0-9]/.test(source[i + 1] || '')) return null;
			return i + 1;
		}
	}
	return null;
}

// Whether a piece of text has nothing in it but comments.
function isOnlyComments(text) {
	return scan(text).every((segment) => segment.type === 'comment' || (segment.type === 'text' && !segment.text.trim()));
}

module.exports = { scan, isOnlyComments };
