import { FitnessSet } from "model/exercise-session";
import Workout, { WorkoutExerciseItem } from "model/workout";
import { App, Component, MarkdownRenderChild, MarkdownRenderer, Notice } from "obsidian";
import SelectExerciseModal from "./select_exercise_modal";


/**
 * For showing the workout you are currently doing or are about to do. Once the
 * workout is finished, it should show a different view.
 */
export default class ActiveWorkoutView extends MarkdownRenderChild {
    workout: Workout;
    app: App;
    container: HTMLElement;

    // Data for time tracking functionality:
    timerID: number | undefined = undefined;
    stopwatchStartTime: number | null = null;
    workoutTimeSpan: HTMLSpanElement | null = null;
    workoutBtn: HTMLButtonElement | null = null;
    stopwatchTimeSpan: HTMLSpanElement | null = null;
    stopwatchBtn: HTMLButtonElement | null = null;

    /**
     * @param workout Workout data object to draw
     * @param parent parent HTML element to draw the interface inside of.
     */
    constructor(parent: HTMLElement, app: App, workout: Workout) {
        super(parent);
        this.workout = workout;
        this.app = app;
        
        parent.empty();
        this.container = parent.createDiv({cls: "active-workout-container"});
    }
    
    /**
     * Draws the interactive user interface for a workout session. Clears
     * container first
     */
    public onload() {
        this.container.empty()
        this.container.createEl("h2", {text: "Workout Session"}).style.marginBlockEnd = "0";
        this.container.createEl("b", {text: this.workout.workoutName}).style.color = "var(--text-muted)";

        this.drawTimingHeader();
        
        for (const e of this.workout.exercises) {
            const container = this.makeExerciseContainer(e, this.container);
            this.drawExerciseContent(e, container);
        }

        this.createAddExerciseBtn();

    }

    /**
     * Responsible for the "Add Exercise" button at the bottom for adding an
     * exercise to the list.
     */
    private createAddExerciseBtn() {
        const btn = this.container.createEl("button", {text: "Add Exercise"});
        btn.addEventListener("click", () => {
            const modal = new SelectExerciseModal(
                this.app,
                async (file) => {
                    await this.workout.addExercise(file.basename, this.app)
                    this.onload();
                    this.workout.saveFn?.(this.workout.toYaml());
                });
            modal.open();
        });
    }

    /**
     * draws a div that shows the total workout time (with options to start/stop)
     * and an extra stopwatch for breaks.
     * 
     * @note decided to not make the stopwatch part of the Workout model as it
     * does not need to be persistent and is a specific feature/widget of this
     * specific view.
     */
    private drawTimingHeader() {

        const header = this.container.createDiv({cls: "vincent-fitness-time-header"});

        const workoutDiv = header.createDiv({cls: "vincent-fitness-time-header-inner"});
        this.workoutTimeSpan = workoutDiv.createSpan();
        this.workoutBtn = workoutDiv.createEl("button");

        const stopwatchDiv = header.createDiv({cls: "vincent-fitness-time-header-inner"});
        this.stopwatchTimeSpan = stopwatchDiv.createSpan();
        this.stopwatchBtn = stopwatchDiv.createEl("button");

        // Making it refresh every second:
        this.timedTimingHeaderRedraw();
        this.timerID = window.setInterval(this.timedTimingHeaderRedraw.bind(this), 1000);
        this.registerInterval(this.timerID);

        // Button handlers:
        this.workoutBtn.addEventListener("click", () => {
            if (this.workout.startTime === null)
                this.workout.startTime = Date.now();
            else {
                this.workout.endTime = Date.now();
                window.clearInterval(this.timerID);
                this.timerID = undefined;
                // TODO: better logic for ending a workout. We should even
                // show a different view now. And probably save everything ;-)

                // Saving (too lazy to make a dedicated method for this. Bad
                // encapsulation, I know..):
                this.workout.saveFn?.(this.workout.toYaml());
            }
            
            this.timedTimingHeaderRedraw();
        });
        this.stopwatchBtn.addEventListener("click", () => {
            this.stopwatchStartTime =
                this.stopwatchStartTime === null ? Date.now() : null;
            this.timedTimingHeaderRedraw();
        });
    }

    /**
     * Updates all stateful elements in the timing header (gets called every
     * second).
     */
    private timedTimingHeaderRedraw() {
        if (this.workout.endTime !== null)
            return; // TODO: come up with something better maybe.. we need to
                    // go to other view when this happens, actually.

        // Workout state:
        if (this.workout.startTime === null) {
            this.workoutTimeSpan?.setText("00:00");
            this.workoutBtn?.setText("Start Workout 🏋️");
        } else {
            this.workoutTimeSpan?.setText(
                ActiveWorkoutView.formatTimeDelta(
                    Date.now() - this.workout.startTime));
            this.workoutBtn?.setText("End Workout 🛌");
        }

        // Stopwatch state:
        if (this.stopwatchStartTime === null) {
            this.stopwatchTimeSpan?.setText("00:00");
            this.stopwatchBtn?.setText("Start Stopwatch ⏱️");
        } else {
            this.stopwatchTimeSpan?.setText(
                ActiveWorkoutView.formatTimeDelta(
                    Date.now() - this.stopwatchStartTime));
            this.stopwatchBtn?.setText("Stop Stopwatch 🛑");
        }

    }

    /**
     * Given a time delta (the difference in ms between two moments, this method)
     * returns formatted time MM:SS.
     */
    private static formatTimeDelta(delta: number): string {
        let seconds = Math.floor(delta / 1000);
        const minutes = Math.floor(seconds / 60);
        seconds = seconds % 60;

        return `${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;
    }

     /**
     * Makes a container div to put the exercise contents into. Made to look like
     * a callout and is collapsible.
     * @param ex The exercise (to extract name from it)
     * @param el The element to add this container to.
     * @returns HTML element we can start putting stuff in
     */
    private makeExerciseContainer(
        ex: WorkoutExerciseItem,
        el: HTMLElement
    ): HTMLElement {
        // TODO: maybe also add those two outer ones
        
        // Creating the callout div:
        const cDiv = el.createDiv(
            {cls: "callout is-collapsible is-collapsed"})
        cDiv.setAttr("data-callout", "note");
        cDiv.setAttr("data-callout-fold", "-");

        // Creating the title and arrow icons:
        const titleDiv = cDiv.createDiv({cls: "callout-title"});

        // Move this exercise up in the workout session
        const mvUpBtn = titleDiv.createEl("b", {text: "↑"});
        mvUpBtn.addEventListener("click", ev => {
            ev.stopPropagation();
            this.workout.moveExercise(ex, -1);
            this.onload();
            // Meh not saving. Too awkward..
        })

        // Move this exercise down in the workout session
        const mvDownBtn = titleDiv.createEl("b", {text: "↓"});
        mvDownBtn.addEventListener("click", ev => {
            ev.stopPropagation();
            this.workout.moveExercise(ex, +1);
            this.onload();
            // Meh not saving here either. Too awkward lol.
        })

        titleDiv.createDiv({cls: "callout-title-inner", text: ex.exercise.fileName});

        titleDiv.createEl("a", {
            text: "🔗",
            cls: "internal-link",
            attr: {
                'data-href': ex.exercise.filePath,
                'href': ex.exercise.filePath,
                'rel': 'noopener'
            }
        });

        // Optionally showing tiny message like "Optional Exercise".
        if (ex.workoutNote)
            titleDiv.createEl("small", {text: `(${ex.workoutNote})`});

        const icon = titleDiv.createDiv({cls: "callout-fold is-collapsed"});
        icon.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
            stroke-linejoin="round" class="svg-icon lucide-chevron-down">
            <path d="m6 9 6 6 6-6"></path>
        </svg>`;

        // And now the actual contents:
        const contents = cDiv.createDiv({cls: "callout-content"});
        contents.style.display = "none";

        // Add animations:
        this.animateExerciseContainer(cDiv, titleDiv, icon, contents);

        // Add some spacing between exercises:
        el.createDiv({cls: "vincent-fitness-padding-div"});
        return contents;
    }
    
    /**
     * Visualizes al the data of a single exercise
     * @param ex The exercise
     * @param el The container to draw it into (assumed to be for just this
     * exercise, because will clear on redraw).
     */
    private drawExerciseContent(ex: WorkoutExerciseItem, el: HTMLElement) {
        el.empty();

        el.createDiv({cls: "vincent-fitness-padding-div"});

        // Showing personal notes:
        if (ex.exercise.personalNotes) {
            el.createEl("div", {
                text: "Personal Notes",
                cls: "vincent-fitness-custom-heading"});
            this.renderMarkdown(ex.exercise.personalNotes, el, ex.exercise.filePath);
        }

        // Showing last comment notes:
        if (ex.exercise.latestComment) {
            el.createEl("div", {
                text: "Most Recent Comment",
                cls: "vincent-fitness-custom-heading"});
            this.renderMarkdown(ex.exercise.latestComment, el, ex.exercise.filePath);
        }

        // Showing sets:
        el.createEl("div", {
            text: "Sets",
            cls: "vincent-fitness-custom-heading"});

        let status: "done" | "todo" = "done";
        const processSet = (set: FitnessSet) => {
            const [cb, repsI, weightI] = this.drawSet(set, el, status);
            
            // Toggle if a set is done via checkbox:
            cb?.addEventListener("change", async () => {
                Workout.toggleSetDone(ex, set);
                this.drawExerciseContent(ex, el);

                // We save when all sets are done:
                if (ex.todo.length === 0) {
                    // In this order: saving the workout redraws everything,
                    // which reloads the exercise note we're writing to.
                    await this.updateAndSaveExercise(ex);
                    this.workout.saveFn?.(this.workout.toYaml());
                }
            });

            // Reps changed (no need to redraw: user kinda did it for us):
            repsI?.addEventListener("change",
                () => set.repetitions = parseInt(repsI.value));
            
            // Weight changed (no need to redraw: user did it for us):
            weightI?.addEventListener("change",
                () => set.weight = parseFloat(weightI.value));
        }
        ex.done.forEach(processSet);
        status = "todo";
        ex.todo.forEach(processSet);

        // Button to add extra set:
        const btnBox = el.createDiv({cls: "vincent-fitness-btn-box"})
        const addBtn = btnBox.createEl("button", {text: "Add Set"});
        addBtn.addEventListener("click", () => {
            Workout.addSet(ex);
            this.drawExerciseContent(ex, el);
        });

        const delBtn = btnBox.createEl("button", {text: "Delete Unfinished Sets"});
        delBtn.addEventListener("click", () => {
            Workout.deleteTodoSets(ex);
            this.drawExerciseContent(ex, el);
            this.updateAndSaveExercise(ex);
        });

        // Area to comment on how exercise went
        el.createDiv({cls: "vincent-fitness-padding-div"});
        el.createEl("div", {
            text: "Exercise Comments",
            cls: "vincent-fitness-custom-heading"});
        const commentsSpace = el.createEl("textarea");
        commentsSpace.setAttr("placeholder", "How did it go?");
        commentsSpace.value = ex.comment || "";
        commentsSpace.setAttr("rows", "3");
        commentsSpace.style.width = "100%";
        commentsSpace.addEventListener("change",
            () => ex.comment = commentsSpace.value);
        
        // Button to delete exercise from set:
        el.createDiv({cls: "vincent-fitness-padding-div"});
        const delExBtn = el.createEl("button", 
            {cls: "mod-destructive", text: "Delete Exercise from Workout"});
        delExBtn.addEventListener("click", () => {
            this.workout.deleteExercise(ex);
            this.onload();
            this.workout.saveFn?.(this.workout.toYaml());
        });
    }

    private async updateAndSaveExercise(ex: WorkoutExerciseItem) {
        ex.exercise.registerVolume(ex.done);
        if (ex.comment)
            ex.exercise.latestComment = ex.comment;

        try {
            await ex.exercise.saveExercise();
            new Notice(`Updated the "${ex.exercise.fileName}" note.`);
        } catch (error) {
            new Notice(`Could not update the "${ex.exercise.fileName}" note: ${error.message}`);
        }
    }

    /**
     * Draw a single set
     * @param set The Set data structure (reps, weights, unit)
     * @param el HTML element to add to
     * @param status if it is a completed set or an unfinished one
     * @returns list containing checkbox element, repetitions input element and
     *      weight input element, so we can add action listeners to it outside
     *      of this method.
     */
    private drawSet(set: FitnessSet, el: HTMLElement, status: "todo" | "done"): (HTMLInputElement | null)[] {
        const div = el.createDiv({cls: "vincent-fitness-set"});
        const checkbox = div.createEl("input", {type: "checkbox"});
        div.createEl("span", {text: "Set of"});
        const reps = div.createEl("input", {
            type: "number",
            cls: "vincent-fitness-set-number-input",
            value: set.repetitions.toString()});
        div.createEl("span", {text: "reps"});

        let weight: HTMLInputElement | null = null;
        if (set.unit !== "bodyweight") {
            div.createEl("span", {text: "×"});
            weight = div.createEl("input", {
                type: "number",
                cls: "vincent-fitness-set-number-input",
                value: set.weight.toString()});
            weight.setAttr("step", "any");
            div.createEl("span", {text: set.unit});
        }

        if (status === "done") {
            div.style.opacity = "0.5";
            checkbox.checked = true;
        }

        return [checkbox, reps, weight];
    }

    /**
     * The container from makeExerciseContainer can be folded in and out. This
     * method handles the animations.
     * @param cDiv The callout div (the outer most div of the container)
     * @param titleDiv Where you can click on to expand/retract
     * @param icon The icon that has an animation
     * @param contents The contents that gets hidden on retraction
     */
    private animateExerciseContainer(
        cDiv: HTMLElement,
        titleDiv: HTMLElement,
        icon: HTMLElement,
        contents: HTMLElement
    ) {
        let isCollapsed = true;
        contents.style.transition = "height 0.1s ease-out";
        
        titleDiv.addEventListener("click", () => {
            isCollapsed = !isCollapsed;
            if (isCollapsed) {
                cDiv.addClass("is-collapsed");
                icon.addClass("is-collapsed");

                const height = contents.scrollHeight;
                contents.style.height = height + "px";
                requestAnimationFrame(() => contents.style.height = "0px")
                setTimeout(() => contents.style.display = "none", 100);

            } else {
                cDiv.removeClass("is-collapsed");
                icon.removeClass("is-collapsed");

                contents.style.display = "";
                contents.style.height = "0px";

                setTimeout(() => contents.style.height = "", 100)
                requestAnimationFrame(() => {
                    const height = contents.scrollHeight;
                    contents.style.height = height + "px";
                })


            }
        })
    }

    /**
     * Convenience wrapper around MarkdownRenderer.render. Ignoring the fact that
     * it returns a promise
     * @param markdown The string of markdown source code to render
     * @param el HTML element to add the contents to
     * @param sourcePath Path where markdown came from. Needed for WikiLinks.
     */
    private renderMarkdown(
        markdown: string,
        el: HTMLElement,
        sourcePath: string) {
        MarkdownRenderer.render(
            this.app,
            markdown,
            el,
            sourcePath,
            new Component()
        ).catch(() =>
            console.error(`Markdown from "${sourcePath}" could not be shown.`));
    }
};