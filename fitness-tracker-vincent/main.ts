import { MarkdownPostProcessorContext, Plugin } from 'obsidian';
import Workout from 'model/workout';
import { FitnessAppSettings, FITNESSAPP_DEFAULT_SETTINGS } from 'model/settings-data';
import ActiveWorkoutView from 'presentation/active-workout-view';
import { FitnessAppSettingsTab } from 'presentation/settings-tab';
import CompletedWorkoutView from 'presentation/completed-workout-view';


export default class FitnessPlugin extends Plugin {

	settings: FitnessAppSettings;
	
	async onload() {
		
		// Settings:
		await this.loadSettings();
		this.addSettingTab(new FitnessAppSettingsTab(this.app, this));
		
		/**
		 * For showing a UI inside a note for an individual workout session:
		 */
		this.registerMarkdownCodeBlockProcessor("fitness-workout",
			async (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
								
				const workout = await Workout.workoutFromYaml(
					source, this.app, yaml => {
						
						// Overwriting codeblock with updated yaml contents:
						const sInfo = ctx.getSectionInfo(el);
						if (!sInfo) throw Error("Could not find block");
						const {lineStart, lineEnd} = sInfo;

						const editor = this.app.workspace.activeEditor?.editor;
						if (!editor) throw Error("No active editor!");

						yaml = "```fitness-workout\n" + yaml + "```\n";
						
						editor.replaceRange(yaml,
							{line: lineStart, ch: 0}, {line: lineEnd+1, ch:0});
					});
				
				// TODO: I should actually use a switching class, but it happens
				// to call this preprocessor function again whenever any
				// changes are made to the underlying code block (but bit
				// dangerous to rely on that, of course).
				if (workout.endTime === null) {
					const aView = new ActiveWorkoutView(el, this.app, workout);
					ctx.addChild(aView);
					aView.load();
				} else {
					const cView = new CompletedWorkoutView(el, this.app, workout);
					ctx.addChild(cView);
					cView.load();
				}

				// console.log(workout.toYaml());

			}
		)
	}

	// async onunload() {
	// 	// Nothing yet
	// }

	async loadSettings() {
		this.settings = Object.assign({}, FITNESSAPP_DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

// STUFF I had in the preprocessor before

				// // Adding an image:
				// console.log(this.app.vault.adapter.getResourcePath("https://upload.wikimedia.org/wikipedia/commons/4/43/Maarten_van_Rossem_-_2025_%28001%29_%28cropped%29.jpg"));
				// const img = callout_content.createEl("img", {attr: {src: this.app.vault.adapter.getResourcePath("https://upload.wikimedia.org/wikipedia/commons/4/43/Maarten_van_Rossem_-_2025_%28001%29_%28cropped%29.jpg"), alt: "MVR"}});
				// img.style.width = "100px";

				// let is_collapsed = false;

				// callout_title.addEventListener("click", () => {
				// 	is_collapsed = !is_collapsed;

				// 	if (is_collapsed) {
				// 		callout.addClass("is-collapsed");
				// 		collapse_icon.addClass("is-collapsed");
				// 		callout_content.style.display = "none";
				// 	} else {
				// 		callout.removeClass("is-collapsed");
				// 		collapse_icon.removeClass("is-collapsed");
				// 		callout_content.style = "";
				// 	}
				// })


// <div class="el-div">
	// <div data-callout-metadata="" data-callout-fold="-" data-callout="note" class="callout is-collapsible is-collapsed">
		// <div class="callout-title" dir="auto"><div class="callout-icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-pencil"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"></path><path d="m15 5 4 4"></path></svg></div><div class="callout-title-inner">Callout</div><div class="callout-fold is-collapsed"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-chevron-down"><path d="m6 9 6 6 6-6"></path></svg></div></div><div class="callout-content" style="display: none;">
		// <p dir="auto">This is a test callout. I just want to see what will happen</p>
		// </div>
	// </div>
// </div>