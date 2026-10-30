// Loads the notes in the outline and works out what each one contains, before
// any rule runs. Links can then be checked against the whole project.
const { splitFrontmatter } = require('./frontmatter');
const { preprocess } = require('./preprocess');
const { markdownToAst } = require('./pandoc');
const { slugify } = require('./labels');
const { normalizeHeading } = require('./classify');
const { isCallout } = require('./rules/callouts');
const { walkDocument, stringify, trailingBlockId, str, isWhitespace } = require('./ast');

const MISSING_PREFIX = 'missing:';

const isComment = (block) => block.t === 'RawBlock' && block.c[1].startsWith('%');
const isCommentInline = (node) => node.t === 'RawInline' && node.c[1].startsWith('%%');

function isEmptyBlock(block) {
	if (block.t === 'Header' || isComment(block) || isCallout(block)) return true;
	if (block.t === 'Para' || block.t === 'Plain') {
		return block.c.every((node) => isWhitespace(node) || isCommentInline(node));
	}
	return false;
}

async function loadNote(item, vault, tools, diagnostics) {
	const path = vault.resolve(item.name);
	if (!path || !path.endsWith('.md')) return missingNote(item);

	let frontmatter;
	let body;
	try {
		({ data: frontmatter, body } = splitFrontmatter(vault.read(path)));
	} catch (error) {
		diagnostics.error(`Invalid frontmatter: ${error.message}`, path);
		return null;
	}

	const doc = await markdownToAst(preprocess(body, diagnostics, path), tools);
	const name = path.split('/').pop().replace(/\.md$/, '');
	const note = { key: path, path, name, slug: slugify(name), depth: item.depth, part: item.part, frontmatter, doc };

	const structured = doc.blocks.filter((block) => !isEmptyBlock(block) || block.t === 'Header');
	const titles = doc.blocks.filter((block) => block.t === 'Header' && block.c[0] === 1);
	if (titles.length !== 1 || structured[0] !== titles[0]) {
		diagnostics.error('A note in the outline must start with exactly one "# Title" heading.', path);
	}
	for (const block of doc.blocks) {
		if (block.t === 'Header' && block.c[0] > 2) {
			diagnostics.error(`Heading "${stringify(block.c[2])}" is too deep: inside a note only ## is allowed.`, path);
		}
	}

	note.title = titles.length ? stringify(titles[0].c[2]) : name;
	note.headings = new Set(
		doc.blocks.filter((block) => block.t === 'Header' && block.c[0] === 2).map((block) => normalizeHeading(stringify(block.c[2]))),
	);
	note.blockIds = collectBlockIds(doc);
	note.written = !doc.blocks.every(isEmptyBlock);
	return note;
}

// A section in the outline that has no note yet.
function missingNote(item) {
	const title = item.alias || item.name;
	return {
		key: MISSING_PREFIX + item.name.toLowerCase(),
		path: null,
		name: item.name,
		slug: slugify(item.name),
		depth: item.depth,
		part: item.part,
		frontmatter: {},
		title,
		headings: new Set(),
		blockIds: new Set(),
		written: false,
		doc: { 'pandoc-api-version': [1, 23, 1], meta: {}, blocks: [{ t: 'Header', c: [1, ['', [], []], [str(title)]] }] },
	};
}

function collectBlockIds(doc) {
	const ids = new Set();
	const collect = (node) => {
		const id = trailingBlockId(node.c);
		if (id) ids.add(id);
	};
	const copy = JSON.parse(JSON.stringify(doc));
	walkDocument(copy, { Para: collect, Plain: collect });
	return ids;
}

async function loadNotes(items, vault, tools, diagnostics) {
	const notes = new Array(items.length);
	let next = 0;
	const worker = async () => {
		while (next < items.length) {
			const index = next++;
			notes[index] = await loadNote(items[index], vault, tools, diagnostics);
		}
	};
	await Promise.all(Array.from({ length: 8 }, worker));
	return notes.filter(Boolean);
}

// The classifier's view of the project during a build.
function createLookup(notes, vault, literature) {
	const byKey = new Map(notes.map((note) => [note.key, note]));
	return {
		resolve(linkpath, fromKey) {
			const from = fromKey.startsWith(MISSING_PREFIX) ? '' : fromKey;
			const path = vault.resolve(linkpath, from);
			if (path) return path;
			const missing = MISSING_PREFIX + linkpath.trim().toLowerCase();
			return byKey.has(missing) ? missing : null;
		},
		isLiterature: (key) => literature.isLiterature(key),
		isInTree: (key) => byKey.has(key),
		isWritten: (key) => byKey.get(key).written,
		hasBlock: (key, id) => byKey.get(key).blockIds.has(id),
		hasHeading: (key, heading) => byKey.get(key).headings.has(normalizeHeading(heading)),
		titleOf: (key) => byKey.get(key).title,
		note: (key) => byKey.get(key),
	};
}

module.exports = { loadNotes, createLookup };
