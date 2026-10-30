const { EditorSuggest, MarkdownRenderer } = require('obsidian');
const { CITE_COMMANDS } = require('../core/classify');

const TRIGGER = /(?:^|[\s(\[;,])@([^\s@]*)$/;
const MAX_SUGGESTIONS = 30;
const BLOCK_KIND = { 'eq-': 'equation', 'fig-': 'figure', 'tab-': 'table' };
const KIND_ORDER = ['equation', 'figure', 'table', 'section', 'citation', 'block'];

function blockKind(id) {
	const prefix = Object.keys(BLOCK_KIND).find((start) => id.startsWith(start));
	return prefix ? BLOCK_KIND[prefix] : 'block';
}

// Typing @ in a note of the report lists everything you can refer to.
class ReferenceSuggest extends EditorSuggest {
	constructor(plugin) {
		super(plugin.app);
		this.plugin = plugin;
		this.setInstructions([{ command: '@eq, @fig, @name, @citet-name', purpose: 'filter by type or name' }]);
	}

	onTrigger(cursor, editor, file) {
		if (!file || !this.plugin.projects.forFile(file)) return null;
		const before = editor.getLine(cursor.line).slice(0, cursor.ch);
		const match = TRIGGER.exec(before);
		if (!match) return null;
		return {
			start: { line: cursor.line, ch: cursor.ch - match[1].length - 1 },
			end: cursor,
			query: match[1],
		};
	}

	async getSuggestions(context) {
		const project = this.plugin.projects.forFile(context.file);
		if (!project) return [];
		const words = context.query.toLowerCase().split(/[-_]/).filter(Boolean);
		const matches = this.#entries(project, context.file).filter((entry) => {
			// Variants like citet only show up when you ask for them.
			if (entry.variant && !words.some((word) => CITE_COMMANDS.includes(word))) return false;
			const haystack = `${entry.kind} ${entry.label} ${entry.detail} ${entry.search || ''}`.toLowerCase();
			return words.every((word) => haystack.includes(word));
		});
		matches.sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.label.localeCompare(b.label));
		const shown = matches.slice(0, MAX_SUGGESTIONS);
		await Promise.all(shown.map((entry) => this.#loadPreview(entry)));
		return shown;
	}

	#entries(project, sourceFile) {
		const { metadataCache } = this.app;
		const linkTo = (file) => (file.path === sourceFile.path ? '' : metadataCache.fileToLinktext(file, sourceFile.path, true));
		const entries = [];

		for (const file of project.notes.values()) {
			const cache = metadataCache.getFileCache(file);
			const title = project.titleOf(file);
			entries.push({ kind: 'section', label: title, detail: file.basename, link: `[[${metadataCache.fileToLinktext(file, sourceFile.path, true)}|${title}]]` });
			for (const heading of cache?.headings || []) {
				if (heading.level !== 2) continue;
				entries.push({ kind: 'section', label: heading.heading, detail: title, link: `[[${linkTo(file)}#${heading.heading}|${heading.heading}]]` });
			}
			for (const [id, block] of Object.entries(cache?.blocks || {})) {
				entries.push({ kind: blockKind(id), label: id, detail: title, link: `[[${linkTo(file)}#^${id}|${id}]]`, file, block, id });
			}
		}
		for (const name of project.missing) {
			const item = project.items.find((candidate) => candidate.name.toLowerCase() === name);
			entries.push({ kind: 'section', label: item.alias || item.name, detail: 'unwritten', link: `[[${item.name}]]` });
		}
		for (const file of project.literatureNotes()) {
			const frontmatter = metadataCache.getFileCache(file)?.frontmatter || {};
			const authors = Array.isArray(frontmatter.authors) ? frontmatter.authors : [frontmatter.authors].filter(Boolean);
			const author = authors.length ? String(authors[0]).trim().split(/\s+/).pop() : file.basename;
			const year = frontmatter.published;
			const alias = [author, year].filter(Boolean).join(', ');
			const target = metadataCache.fileToLinktext(file, sourceFile.path, true);
			const variants = { cite: alias, citep: `(${alias})`, citet: `${author} (${year})`, citeauthor: author, citeyear: String(year) };
			for (const command of CITE_COMMANDS) {
				entries.push({ kind: 'citation', variant: true, label: `${command}: ${variants[command]}`, detail: frontmatter.title || file.basename, search: `${file.basename} ${command}`, link: `[[${target}#${command}|${variants[command]}]]` });
			}
			entries.push({ kind: 'citation', label: alias, detail: frontmatter.title || file.basename, search: file.basename, link: `[[${metadataCache.fileToLinktext(file, sourceFile.path, true)}|${alias}]]` });
		}
		return entries;
	}

	async #loadPreview(entry) {
		if (!entry.block || (entry.kind !== 'equation' && entry.kind !== 'figure')) return;
		const text = await this.app.vault.cachedRead(entry.file);
		const { start, end } = entry.block.position;
		entry.preview = text.slice(start.offset, end.offset).replace(/\s*\^[\w-]+\s*$/, '');
	}

	renderSuggestion(entry, el) {
		el.addClass('otl-suggestion');
		const line = el.createDiv({ cls: 'otl-suggestion-line' });
		line.createSpan({ text: entry.kind, cls: `otl-suggestion-kind otl-ref otl-ref-${entry.kind}` });
		line.createSpan({ text: entry.label, cls: 'otl-suggestion-label' });
		line.createSpan({ text: entry.detail, cls: 'otl-suggestion-detail' });
		if (entry.preview) {
			const preview = el.createDiv({ cls: 'otl-suggestion-preview' });
			MarkdownRenderer.render(this.app, entry.preview, preview, entry.file.path, this.plugin);
		}
	}

	selectSuggestion(entry) {
		const { editor, start, end } = this.context;
		editor.replaceRange(entry.link, start, end);
		editor.setCursor({ line: start.line, ch: start.ch + entry.link.length });
	}
}

module.exports = { ReferenceSuggest };
