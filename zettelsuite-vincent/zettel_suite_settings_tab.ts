import { App, PluginSettingTab, Setting } from "obsidian";
import ZettelSuitePlugin from "main";

export default class ZettelSuiteSettingsTab extends PluginSettingTab{

	plugin: ZettelSuitePlugin;

	constructor(app: App, plugin: ZettelSuitePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	public display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("MOC Directory")
			.setDesc("Where Maps of Content get saved. Must already exist!")
			.addText(text => text
				.setPlaceholder("my_mocs/")
				.setValue(this.plugin.settings.moc_folder)
				.onChange(async value => {
					this.plugin.settings.moc_folder = value;
					await this.plugin.saveSettings();
				})
		    );

		new Setting(containerEl)
			.setName("Fleeting Notes Directory")
			.setDesc("Where fleeting notes get saved. Must already exist!")
			.addText(text => text
				.setPlaceholder("my_fleeting_notes/")
				.setValue(this.plugin.settings.fleeting_folder)
				.onChange(async value => {
					this.plugin.settings.fleeting_folder = value;
					await this.plugin.saveSettings();
				})
		    );
		
		new Setting(containerEl)
			.setName("Permanent Notes Directory")
			.setDesc("Where permanent notes get saved. Must already exist!")
			.addText(text => text
				.setPlaceholder("my_permanent_notes/")
				.setValue(this.plugin.settings.permanent_folder)
				.onChange(async value => {
					this.plugin.settings.permanent_folder = value;
					await this.plugin.saveSettings();
				})
		    );
		
		new Setting(containerEl)
			.setName("Literature Notes Directory")
			.setDesc("Where literature notes get saved. Must already exist!")
			.addText(text => text
				.setPlaceholder("my_literature_notes/")
				.setValue(this.plugin.settings.literature_folder)
				.onChange(async value => {
					this.plugin.settings.literature_folder = value;
					await this.plugin.saveSettings();
				})
		    );
		
		new Setting(containerEl)
			.setName("Annotations Directory")
			.setDesc("Where annotation files (for the Annotator plugin) are saved. Must already exist!")
			.addText(text => text
				.setPlaceholder("my_literature_notes/annotations/")
				.setValue(this.plugin.settings.annotations_folders)
				.onChange(async value => {
					this.plugin.settings.annotations_folders = value;
						await this.plugin.saveSettings();
					})
				);
		
		new Setting(containerEl)
			.setName("Default tags")
			.setDesc("Comma-serparated list of tags to add by default.")
			.addText(text => text
				.setPlaceholder("tag1, tag2, tag3")
				.setValue(this.plugin.settings.default_tags.join(", "))
				.onChange(async value => {
					this.plugin.settings.default_tags = value
						.split(",").map(tag => tag.trim()).filter(tag => tag.length > 0);
					await this.plugin.saveSettings();
				})
		    );
		
		new Setting(containerEl)
			.setName("Alternative MOC Template")
			.setDesc("Leave blank if you want to keep using the default.")
			.addText(text => text
				.setPlaceholder("templates/MOC.md")
				.setValue(this.plugin.settings.custom_moc_template)
				.onChange(async value => {
					this.plugin.settings.custom_moc_template = value
					await this.plugin.saveSettings();
				})
		    );
		
		new Setting(containerEl)
			.setName("Alternative Fleeting Notes Template")
			.setDesc("Leave blank if you want to keep using the default.")
			.addText(text => text
				.setPlaceholder("templates/Fleeting.md")
				.setValue(this.plugin.settings.custom_fleeting_template)
				.onChange(async value => {
					this.plugin.settings.custom_fleeting_template = value
					await this.plugin.saveSettings();
				})
		    );
		
		new Setting(containerEl)
			.setName("Alternative Permanent Notes Template")
			.setDesc("Leave blank if you want to keep using the default.")
			.addText(text => text
				.setPlaceholder("templates/Permanent.md")
				.setValue(this.plugin.settings.custom_permanent_template)
				.onChange(async value => {
					this.plugin.settings.custom_permanent_template = value
					await this.plugin.saveSettings();
				})
		    );
		
		new Setting(containerEl)
			.setName("Alternative Literature Notes Template")
			.setDesc("Leave blank if you want to keep using the default.")
			.addText(text => text
				.setPlaceholder("templates/Literature.md")
				.setValue(this.plugin.settings.custom_literature_template)
				.onChange(async value => {
					this.plugin.settings.custom_literature_template = value
					await this.plugin.saveSettings();
				})
		    );
		
		new Setting(containerEl)
			.setName("Alternative Annotations Template")
			.setDesc("Leave blank if you want to keep using the default.")
			.addText(text => text
				.setPlaceholder("templates/Annotations.md")
				.setValue(this.plugin.settings.custom_annotations_template)
				.onChange(async value => {
					this.plugin.settings.custom_annotations_template = value
						await this.plugin.saveSettings();
					})
				);
		}

};