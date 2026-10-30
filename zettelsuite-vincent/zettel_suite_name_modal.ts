import { App, Modal, Notice, Setting } from "obsidian";

/**
 * Asks for a note's file name, for creating a note from a command without
 * going through the side panel. Enter creates it.
 */
export default class NoteNameModal extends Modal {

	private name = "";

	/**
	 * @param app See Modal's constructor
	 * @param note_type_name How to call this type of note in the title
	 * @param onSubmit Creates the note. If it throws, the modal stays open.
	 */
	constructor(
		app: App,
		private note_type_name: string,
		private onSubmit: (file_name: string) => Promise<void>
	) {
		super(app);
	}

	onOpen() {
		this.titleEl.setText(`New ${this.note_type_name}`);

		new Setting(this.contentEl)
			.setName("File Name")
			.addText(text => {
				text.onChange(value => this.name = value.trim());
				text.inputEl.addEventListener("keydown", event => {
					if (event.key === "Enter") {
						event.preventDefault();
						this.submit();
					}
				});
				// The modal isn't on screen yet at this point:
				setTimeout(() => text.inputEl.focus());
			});
	}

	onClose() {
		this.contentEl.empty();
	}

	private async submit() {
		if (!this.name) {
			new Notice("Enter a file name.");
			return;
		}
		try {
			await this.onSubmit(this.name);
			this.close();
		} catch (error) {
			new Notice(`Couldn't create note: ${error.message ?? error}`);
		}
	}
}
