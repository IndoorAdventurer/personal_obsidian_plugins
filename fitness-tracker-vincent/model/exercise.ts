import { App, CachedMetadata, normalizePath, Notice, TFile } from "obsidian";
import { computeVolume, ExerciseSession, parseFitnessSet, serializeFitnessSet } from "./exercise-session";

/**
 * Defines a fitness exercise (e.g. bench press).
 */
export default class Exercise {
    
    app: App;
    fileName: string;               // Base name of the exercise note.
    filePath: string;               // A full path you can use for proper linking.
    currentVolume: ExerciseSession; // How many sets/reps/kg you currently do.
    recordVolume: ExerciseSession;  // Highest volume ever lifted.

    personalNotes: string;          // Reminds when doing the exercise (markdown).
    latestComment: string;          // E.g. go up 1kg in volume next time.

    /**
     * Creates empty object. Call loadFromFile or other async functions to
     * populate fields.
     */
    constructor(app: App) {
        this.app = app;
        this.fileName = "";
        this.filePath = "";
        this.currentVolume = [];
        this.recordVolume = [];
        this.personalNotes = "";
        this.latestComment = "";
    }

    /**
     * Load all relevant data from an exercise note.
     */
    public async loadFromFile(fileName: string) {
        // First of all, because the workout gets saved with this name. Whatever
        // goes wrong below, it should never get lost.
        this.fileName = fileName;

        const file = this.findExerciseFile(fileName);
        const cache = file && await this.waitForExerciseCache(file);
        if (!file || !cache) {
            new Notice(`Could not load exercise "${fileName}". Make sure its note exists and is an exercise note.`);
            return;
        }
        const frontmatter = cache.frontmatter;
        
        this.filePath = file.path;
        // currentVolume should be set, but I handle this in workout.ts:
        this.currentVolume = frontmatter?.["current-volume"]?.map(parseFitnessSet) || [];
        this.recordVolume = frontmatter?.["record-volume"]?.map(parseFitnessSet) || [];
        await this.parsePersonalNotes(file, cache);
        this.latestComment = frontmatter?.["latest-comment"] || "";
    }

    /**
     * Finds an exercise note by name. Also works for a note that is missing from
     * the metadata cache right now, as happens just after it got saved.
     */
    private findExerciseFile(fileName: string): TFile | null {
        return this.getAllExerciseFiles().find(file =>
            file.basename.toLowerCase() === fileName.toLowerCase()
        ) ?? this.app.metadataCache.getFirstLinkpathDest(fileName, "");
    }

    /**
     * Obsidian briefly has no metadata for a note after it got changed, and the
     * workout gets redrawn right around that time. This gives it a moment.
     * @returns The metadata, or null if this is not (or no longer) an exercise.
     */
    private async waitForExerciseCache(file: TFile): Promise<CachedMetadata | null> {
        for (let attempt = 0; attempt < 30; attempt++) {
            const cache = this.app.metadataCache.getFileCache(file);
            if (cache?.frontmatter?.["fitness-note-type"] === "exercise-note")
                return cache;
            await new Promise(resolve => window.setTimeout(resolve, 100));
        }
        return null;
    }

    /**
     * Registers a new volume. Potentially new record volume.
     */
    public registerVolume(volume: ExerciseSession) {
        this.currentVolume = volume;
        if (computeVolume(volume) > computeVolume(this.recordVolume))
            this.recordVolume = volume;
    }

    /**
     * Saves current volume, record volume, and latest comment.
     */
    public async saveExercise() {
        const file = this.app.vault.getAbstractFileByPath(this.filePath);
        if (!file || !(file instanceof TFile))
            throw Error("Could not recognize exercise file while saving workout.");

        await this.app.fileManager.processFrontMatter(file, fm => {
            fm["current-volume"] = this.currentVolume.map(set => serializeFitnessSet(set));
            fm["record-volume"] = this.recordVolume.map(set => serializeFitnessSet(set));
            fm["latest-comment"] = this.latestComment;
        })
    }

    /**
     * Returns a list of all files that define fitness-note-type: exercise in
     * the YAML.
     */
    public getAllExerciseFiles() {
        return this.app.vault.getMarkdownFiles()
            .filter(file => {
                const frontmatter =
                    this.app.metadataCache.getFileCache(file)?.frontmatter;
                return frontmatter?.["fitness-note-type"] === "exercise-note";
            })
    }

    /**
     * sets this.personalNotes to the related contents within the note
     * @param file The file contents.
     * @param cache The cache containing header information.
     */
    private async parsePersonalNotes(file: TFile, cache: CachedMetadata | null) {
        const content = await this.app.vault.read(file);
        const pnHeading = cache?.headings?.find(h => h.heading === "Personal Notes");
        if (!pnHeading) {
            const eMsg = `${this.fileName} note does not have a "Personal Notes" section. Leaving it blank.`;
            new Notice(eMsg);
            this.personalNotes = "";
            return;
        }
        const pnStart = pnHeading.position.end.offset;
        const nextHeading = cache?.headings?.find(h => 
            h.position.start.offset > pnStart && h.level <= pnHeading.level);
        const pnEnd = nextHeading ? nextHeading.position.start.offset : content.length;

        this.personalNotes = content.slice(pnStart, pnEnd).trim();
    }
};

// TODO add image as well. We'll see how later.