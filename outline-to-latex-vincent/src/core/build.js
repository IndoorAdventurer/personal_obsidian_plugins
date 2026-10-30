// The pipeline, start to finish. Nothing here depends on Obsidian, so it runs
// from the command line and in tests as well as in the plugin.
const os = require('os');
const path = require('path');
const { Diagnostics } = require('./diagnostics');
const { VaultIndex } = require('./vault');
const { parseOutline } = require('./outline');
const { Literature } = require('./literature');
const { loadNotes, createLookup } = require('./notes');
const { applyRules } = require('./rules');
const { Assets } = require('./assets');
const { astToLatex } = require('./pandoc');
const { rawBlock } = require('./ast');
const { loadTemplate, PREAMBLE, GENERATED_HEADER } = require('./template');
const { writeOutput } = require('./output');
const { compile } = require('./compile');
const { CITE_COMMANDS } = require('./classify');

const GENERATED_DIR = 'generated';
const DEFAULT_TOOLS = { pandoc: 'pandoc', latexmk: 'latexmk', inkscape: 'inkscape' };

const asList = (value) => (value === undefined || value === null ? [] : Array.isArray(value) ? value : [value]);

function readConfig(frontmatter, vaultPath, diagnostics, outlinePath) {
	const output = frontmatter['latex-output'];
	if (!output) diagnostics.error('The outline note needs a latex-output property.', outlinePath);
	const citeCommand = frontmatter['latex-cite-command'];
	if (citeCommand && !CITE_COMMANDS.includes(String(citeCommand))) {
		diagnostics.error(`latex-cite-command must be one of ${CITE_COMMANDS.join(', ')}.`, outlinePath);
	}
	return {
		outDir: output && path.resolve(vaultPath, String(output).replace(/^~(?=$|\/)/, os.homedir())),
		template: frontmatter['latex-template'],
		compile: frontmatter['latex-compile'] === true,
		literature: asList(frontmatter['latex-literature']).map(String),
		literatureFields: frontmatter['latex-literature-fields'] || {},
		drafts: asList(frontmatter['latex-drafts']).map(String),
		citeCommand: frontmatter['latex-cite-command'] ? String(frontmatter['latex-cite-command']) : 'cite',
	};
}

function warnAboutForgottenNotes(config, notes, vault, outlinePath, diagnostics) {
	const inTree = new Set(notes.map((note) => note.path));
	for (const folder of config.drafts) {
		for (const notePath of vault.notesIn(folder)) {
			if (!inTree.has(notePath) && notePath !== outlinePath) {
				diagnostics.warn("This note is in a drafts folder but isn't in the outline.", notePath);
			}
		}
	}
}

async function renderNote(note, shared) {
	applyRules(note.doc, { ...shared, note });
	if (!note.written) note.doc.blocks.push(rawBlock('\\outlineUnwritten{}'));
	const latex = await astToLatex(note.doc, shared.tools);
	return GENERATED_HEADER(note.path || `nothing yet: "${note.name}" has no note`) + latex;
}

function partFile(part, notes) {
	const inputs = notes.filter((note) => note.part === part).map((note) => `\\input{${GENERATED_DIR}/notes/${note.slug}}`);
	return GENERATED_HEADER('the outline note') + inputs.join('\n') + '\n';
}

/**
 * options: { vaultPath, outlinePath, final, compile, tools, onProgress }
 * `compile` overrides the note's latex-compile property. `final` turns unwritten
 * sections into errors.
 *
 * Returns { ok, diagnostics, changes, stats, pdf, outDir }.
 */
async function build(options) {
	const { vaultPath, outlinePath, final = false, onProgress = () => {} } = options;
	const tools = { ...DEFAULT_TOOLS, ...options.tools };
	const diagnostics = new Diagnostics();
	const result = (extra = {}) => ({
		ok: !diagnostics.hasErrors,
		diagnostics: diagnostics.items,
		changes: { added: [], changed: [], removed: [] },
		stats: null,
		pdf: null,
		outDir: null,
		...extra,
	});

	try {
		const vault = new VaultIndex(path.resolve(vaultPath));
		onProgress('Reading the outline');
		const outline = parseOutline(vault.read(outlinePath), diagnostics, outlinePath);
		const config = readConfig(outline.frontmatter, vaultPath, diagnostics, outlinePath);
		if (!config.outDir) return result();
		if (!outline.items.length) diagnostics.error('The outline has no sections.', outlinePath);

		const literature = new Literature(vault, config, diagnostics);
		onProgress('Reading the notes');
		const notes = await loadNotes(outline.items, vault, tools, diagnostics);
		warnAboutForgottenNotes(config, notes, vault, outlinePath, diagnostics);

		const slugs = new Map();
		for (const note of notes) {
			if (slugs.has(note.slug)) {
				diagnostics.error(`"${note.name}" and "${slugs.get(note.slug)}" would get the same file name. Rename one.`, note.path);
			}
			slugs.set(note.slug, note.name);
		}

		const parts = [...new Set(notes.map((note) => note.part))];
		const template = loadTemplate(vault, config.template, parts, diagnostics);
		const lookup = createLookup(notes, vault, literature);
		const assets = new Assets(vault, path.join(config.outDir, '.cache'), tools, diagnostics);
		const citeCommandsUsed = new Set();
		const shared = { lookup, literature, assets, vault, diagnostics, tools, citeCommand: config.citeCommand, citeCommandsUsed };

		onProgress('Converting to LaTeX');
		const files = [];
		const noteByOutput = new Map();
		for (const note of notes) {
			const output = `${GENERATED_DIR}/notes/${note.slug}.tex`;
			files.push([output, await renderNote(note, shared)]);
			if (note.path) noteByOutput.set(output, note.path);
		}

		const needsNatbib = [...citeCommandsUsed].some((command) => command !== 'cite');
		if (needsNatbib && !/natbib|biblatex/.test(template.main)) {
			diagnostics.warn(`These citation commands need natbib, which the template doesn't load: ${[...citeCommandsUsed].join(', ')}.`, outlinePath);
		}

		const unwritten = notes.filter((note) => !note.written);
		if (final) {
			for (const note of unwritten) diagnostics.error(`"${note.name}" is still unwritten.`, note.path || outlinePath);
		}

		for (const part of parts) files.push([`${GENERATED_DIR}/${part}.tex`, partFile(part, notes)]);
		files.push([`${GENERATED_DIR}/preamble.tex`, GENERATED_HEADER('outline-to-latex') + PREAMBLE]);
		files.push([`${GENERATED_DIR}/references.bib`, literature.toBibtex()]);
		files.push(...(await assets.materialize()));
		files.push(...template.files);

		const stats = { sections: notes.length, unwritten: unwritten.length };
		if (diagnostics.hasErrors) return result({ stats, outDir: config.outDir });

		const changes = writeOutput(config.outDir, files, GENERATED_DIR);

		let pdf = null;
		if (options.compile ?? config.compile) {
			onProgress('Compiling the PDF');
			pdf = await compile(template.mainFile, config.outDir, tools, noteByOutput, diagnostics);
		}
		return result({ changes, stats, pdf, outDir: config.outDir });
	} catch (error) {
		diagnostics.error(error.message);
		return result();
	}
}

module.exports = { build };
