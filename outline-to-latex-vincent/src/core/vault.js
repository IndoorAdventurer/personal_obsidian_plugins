const fs = require('fs');
const path = require('path');

// Finds files the way Obsidian's links do: by name, or by a path suffix when
// the link has a slash. Paths are vault-relative with forward slashes.
class VaultIndex {
	constructor(root) {
		this.root = root;
		this.files = [];
		this.byName = new Map();
		this.#scan('');
	}

	#scan(dir) {
		for (const entry of fs.readdirSync(path.join(this.root, dir), { withFileTypes: true })) {
			if (entry.name.startsWith('.')) continue;
			const rel = dir ? `${dir}/${entry.name}` : entry.name;
			if (entry.isDirectory()) {
				this.#scan(rel);
			} else if (entry.isFile()) {
				this.files.push(rel);
				for (const name of [entry.name, entry.name.replace(/\.md$/, '')]) {
					const key = name.toLowerCase();
					if (!this.byName.has(key)) this.byName.set(key, []);
					this.byName.get(key).push(rel);
				}
			}
		}
	}

	absolute(rel) {
		return path.join(this.root, rel);
	}

	read(rel) {
		return fs.readFileSync(this.absolute(rel), 'utf8');
	}

	// With several matches: the same folder wins, then the shortest path.
	resolve(link, fromPath = '') {
		const clean = link.trim().replace(/\\/g, '/').replace(/^\/+/, '');
		if (!clean) return null;
		const name = clean.split('/').pop().toLowerCase();
		const candidates = (this.byName.get(name) || []).filter((file) => {
			if (!clean.includes('/')) return true;
			const lower = file.toLowerCase();
			const wanted = clean.toLowerCase();
			return lower === wanted || lower === `${wanted}.md` || lower.endsWith(`/${wanted}`) || lower.endsWith(`/${wanted}.md`);
		});
		if (!candidates.length) return null;
		const folder = path.posix.dirname(fromPath);
		const sameFolder = candidates.find((file) => path.posix.dirname(file) === folder);
		return sameFolder || [...candidates].sort((a, b) => a.length - b.length)[0];
	}

	// Markdown notes directly or indirectly inside a folder.
	notesIn(folder) {
		const prefix = `${folder.replace(/\/+$/, '')}/`;
		return this.files.filter((file) => file.startsWith(prefix) && file.endsWith('.md'));
	}
}

module.exports = { VaultIndex };
