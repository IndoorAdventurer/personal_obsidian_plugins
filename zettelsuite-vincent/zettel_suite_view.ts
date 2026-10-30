import { ButtonComponent, ItemView, Notice, TextAreaComponent, TextComponent, WorkspaceLeaf } from "obsidian";
import { parse } from "@retorquere/bibtex-parser"
import { authorFromBibtex, citationFromBibtex } from "zettel_suite_text";

/**
 * A view for the ZettelSuite plugin in which you can quickly create boilerplate
 * notes for in my Zettelkasten pipeline.
 */
export default class ZettelSuiteView extends ItemView {

	public static readonly VIEW_TYPE_ZETTELSUITEVIEW = "zettelview";
	private onSimpleNote: (nd: NoteDef) => void;
	private onLitNote: (nd: NoteDef) => void;
	private bibtex_input: HTMLTextAreaElement | null = null;

	/**
	 *
	 * @param leaf See ItemView's constructor
	 * @param onSimpleNote Callback to create MOC, Fleeting or Permanent Note.
	 * @param onLitNote Callback to create Literature Note
	 */
	constructor(
		leaf: WorkspaceLeaf,
		onSimpleNote: (nd: NoteDef) => void,
		onLitNote: (nd: NoteDef) => void
	) {
		super(leaf)
		this.onSimpleNote = onSimpleNote;
		this.onLitNote = onLitNote;
	}

	getViewType(): string {
		return ZettelSuiteView.VIEW_TYPE_ZETTELSUITEVIEW;
	}

	getDisplayText(): string {
		return "Zettelsuite";
	}

	getIcon(): string {
		return "brain-circuit";
	}

	async onOpen() {

		// Filling out the user interface with the appropriate forms:

		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass("zettelsuite-panel");

		this.createSimpleNoteForm(container);
		this.createLiteratureNoteForm(container);
	}

	/**
	 * First section: creating simple note types.
	 */
	private createSimpleNoteForm(container: HTMLElement) {
		container.createEl("h4", {text: "New note"});

		const file_name = this.addField(container, "File name", text =>
			text.setPlaceholder("e.g. Awesomeness MOC"),
			"Enter creates a fleeting note.");

		const create = (note_type: NoteDef["note_type"]) => this.validate_and_clear(
			[file_name], [file_name],
			() => this.onSimpleNote({note_type, file_name: file_name.getValue().trim()})
		);

		// Enter creates a fleeting note, because that's the quick one:
		file_name.inputEl.addEventListener("keydown", event => {
			if (event.key === "Enter")
				create("fleeting");
		});

		const buttons = container.createDiv({cls: "zettelsuite-buttons"});
		new ButtonComponent(buttons).setButtonText("+ Fleeting")
			.onClick(() => create("fleeting"));
		new ButtonComponent(buttons).setButtonText("+ Permanent")
			.onClick(() => create("permanent"));
		new ButtonComponent(buttons).setButtonText("+ MOC")
			.onClick(() => create("moc"));
	}

	/**
	 * Second section: Literature Notes. The BibTex field does most of the work,
	 * so the separate fields are tucked away until you need them.
	 */
	private createLiteratureNoteForm(container: HTMLElement) {
		container.createEl("h4", {text: "New literature note"});

		// BibTex element. Can be used to fill out the rest:
		const bib_field = container.createDiv({cls: "zettelsuite-field"});
		bib_field.createEl("label", {text: "BibTex"});
		const bib_item = new TextAreaComponent(bib_field).setPlaceholder(
`@article{tonkes1996analysis,
    title={Analysis why Vincent is awesome},
    author={Tonkes, Vincent},
    journal={Journal for Vincent Lovers},
    year={1996}
}`);
		bib_item.inputEl.setAttr("rows", "7");
		this.bibtex_input = bib_item.inputEl;

		// BibTex from e.g. Google Scholar ends with a newline, which isn't useful:
		bib_item.inputEl.addEventListener("paste", event => {
			const pasted = event.clipboardData?.getData("text/plain");
			if (!pasted)
				return;
			event.preventDefault();
			const input = bib_item.inputEl;
			input.setRangeText(pasted.trim(), input.selectionStart, input.selectionEnd, "end");
			input.dispatchEvent(new Event("input"));
		});

		const bib_status = bib_field.createDiv({cls: "zettelsuite-hint"});

		const details = container.createEl("details", {cls: "zettelsuite-details"});
		details.createEl("summary", {text: "Details"});

		const ref_title = this.addField(details, "Title", text =>
			text.setPlaceholder("Analysis why Vincent is awesome"));
		const ref_authors = this.addField(details, "Authors", text =>
			text.setPlaceholder("Tonkes, Vincent; Einstein, Albert"),
			"Lastname, Firstname. Semicolons between authors.");
		const ref_pubdate = this.addField(details, "Publication date", text =>
			text.setPlaceholder("1996-11-01"));
		const ref_file = this.addField(details, "Annotation target", text =>
			text.setPlaceholder("https://vincenttonkes.com/whyawesome.pdf"),
			"Pdf or epub; url or local file. May be left blank.");
		const lit_type = this.addField(details, "Literature type", text =>
			text.setValue("paper"),
			"E.g. paper, documentary, etc. Lower case, please.");

		bib_item.onChange(value => {
			// Autofilling from bibtex if applicable
			const partial_def = this.parse_bibtex(value);
			if (partial_def === null) {
				bib_status.setText(value.trim() ? "Can't read this yet. You can also fill out Details." : "");
				bib_status.toggleClass("mod-warning", value.trim().length > 0);
				return;
			}
			ref_title.setValue(partial_def.title ?? "");
			ref_authors.setValue(partial_def.authors?.join("; ") ?? "");
			ref_pubdate.setValue(partial_def.pubdate ?? "");
			bib_status.removeClass("mod-warning");
			bib_status.setText(`Filled from BibTex: ${partial_def.title ?? "no title"}`);
		});

		const required = [ref_title, ref_authors, ref_pubdate];
		new ButtonComponent(container.createDiv({cls: "zettelsuite-buttons"}))
			.setButtonText("+ Literature note")
			.onClick(async () => {
				// What's missing is in there, so it should be visible:
				if (required.some(field => field.getValue().length === 0))
					details.open = true;
				await this.validate_and_clear(
					required,
					[bib_item, ref_title, ref_authors, ref_pubdate, ref_file],
					() => this.onLitNote({
						note_type: "literature",
						lit_type: lit_type.getValue().trim(),
						title: ref_title.getValue().trim(),
						authors: ref_authors.getValue().split(";").map(author => author.trim()),
						pubdate: ref_pubdate.getValue().trim(),
						annotation_target: ref_file.getValue().trim(),
						bibtex: bib_item.getValue().trim(),
						citation: this.parse_bibtex(bib_item.getValue())?.citation
					}),
					() => {
						bib_status.setText("");
						details.open = false;
					}
				);
			});
	}

	/**
	 * Adds a label with a text field below it. Obsidian's own Setting puts these
	 * next to each other, for which a side panel is usually too narrow.
	 */
	private addField(
		parent: HTMLElement,
		label: string,
		setUp: (text: TextComponent) => void,
		hint?: string
	): TextComponent {
		const field = parent.createDiv({cls: "zettelsuite-field"});
		field.createEl("label", {text: label});
		const text = new TextComponent(field);
		setUp(text);
		if (hint)
			field.createDiv({text: hint, cls: "zettelsuite-hint"});
		return text;
	}

	async onClose() {
		// Nothing to clean up.
	}

	/**
	 * Puts the cursor in the BibTex field, the first step of a literature note.
	 */
	public focusBibtex() {
		this.bibtex_input?.focus();
	}

	/**
	 * Checks if required fields are filled out. If so, .
	 * @param required_list Fields that are must be filled out
	 * @param clear_list Fields that should be cleared afterwards
	 * @param callback Callback that executes if all fields filled out
	 * @param onSuccess Anything else to reset after the callback succeeded
	 */
	async validate_and_clear(
		required_list: (TextComponent | TextAreaComponent)[],
		clear_list: (TextComponent | TextAreaComponent)[],
		callback: () => void,
		onSuccess?: () => void
	) {
		if (required_list.every(rc => rc.getValue().length > 0)) {
			try {
				await callback();
				clear_list.forEach(cc => cc.setValue(""));
				onSuccess?.();
			} catch (error) {
				new Notice(`Unexpected error: ${error}`);
			}
			return;
		}
		new Notice("Make sure all required fields are filled out.");
	}

	public parse_bibtex(bibtex: string): NoteDef | null {
		let parsed_bib;
		try {
			parsed_bib = parse(bibtex);
		} catch {
			return null;	// Happens while it's still being typed or pasted
		}
		if (parsed_bib.errors.length > 0 || parsed_bib.entries.length === 0) {
			return null;
		}

		const entry = parsed_bib.entries[0];

		return {
			note_type: "literature",
			title: entry.fields.title,
			authors: entry.fields.author?.map(authorFromBibtex),
			pubdate: entry.fields.year ?? entry.fields.date,
			citation: citationFromBibtex(entry),
		};
	}
};

/**
 * Interface for defining every type of note.
 */
export interface NoteDef {
	note_type: "moc" | "fleeting" | "permanent" | "literature";
	file_name?: string;
	lit_type?: string;
	title?: string;
	authors?: string[];
	pubdate?: string;
	annotation_target?: string;
	bibtex?: string;
	annotations_file?: string;
	citation?: {[property: string]: string};
};
