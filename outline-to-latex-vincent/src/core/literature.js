// Turns literature notes into bibliography entries. Links to a literature note,
// or to the file named in its `annotations` property, become citations.
// A ```bibtex code block in the note is used verbatim, key included. Without one,
// the entry is built from the note's properties.
const { splitFrontmatter } = require('./frontmatter');
const { slugify } = require('./labels');

const DEFAULT_FIELDS = {
	title: 'title',
	authors: 'authors',
	year: 'published',
	key: 'citekey',
	type: 'bibtype',
	venue: 'venue',
	annotations: 'annotations',
};
const VENUE_FIELD = { article: 'journal', inproceedings: 'booktitle', incollection: 'booktitle' };
const EXTRA_FIELDS = ['volume', 'number', 'pages', 'publisher', 'edition'];
const VERBATIM_FIELDS = ['doi', 'url'];

const FENCE = /^ {0,3}(`{3,}|~{3,})[ \t]*([^\s`]*)[^\n]*\n([\s\S]*?)^ {0,3}\1[`~]*[ \t]*$/gm;
const ENTRY_START = /^@\s*([A-Za-z]+)\s*[{(]\s*([^,\s{}()]+)\s*,/;

// Finds the note's BibTeX: { text, type, key } for one well-formed block, otherwise
// { problem } for several or malformed blocks, { hint } if a code block outside a
// bibtex fence looks like an entry, or nothing.
function findBibtex(body) {
	const blocks = [];
	let hint;
	for (const [, , lang, content] of body.matchAll(FENCE)) {
		if (lang.toLowerCase() === 'bibtex') blocks.push(content.trim());
		else if (ENTRY_START.test(content.trim())) hint = lang || 'no language';
	}
	if (blocks.length > 1) return { problem: `has ${blocks.length} bibtex blocks` };
	if (!blocks.length) return { hint };
	const text = blocks[0];
	const start = ENTRY_START.exec(text);
	const entries = (text.match(/^\s*@/gm) || []).length;
	if (!start || entries > 1 || !/[})]$/.test(text)) {
		return { problem: entries > 1 ? 'has several entries in its bibtex block' : 'has a bibtex block that isn\'t one @type{key, ...} entry' };
	}
	return { text, type: start[1].toLowerCase(), key: start[2] };
}

const asList = (value) => (value === undefined || value === null ? [] : Array.isArray(value) ? value : [value]);
const escapeBib = (value) => String(value).replace(/([&%$#_])/g, '\\$1');

class Literature {
	constructor(vault, config, diagnostics) {
		this.byPath = new Map();
		this.cited = new Set();
		this.diagnostics = diagnostics;
		const fields = { ...DEFAULT_FIELDS, ...config.literatureFields };
		const keys = new Map();

		const records = [];
		const annotationFiles = new Map();
		for (const folder of config.literature) {
			const notes = vault.notesIn(folder);
			if (!notes.length) diagnostics.warn(`Literature folder "${folder}" has no notes.`);
			for (const notePath of notes) {
				try {
					const { data, body } = splitFrontmatter(vault.read(notePath));
					records.push({ notePath, data, bibtex: findBibtex(body) });
					const annotations = /\[\[([^\]|]+)/.exec(String(data[fields.annotations] || ''));
					const annotationsPath = annotations && vault.resolve(annotations[1], notePath);
					if (annotationsPath) annotationFiles.set(annotationsPath, notePath);
				} catch (error) {
					diagnostics.error(`Invalid frontmatter: ${error.message}`, notePath);
				}
			}
		}

		for (const { notePath, data, bibtex } of records) {
			// The folder can hold other notes too, like annotations.
			if (annotationFiles.has(notePath) || !(bibtex.text || data[fields.title] || data[fields.authors])) continue;
			const entry = bibtex.text
				? { notePath, key: bibtex.key, type: bibtex.type, verbatim: bibtex.text }
				: { ...this.#entry(notePath, data, fields), bibtex };
			this.byPath.set(notePath, entry);
			if (!keys.has(entry.key)) keys.set(entry.key, []);
			keys.get(entry.key).push(entry);
		}
		for (const [annotationsPath, notePath] of annotationFiles) {
			if (this.byPath.has(notePath)) this.byPath.set(annotationsPath, this.byPath.get(notePath));
		}
		for (const entries of keys.values()) {
			if (entries.length > 1) entries.forEach((entry) => { entry.collides = entries; });
		}
	}

	#entry(notePath, data, fields) {
		const authors = asList(data[fields.authors]).map(String);
		const year = data[fields.year];
		const firstAuthor = authors.length ? authors[0].trim().split(/\s+/).pop() : 'unknown';
		return {
			notePath,
			key: data[fields.key] ? String(data[fields.key]) : `${slugify(firstAuthor).replace(/-/g, '')}${year ?? ''}`,
			type: data[fields.type] ? String(data[fields.type]) : 'misc',
			title: data[fields.title],
			venue: data[fields.venue],
			authors,
			year,
			data,
		};
	}

	isLiterature(path) {
		return this.byPath.has(path);
	}

	// Records the citation and returns the key.
	cite(path, fromNote) {
		const entry = this.byPath.get(path);
		if (entry.collides) {
			const others = entry.collides.map((other) => other.notePath).join(', ');
			this.diagnostics.error(
				`Citation key "${entry.key}" is shared by ${others}. Give these notes different keys in their bibtex blocks.`,
				fromNote,
			);
		}
		this.cited.add(entry);
		return entry.key;
	}

	// Only what's cited, so unused notes don't need complete metadata.
	toBibtex() {
		const entries = [...this.cited].sort((a, b) => a.key.localeCompare(b.key));
		return entries.map((entry) => this.#bibtex(entry)).join('\n');
	}

	#bibtex(entry) {
		if (entry.verbatim) return `${entry.verbatim}\n`;
		const { problem, hint } = entry.bibtex;
		if (problem) {
			this.diagnostics.error(`Cited literature note ${problem}. Keep one @type{key, ...} entry in one bibtex block.`, entry.notePath);
		} else {
			const tip = hint ? ` A code block marked "${hint}" looks like BibTeX: mark it \`\`\`bibtex.` : '';
			this.diagnostics.warn(`Cited literature note has no bibtex block, so its entry is built from its properties.${tip}`, entry.notePath);
		}
		const lines = [];
		const add = (name, value) => lines.push(`  ${name} = {${value}}`);
		if (!entry.authors.length) this.diagnostics.warn('Cited literature note has no authors.', entry.notePath);
		if (entry.year === undefined) this.diagnostics.warn('Cited literature note has no year.', entry.notePath);
		if (!entry.venue && entry.type !== 'book') {
			this.diagnostics.warn('Cited literature note has no venue, so its bibliography entry is incomplete.', entry.notePath);
		}

		if (entry.authors.length) add('author', entry.authors.map(escapeBib).join(' and '));
		if (entry.title) add('title', `{${escapeBib(entry.title)}}`);
		if (entry.year !== undefined) add('year', entry.year);
		if (entry.venue) add(VENUE_FIELD[entry.type] || 'howpublished', escapeBib(entry.venue));
		for (const name of EXTRA_FIELDS) {
			if (entry.data[name] != null) add(name, escapeBib(entry.data[name]));
		}
		for (const name of VERBATIM_FIELDS) {
			if (entry.data[name] != null) add(name, entry.data[name]);
		}
		return `@${entry.type}{${entry.key},\n${lines.join(',\n')}\n}\n`;
	}
}

module.exports = { Literature };
