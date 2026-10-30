const { PluginSettingTab, Setting } = require('obsidian');

const DEFAULT_SETTINGS = { pandoc: 'pandoc', latexmk: 'latexmk', inkscape: 'inkscape' };

// Per device, because where these programs live differs between devices.
class SettingsTab extends PluginSettingTab {
	constructor(app, plugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display() {
		const { containerEl, plugin } = this;
		containerEl.empty();
		const tools = [
			['pandoc', 'Pandoc', 'Converts the notes to LaTeX.'],
			['latexmk', 'latexmk', 'Compiles the PDF.'],
			['inkscape', 'Inkscape', 'Converts SVG figures.'],
		];
		for (const [key, name, description] of tools) {
			new Setting(containerEl)
				.setName(name)
				.setDesc(`${description} A command or a full path.`)
				.addText((text) =>
					text.setValue(plugin.settings[key]).onChange(async (value) => {
						plugin.settings[key] = value.trim() || DEFAULT_SETTINGS[key];
						await plugin.saveData(plugin.settings);
					}),
				);
		}
	}
}

module.exports = { SettingsTab, DEFAULT_SETTINGS };
