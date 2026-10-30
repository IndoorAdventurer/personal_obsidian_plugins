// Helpers for pandoc's JSON document format.
const isNode = (value) =>
	value !== null && typeof value === 'object' && !Array.isArray(value) && typeof value.t === 'string';

// Walks a list of nodes, children first. A visitor is called with a node of its
// type and returns undefined (keep), null (remove), a node (replace) or an array
// of nodes (splice in). The special `List` visitor gets every list of nodes, for
// rules that need to look at neighbours, and returns the new list.
function walkList(list, visitors) {
	const out = [];
	for (const element of list) {
		if (isNode(element)) {
			const result = visitNode(element, visitors);
			if (result === undefined) out.push(element);
			else if (Array.isArray(result)) out.push(...result);
			else if (result !== null) out.push(result);
		} else if (Array.isArray(element)) {
			out.push(walkList(element, visitors));
		} else {
			out.push(element);
		}
	}
	return visitors.List && out.some(isNode) ? visitors.List(out) || out : out;
}

function visitNode(node, visitors) {
	if (Array.isArray(node.c)) node.c = walkList(node.c, visitors);
	const visitor = visitors[node.t];
	return visitor ? visitor(node) : undefined;
}

function walkDocument(doc, visitors) {
	doc.blocks = walkList(doc.blocks, visitors);
}

const str = (text) => ({ t: 'Str', c: text });
const rawInline = (latex) => ({ t: 'RawInline', c: ['latex', latex] });
const rawBlock = (latex) => ({ t: 'RawBlock', c: ['latex', latex] });
const isWhitespace = (node) => node.t === 'Space' || node.t === 'SoftBreak' || node.t === 'LineBreak';

function stringify(inlines) {
	return inlines
		.map((node) => {
			if (node.t === 'Str') return node.c;
			if (isWhitespace(node)) return ' ';
			if (node.t === 'Math' || node.t === 'Code') return node.c[1];
			if (node.t === 'Link' || node.t === 'Image') return stringify(node.c[1]);
			if (node.t === 'RawInline') return '';
			return Array.isArray(node.c) ? stringify(node.c.filter(isNode)) : '';
		})
		.join('');
}

const BLOCK_ID = /^\^([A-Za-z0-9-]+)$/;

// The ^block-id at the end of a paragraph's inlines, if any.
function trailingBlockId(inlines) {
	const last = inlines[inlines.length - 1];
	const match = last && last.t === 'Str' && BLOCK_ID.exec(last.c);
	return match ? match[1] : null;
}

function withoutBlockId(inlines) {
	const rest = inlines.slice(0, -1);
	while (rest.length && isWhitespace(rest[rest.length - 1])) rest.pop();
	return rest;
}

const isWikilink = (node) => node.t === 'Link' && node.c[2][1] === 'wikilink';

function decodeTarget(target) {
	try {
		return decodeURIComponent(target);
	} catch {
		return target;
	}
}

module.exports = {
	isNode,
	walkDocument,
	walkList,
	str,
	rawInline,
	rawBlock,
	isWhitespace,
	stringify,
	trailingBlockId,
	withoutBlockId,
	isWikilink,
	decodeTarget,
};
