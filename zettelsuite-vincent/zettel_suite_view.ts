import { ItemView, Notice, Setting, TextAreaComponent, TextComponent, WorkspaceLeaf } from "obsidian";
import { parse } from "@retorquere/bibtex-parser"

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

        const container = this.containerEl.children[1];
        container.empty();

        // First section: creating simple note types:
        container.createEl("h2", {text: "Create New Note"})
        container.createEl("p", {text: "Either a Map of Content (MOC), Fleeting Note, or Permanent Note."})
    
        let file_name: TextComponent | null = null;
        new Setting(this.contentEl)
			.setName("File Name *")
            .setDesc("For MOC, Fleeting Note, or Permanent Note.")
			.addText(text => {
                text.setPlaceholder("e.g. Awesomeness MOC")
                file_name = text;
            });
        
        const buttonDiv = container.createEl("div");
        buttonDiv.createEl("button", {text: "Create MOC", cls: "mod-cta"})
            .addEventListener("click", () => this.validate_and_clear(
                [file_name!], [file_name!],
                () => this.onSimpleNote({note_type: "moc", file_name: file_name?.getValue()})
            ));
        buttonDiv.createEl("button", {text: "Create Fleeting Note", cls: "mod-cta"})
            .addEventListener("click", () => this.validate_and_clear(
                [file_name!], [file_name!],
                () => this.onSimpleNote({note_type: "fleeting", file_name: file_name?.getValue()})
            ));
        buttonDiv.createEl("button", {text: "Create Permanent Note", cls: "mod-cta"})
            .addEventListener("click", () => this.validate_and_clear(
                [file_name!], [file_name!],
                () => this.onSimpleNote({note_type: "permanent", file_name: file_name?.getValue()})
            ));

        // Second section: Literature Notes:
        container.createEl("h2", {text: "Add Reference"})
        container.createEl("p", {text: "Create a Literature Note, either from a BibTex item or custom input."})

        // BibTex element. Can be used to fill out the rest:
        let bib_item: TextAreaComponent | null = null;
        new Setting(this.contentEl)
			.setName("BibTex Item")
            .setDesc("This will autofill the below fields.")
			.addTextArea(text => {
                text.setPlaceholder(
`@article{tonkes1996analysis,
    title={Analysis why Vincent is awesome},
    author={Tonkes, Vincent},
    journal={Journal for Vincent Lovers},
    year={1996}
}`);
                bib_item = text;
                this.bibtex_input = text.inputEl;
                text.onChange(value => {
                    // Autofilling from bibtex if applicable
                    const partial_def = this.parse_bibtex(value);
                    if (partial_def === null)
                        return;
                    ref_title?.setValue(partial_def.title!);
                    ref_authors?.setValue(partial_def.authors!.join("; "));
                    ref_pubdate?.setValue(partial_def.pubdate!);
                });
                text.inputEl.setAttr("rows", "8");
                text.inputEl.style.width = "100%"; // TODO: see how they do it for input area
            });
        
        let ref_title: TextComponent | null = null;
        new Setting(this.contentEl)
			.setName("Title *")
            .setDesc("The title of your source.")
			.addText(text => {
                text.setPlaceholder("Analysis why Vincent is awesome")
                ref_title = text;
            });
        
        let ref_authors: TextComponent | null = null;
        new Setting(this.contentEl)
			.setName("Author(s) *")
            .setDesc("Lastname, Firstname. Use semicolon for more than one.")
			.addText(text => {
                text.setPlaceholder("Tonkes, Vincent; Einstein, Albert")
                ref_authors = text;
            });
        
        let ref_pubdate: TextComponent | null = null;
        new Setting(this.contentEl)
			.setName("Publication date *")
			.addText(text => {
                text.setPlaceholder("1996-11-01")
                ref_pubdate = text;
            });
        
        let ref_file: TextComponent | null = null;
        new Setting(this.contentEl)
			.setName("Annotation Target")
            .setDesc("pdf or ebup; url or local file. May be left blank.")
			.addText(text => {
                text.setPlaceholder("https://vincenttonkes.com/whyawesome.pdf")
                ref_file = text;
            });
        
        let lit_type: TextComponent | null = null;
        new Setting(this.contentEl)
			.setName("Literature type * ")
            .setDesc("E.g. paper, documentary, etc. Lower case, please.")
			.addText(text => {
                text.setValue("paper")
                lit_type = text;
            });
        
        new Setting(this.contentEl)
            .addButton(button => button
				.setButtonText("Create Literature Note")
				.setCta()
                .onClick(() => this.validate_and_clear(
                    [ref_title!, ref_authors!, ref_pubdate!],
                    [bib_item!, ref_title!, ref_authors!, ref_pubdate!, ref_file!],
                    () => this.onLitNote({
                        note_type: "literature",
                        lit_type: lit_type?.getValue().trim(),
                        title: ref_title?.getValue().trim(),
                        authors: ref_authors?.getValue().split(";").map(author => author.trim()),
                        pubdate: ref_pubdate?.getValue().trim(),
                        annotation_target: ref_file?.getValue().trim(),
                        bibtex: bib_item?.getValue().trim()
                    })
                ))
            )
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
     */
    async validate_and_clear(
        required_list: (TextComponent | TextAreaComponent)[],
        clear_list: (TextComponent | TextAreaComponent)[],
        callback: () => void
    ) {
        if (required_list.every(rc => rc.getValue().length > 0)) {
            try {
                await callback();
                clear_list.forEach(cc => cc.setValue(""));
            } catch (error) {
                new Notice(`Unexpected error: ${error}`);
            }
            return;
        }
        new Notice("Make sure all required fields are filled out.");
    }

    public parse_bibtex(bibtex: string): NoteDef | null {
        const parsed_bib = parse(bibtex);
        if (parsed_bib.errors.length > 0 || parsed_bib.entries.length === 0) {
            return null;
        }

        const entry = parsed_bib.entries[0];

        return {
            note_type: "literature",
            title: entry.fields.title,
            authors: entry.fields.author?.map(cr => `${cr.lastName}, ${cr.firstName}`),
            pubdate: entry.fields.year,
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
};