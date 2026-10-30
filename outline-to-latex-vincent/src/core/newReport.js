// The files for a new report. The instructions are in a callout, because the
// outline parser reads any list outside one as part of the outline.
const { slugify } = require('./labels');
const { STARTER_TEMPLATE } = require('./template');

const FORBIDDEN_IN_NAME = /[\\/:*?"<>|#^[\]]/;
const STARTER_SECTIONS = ['Introduction', 'Methods', 'Results', 'Conclusion'];

const INSTRUCTIONS = `> [!info] How this works (delete this callout whenever you like)
> This note defines your report. Every list below is the report's structure, and text outside the lists is ignored. Export with the button at the top right of this note, or with the command **Outline to LaTeX: Export report**. You need pandoc and latexmk, plus Inkscape for SVG figures.
>
> **Structure**
> - Indentation sets the level: \`\\section\`, \`\\subsection\`, \`\\subsubsection\`. Move a line to restructure the report.
> - Each note in the list starts with one \`# Title\`. Inside a note only \`##\` is allowed, which becomes \`\\paragraph\`.
> - Click a link below to create its note. A note that doesn't exist yet, or has only a title, callouts and comments, is an unwritten section: the PDF shows a placeholder.
> - A \`## Heading\` in this note starts a part, written to \`generated/<part>.tex\`, which the template places. Abstract, Body and Appendix are set up below. Don't need the abstract or appendix? Delete that heading and its list, and it's gone from the PDF.
> - The abstract note has \`latex-heading: false\`, because the template's abstract already has a title. Notes in the appendix get letters instead of numbers.
>
> **Writing**: type \`@\` in a section to insert a reference. Try \`@eq\`, \`@fig\` or a name.
>
> | You write | In the PDF |
> |---|---|
> | \`[[Note]]\`, \`[[Note#Heading]]\` | "Section 2.1" |
> | \`$$...$$\` with \`^eq-name\` on the next line | a numbered equation |
> | \`[[Note#^eq-name\\|shown in Obsidian]]\` | "Equation (3)" |
> | \`![[file.svg\\|Caption\\|w=0.5]] ^fig-name\` | a numbered figure at half width |
> | \`[[Literature note\\|shown in Obsidian]]\` | a citation |
> | \`[[Literature note#citet\\|shown in Obsidian]]\` | \`\\citet\`, also \`citep\`, \`citeauthor\`, \`citeyear\`, \`cite\` |
> | a \`latex\` code block, \`\\textsc{inline}\` | passed through as is |
> | \`%% comment %%\` | a comment in the \`.tex\`, not in the PDF |
> | a callout, \`~~struck text~~\` | left out |
>
> **Settings**: the properties of this note.
> - \`latex-output\`: where the LaTeX and PDF go. Keep it outside the vault. Relative paths start at the vault root.
> - \`latex-template\`: your LaTeX file, for layout only. Edit it in any editor: exports only copy it and never overwrite it.
> - \`latex-compile\`: also make a PDF.
> - \`latex-literature\`: the folders with your literature notes. They use the properties \`title\`, \`authors\`, \`published\`, \`venue\` and \`bibtype\`, plus \`citekey\` to choose the key yourself.
> - \`latex-drafts\`: exports warn about notes in these folders that aren't in the outline.
> - \`latex-cite-command\`: what a link to a literature note uses without a \`#command\`.
>
> In a section's own properties, \`latex-heading: false\` leaves its title out, and \`latex-numbered: false\` removes its number.`;

// Links resolve across the whole vault, so a taken name would pull in that note.
const noteFor = (section, name, isTaken) => (isTaken(section) ? `${name} ${section.toLowerCase()}` : section);

function listItem(section, name, isTaken) {
	const note = noteFor(section, name, isTaken);
	return note === section ? `- [[${section}]]` : `- [[${note}|${section}]]`;
}

function outlineNote(name, folder, isTaken) {
	const list = (sections) => sections.map((section) => listItem(section, name, isTaken)).join('\n');
	return `---
latex-output: ../${slugify(name)}_latex
latex-template: ${folder}/template/main.tex
latex-compile: true
latex-literature:
latex-drafts: ${folder}/sections
latex-cite-command: citep
---
# ${name}
${INSTRUCTIONS}

## Abstract
${list(['Abstract'])}

## Body
${list(STARTER_SECTIONS)}

## Appendix
${list(['Supplementary material'])}
`;
}

// The abstract has to exist from the start: only a note can carry latex-heading.
const ABSTRACT_NOTE = `---
latex-heading: false
---
# Abstract
> [!todo] Write the abstract
> The title above stays out of the PDF because of the \`latex-heading: false\` property, and the template's abstract environment holds the text.
`;

// `parent` is a vault folder, '' for the root. `isTaken(name)`: does a note with this name exist?
function newReportFiles(name, parent, isTaken = () => false) {
	const folder = parent ? `${parent}/${name}` : name;
	return {
		folder,
		folders: [folder, `${folder}/sections`, `${folder}/template`],
		outlinePath: `${folder}/${name} outline.md`,
		files: [
			[`${folder}/${name} outline.md`, outlineNote(name, folder, isTaken)],
			[`${folder}/template/main.tex`, STARTER_TEMPLATE],
			[`${folder}/sections/${noteFor('Abstract', name, isTaken)}.md`, ABSTRACT_NOTE],
		],
	};
}

function nameProblem(name) {
	if (!name.trim()) return 'Enter a name.';
	if (FORBIDDEN_IN_NAME.test(name)) return 'A name can\'t contain any of \\ / : * ? " < > | # ^ [ ]';
	return null;
}

module.exports = { newReportFiles, nameProblem };
