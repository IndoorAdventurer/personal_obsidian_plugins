const { Modal, Notice, Setting } = require('obsidian');
const { newReportFiles, nameProblem } = require('../core/newReport');

// Creates a report folder and opens its outline note. Never touches what's already there.
async function createReport(app, name, parent) {
	const isTaken = (note) => Boolean(app.metadataCache.getFirstLinkpathDest(note, ''));
	const report = newReportFiles(name, parent, isTaken);
	if (app.vault.getAbstractFileByPath(report.folder)) {
		throw new Error(`"${report.folder}" already exists.`);
	}
	for (const folder of report.folders) await app.vault.createFolder(folder);
	for (const [path, contents] of report.files) await app.vault.create(path, contents);
	await app.workspace.openLinkText(report.outlinePath, '', false);
}

class NewReportModal extends Modal {
	constructor(app) {
		super(app);
		this.name = '';
		this.parent = app.workspace.getActiveFile()?.parent?.path || '';
		if (this.parent === '/') this.parent = '';
	}

	onOpen() {
		this.titleEl.setText('New LaTeX report');
		const { contentEl } = this;
		new Setting(contentEl).setName('Name').addText((text) => {
			text.setPlaceholder('My report').onChange((value) => { this.name = value.trim(); });
			text.inputEl.addEventListener('keydown', (event) => {
				if (event.key === 'Enter') this.submit();
			});
			setTimeout(() => text.inputEl.focus());
		});
		new Setting(contentEl)
			.setName('Create inside folder')
			.setDesc('Empty for the top of the vault.')
			.addText((text) => text.setValue(this.parent).onChange((value) => { this.parent = value.trim().replace(/\/+$/, ''); }));
		new Setting(contentEl).addButton((button) => button.setButtonText('Create').setCta().onClick(() => this.submit()));
	}

	onClose() {
		this.contentEl.empty();
	}

	async submit() {
		const problem = nameProblem(this.name);
		if (problem) {
			new Notice(problem);
			return;
		}
		try {
			await createReport(this.app, this.name, this.parent);
			this.close();
		} catch (error) {
			new Notice(error.message);
		}
	}
}

module.exports = { NewReportModal, createReport };
