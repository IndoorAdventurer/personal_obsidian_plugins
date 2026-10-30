const { TFile } = require('obsidian');
const { parseOutline } = require('../core/outline');
const { Diagnostics } = require('../core/diagnostics');
const { classifyLink, normalizeHeading } = require('../core/classify');
const { isOnlyComments } = require('../core/scan');

const MISSING_PREFIX = 'missing:';
const EMPTY_SECTION_TYPES = new Set(['yaml', 'heading', 'callout', 'comment']);
const asList = (value) => (value === undefined || value === null ? [] : Array.isArray(value) ? value : [value]);

// What the editor knows about one outline note, read from Obsidian's own cache.
class Project {
	constructor(app, file, frontmatter, items) {
		this.app = app;
		this.file = file;
		this.items = items;
		this.literatureFolders = asList(frontmatter['latex-literature']).map(String);
		this.draftFolders = asList(frontmatter['latex-drafts']).map(String);
		this.literatureField = frontmatter['latex-literature-fields']?.annotations || 'annotations';
		this.notes = new Map();
		this.missing = new Set();
		for (const item of items) {
			const dest = app.metadataCache.getFirstLinkpathDest(item.name, file.path);
			if (dest) this.notes.set(dest.path, dest);
			else this.missing.add(item.name.toLowerCase());
		}
		this.annotationFiles = this.#findAnnotationFiles();
		this.written = new Set();
		this.lookup = this.#createLookup();
	}

	#filesInLiteratureFolders() {
		return this.app.vault.getMarkdownFiles().filter((file) => this.#inFolders(file, this.literatureFolders));
	}

	// The same notes the build treats as papers.
	literatureNotes() {
		return this.#filesInLiteratureFolders().filter((file) => {
			const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
			return !this.annotationFiles.has(file.path) && (frontmatter?.title || frontmatter?.authors);
		});
	}

	async loadWritten() {
		await Promise.all([...this.notes.values()].map((file) => this.updateWritten(file)));
	}

	// Obsidian reports a one-line comment as a paragraph, so sections alone don't tell.
	async updateWritten(file) {
		const sections = this.app.metadataCache.getFileCache(file)?.sections || [];
		const text = await this.app.vault.cachedRead(file);
		const written = sections.some((section) => {
			if (EMPTY_SECTION_TYPES.has(section.type)) return false;
			return !isOnlyComments(text.slice(section.position.start.offset, section.position.end.offset));
		});
		if (written) this.written.add(file.path);
		else this.written.delete(file.path);
	}

	#inFolders(file, folders) {
		return folders.some((folder) => file.path.startsWith(`${folder.replace(/\/+$/, '')}/`));
	}

	#findAnnotationFiles() {
		const paths = new Set();
		for (const note of this.#filesInLiteratureFolders()) {
			const value = this.app.metadataCache.getFileCache(note)?.frontmatter?.[this.literatureField];
			const match = /\[\[([^\]|]+)/.exec(String(value || ''));
			const dest = match && this.app.metadataCache.getFirstLinkpathDest(match[1], note.path);
			if (dest) paths.add(dest.path);
		}
		return paths;
	}

	includes(file) {
		return file.path === this.file.path || this.notes.has(file.path) || this.#inFolders(file, this.draftFolders);
	}

	#cache(key) {
		const file = this.notes.get(key);
		return file ? this.app.metadataCache.getFileCache(file) : null;
	}

	#createLookup() {
		return {
			resolve: (linkpath, fromKey) => {
				const dest = this.app.metadataCache.getFirstLinkpathDest(linkpath, fromKey);
				if (dest) return dest.path;
				const missing = linkpath.trim().toLowerCase();
				return this.missing.has(missing) ? MISSING_PREFIX + missing : null;
			},
			isLiterature: (key) => {
				if (this.annotationFiles.has(key)) return true;
				const file = this.app.vault.getAbstractFileByPath(key);
				return file instanceof TFile && this.#inFolders(file, this.literatureFolders) && Boolean(this.app.metadataCache.getFileCache(file)?.frontmatter?.title || this.app.metadataCache.getFileCache(file)?.frontmatter?.authors);
			},
			isInTree: (key) => this.notes.has(key) || key.startsWith(MISSING_PREFIX),
			isWritten: (key) => this.written.has(key),
			hasBlock: (key, id) => Boolean(this.#cache(key)?.blocks?.[id.toLowerCase()]),
			hasHeading: (key, heading) =>
				(this.#cache(key)?.headings || []).some((h) => h.level === 2 && normalizeHeading(h.heading) === normalizeHeading(heading)),
			titleOf: (key) => this.titleOf(this.notes.get(key)),
		};
	}

	titleOf(file) {
		if (!file) return '';
		const title = this.app.metadataCache.getFileCache(file)?.headings?.find((h) => h.level === 1);
		return title ? title.heading : file.basename;
	}

	classify(target, sourcePath) {
		return classifyLink(target, sourcePath, this.lookup);
	}
}

// All outline notes in the vault, kept up to date.
class Projects {
	constructor(app) {
		this.app = app;
		this.all = [];
		this.onChange = () => {};
		this.refreshing = false;
		this.pending = false;
	}

	isOutline(file) {
		return this.all.some((project) => project.file.path === file.path);
	}

	forFile(file) {
		return file ? this.all.find((project) => project.includes(file)) || null : null;
	}

	async onFileChanged(file) {
		const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
		if (this.isOutline(file) || frontmatter?.['latex-output']) {
			this.refresh();
			return;
		}
		await Promise.all(this.all.filter((project) => project.notes.has(file.path)).map((project) => project.updateWritten(file)));
		this.onChange();
	}

	async refresh() {
		if (this.refreshing) {
			this.pending = true;
			return;
		}
		this.refreshing = true;
		const projects = [];
		for (const file of this.app.vault.getMarkdownFiles()) {
			const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
			if (!frontmatter?.['latex-output']) continue;
			// Problems with the outline are reported when exporting, not while typing.
			const { items } = parseOutline(await this.app.vault.cachedRead(file), new Diagnostics(), file.path);
			const project = new Project(this.app, file, frontmatter, items);
			await project.loadWritten();
			projects.push(project);
		}
		this.all = projects;
		this.refreshing = false;
		this.onChange();
		if (this.pending) {
			this.pending = false;
			this.refresh();
		}
	}
}

module.exports = { Projects };
