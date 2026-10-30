const { Modal, Notice, ButtonComponent, FileSystemAdapter } = require('obsidian');
const { build } = require('../core/build');

let running = false;

async function runExport(plugin, project, final) {
	if (running) {
		new Notice('An export is already running.');
		return;
	}
	const { adapter } = plugin.app.vault;
	if (!(adapter instanceof FileSystemAdapter)) {
		new Notice('Exporting needs a vault on the local file system.');
		return;
	}

	running = true;
	const progress = new Notice('Exporting...', 0);
	try {
		const result = await build({
			vaultPath: adapter.getBasePath(),
			outlinePath: project.file.path,
			final,
			tools: plugin.settings,
			onProgress: (step) => progress.setMessage(`${step}...`),
		});
		new ExportResultModal(plugin.app, result).open();
	} finally {
		progress.hide();
		running = false;
	}
}

// The outcome of an export. Clicking a message opens the note it's about.
class ExportResultModal extends Modal {
	constructor(app, result) {
		super(app);
		this.result = result;
	}

	onOpen() {
		const { result, contentEl } = this;
		contentEl.addClass('otl-result');
		this.titleEl.setText(result.ok ? 'Export finished' : 'Export failed');

		if (result.stats) {
			const { sections, unwritten } = result.stats;
			contentEl.createEl('p', { text: `${sections} sections, ${unwritten} unwritten.` });
		}
		this.#diagnostics('error', 'Errors');
		this.#diagnostics('warning', 'Warnings');
		this.#changes();

		const buttons = contentEl.createDiv({ cls: 'otl-result-buttons' });
		if (result.pdf) {
			new ButtonComponent(buttons).setButtonText('Open PDF').setCta().onClick(() => this.#openPath(result.pdf));
		}
		if (result.outDir) {
			new ButtonComponent(buttons).setButtonText('Open output folder').onClick(() => this.#openPath(result.outDir));
		}
	}

	onClose() {
		this.contentEl.empty();
	}

	#openPath(target) {
		require('electron').shell.openPath(target);
	}

	#diagnostics(level, title) {
		const items = this.result.diagnostics.filter((item) => item.level === level);
		if (!items.length) return;
		this.contentEl.createEl('h4', { text: `${title} (${items.length})` });
		const list = this.contentEl.createEl('ul', { cls: `otl-result-${level}` });
		for (const { message, note } of items) {
			const row = list.createEl('li');
			row.createSpan({ text: message });
			if (note) {
				const link = row.createEl('a', { text: note, cls: 'otl-result-note' });
				link.addEventListener('click', () => {
					this.close();
					this.app.workspace.openLinkText(note, '', false);
				});
			}
		}
	}

	#changes() {
		const { added, changed, removed } = this.result.changes;
		const count = added.length + changed.length + removed.length;
		if (!this.result.ok) return;
		this.contentEl.createEl('h4', { text: count ? `Files changed (${count})` : 'No files changed' });
		if (!count) return;
		const list = this.contentEl.createEl('ul', { cls: 'otl-result-changes' });
		for (const [label, files] of [['added', added], ['changed', changed], ['removed', removed]]) {
			for (const file of files) list.createEl('li', { text: `${label}: ${file}` });
		}
	}
}

module.exports = { runExport };
