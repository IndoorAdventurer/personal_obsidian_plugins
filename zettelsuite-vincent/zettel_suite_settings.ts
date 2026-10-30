/**
 * Defines all the settings that a user can configure.
 */

export interface ZettelSuiteSettings {
	
	// Default locations:
	moc_folder: string;
	fleeting_folder: string;
	permanent_folder: string;
	literature_folder: string;
	annotations_folders: string;

	default_tags: string[];

	// Custom templates to use instead of out of the box ones:
	custom_moc_template: string;
	custom_fleeting_template: string;
	custom_permanent_template: string;
	custom_literature_template: string;
	custom_annotations_template: string;
};

export const ZETTELSUITE_DEFAULT_SETTINGS: ZettelSuiteSettings = {
	moc_folder: "",
	fleeting_folder: "",
	permanent_folder: "",
	literature_folder: "",
	annotations_folders: "",
	default_tags: [],
	custom_moc_template: "",
	custom_fleeting_template: "",
	custom_permanent_template: "",
	custom_literature_template: "",
	custom_annotations_template: "",
};