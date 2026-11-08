const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { build } = require('../src/core/build');
const { newReportFiles, nameProblem } = require('../src/core/newReport');
const { makeVault, outline, litNote, messages } = require('./helpers');

const hasCommand = (command) => {
	try {
		execSync(`command -v ${command}`, { stdio: 'ignore', shell: '/bin/bash' });
		return true;
	} catch {
		return false;
	}
};

async function run(files, options = {}) {
	const { vault, out } = makeVault(files);
	const result = await build({ vaultPath: vault, outlinePath: 'outline.md', compile: false, ...options });
	const read = (rel) => fs.readFileSync(path.join(out, rel), 'utf8');
	return { result, read, vault, out };
}

test('the tree alone sets the heading level', async () => {
	const { result, read } = await run({
		'outline.md': outline('- [[A]]\n\t- [[B]]\n\t\t- [[C]]'),
		'A.md': '# Title A\nText.',
		'B.md': '# Title B\nText.\n\n## Run-in\nMore.',
		'C.md': '# Title C\nText.',
	});
	assert.deepStrictEqual(messages(result, 'error'), []);
	assert.match(read('generated/notes/a.tex'), /\\section\{Title A\}/);
	assert.match(read('generated/notes/b.tex'), /\\subsection\{Title B\}/);
	assert.match(read('generated/notes/b.tex'), /\\paragraph\{Run-in\}/);
	assert.match(read('generated/notes/c.tex'), /\\subsubsection\{Title C\}/);
});

test('generated files say so and are included in tree order', async () => {
	const { read } = await run({
		'outline.md': outline('- [[B]]\n- [[A]]'),
		'A.md': '# A\nText.',
		'B.md': '# B\nText.',
	});
	assert.match(read('generated/notes/a.tex'), /^% AUTOMATICALLY GENERATED from: A\.md\n% DO NOT EDIT/);
	const body = read('generated/body.tex');
	assert.ok(body.indexOf('notes/b') < body.indexOf('notes/a'));
});

test('structure errors stop the build before anything is written', async () => {
	const cases = {
		'# One\nText.\n\n# Two\nText.': /exactly one/,
		'Text first.\n\n# Title': /exactly one/,
		'No title.': /exactly one/,
		'# Title\n\n### Too deep\nText.': /too deep/,
	};
	for (const [note, expected] of Object.entries(cases)) {
		const { vault, out, cleanup } = makeVault({ 'outline.md': outline('- [[A]]'), 'A.md': note });
		const result = await build({ vaultPath: vault, outlinePath: 'outline.md', compile: false });
		assert.strictEqual(result.ok, false, note);
		assert.match(messages(result, 'error').join(), expected);
		assert.strictEqual(fs.existsSync(out), false);
		cleanup();
	}
});

test('equations, references across notes and forward references', async () => {
	const { result, read } = await run({
		'outline.md': outline('- [[A]]\n- [[B]]'),
		'A.md': '# A\nSee [[B#^eq-x|Eq]] and [[B#Part|that]] and [[B]].\n\n$$\nx = 1\n$$\n^eq-self\n\nAnd [[#^eq-self|this]].',
		'B.md': '# B\n## Part\n$$\ny = 2\n$$\n^eq-x\n\n$$\nz = 3\n$$\n\n$$\\begin{align}\na &= b\n\\end{align}$$\n^eq-align',
	});
	assert.deepStrictEqual(messages(result, 'error'), []);
	const a = read('generated/notes/a.tex');
	const b = read('generated/notes/b.tex');
	assert.match(a, /\\cref\{b:eq-x\}/);
	assert.match(a, /\\cref\{sec:b:part\}/);
	assert.match(a, /\\cref\{sec:b\}/);
	assert.match(a, /\\cref\{a:eq-self\}/);
	assert.match(b, /\\begin\{equation\}\\label\{b:eq-x\}/);
	assert.match(b, /\\\[\s*z = 3\s*\\\]/);
	assert.match(b, /\\begin\{align\}\\label\{b:eq-align\}/);
	assert.doesNotMatch(b, /\\begin\{equation\}\\label\{b:eq-align\}/);
});

test('an equation in a list item or at the end of a paragraph gets its label', async () => {
	const { read } = await run({
		'outline.md': outline('- [[A]]'),
		'A.md': '# A\n- Item:\n  $$\n  x\n  $$\n  ^eq-list\n\nInline: $$y$$ ^eq-para\n',
	});
	const a = read('generated/notes/a.tex');
	assert.match(a, /\\label\{a:eq-list\}/);
	assert.match(a, /\\label\{a:eq-para\}/);
	assert.doesNotMatch(a, /\^eq-/);
});

test('broken references are errors, unknown notes are warnings', async () => {
	const { result } = await run({
		'outline.md': outline('- [[A]]'),
		'A.md': '# A\n[[#^nope|x]] [[A#Nope|y]] [[Elsewhere|z]]',
	});
	assert.strictEqual(messages(result, 'error').length, 2);
	assert.match(messages(result, 'warning').join(), /Elsewhere/);
});

test('citations come from literature notes and merge', async () => {
	const { result, read } = await run({
		'outline.md': outline('- [[A]]'),
		'A.md': '# A\nOne ([[Paper A|Lorem, 2020]]; [[Paper B|Dolor, 2021]]) and [[ann_a|via annotations]].',
		'lit/Paper A.md': litNote('Title & A', 'Anna Lorem', 2020).replace('venue:', 'annotations: "[[ann_a]]"\nvenue:'),
		'lit/Paper B.md': litNote('Title B', 'Bob Dolor', 2021, 'bibtype: misc\n'),
		'lit/Uncited.md': litNote('Not cited', 'Carl Amet', 2022),
		'ann_a.md': 'Annotations.',
	});
	assert.deepStrictEqual(messages(result, 'error'), []);
	const a = read('generated/notes/a.tex');
	assert.match(a, /One \\cite\{lorem2020,dolor2021\} and \\cite\{lorem2020\}\./);
	const bib = read('generated/references.bib');
	assert.match(bib, /@article\{lorem2020/);
	assert.match(bib, /Title \\& A/);
	assert.doesNotMatch(bib, /amet2022/);
	assert.match(messages(result, 'warning').join(), /no venue/);
});

test('the link fragment or the outline chooses the citation command', async () => {
	const lit = { 'lit/Paper.md': litNote('One', 'Anna Lorem', 2020), 'lit/Other.md': litNote('Two', 'Bob Dolor', 2021) };
	const text = '# A\n[[Paper#citet|x]] and [[Paper#citeauthor|y]] in [[Paper#citeyear|z]], ([[Paper#citep|a]]; [[Other#citep|b]]) [[Other|c]].';
	const { result, read } = await run({ 'outline.md': outline('- [[A]]'), 'A.md': text, ...lit });
	assert.deepStrictEqual(messages(result, 'error'), []);
	assert.match(read('generated/notes/a.tex'), /\\citet\{lorem2020\} and \\citeauthor\{lorem2020\} in \\citeyear\{lorem2020\}, \\citep\{lorem2020,dolor2021\} \\cite\{dolor2021\}\./);

	const withDefault = await run({ 'outline.md': outline('- [[A]]', 'latex-cite-command: citep\n'), 'A.md': '# A\n[[Paper|c]]', ...lit });
	assert.match(withDefault.read('generated/notes/a.tex'), /\\citep\{lorem2020\}/);

	const typo = await run({ 'outline.md': outline('- [[A]]'), 'A.md': '# A\n[[Paper#citex|c]]', ...lit });
	assert.match(messages(typo.result, 'error').join(), /"citex" isn't a citation command/);

	const heading = await run({ 'outline.md': outline('- [[A]]'), 'A.md': '# A\n[[Paper#Results|c]]', ...lit });
	assert.match(heading.read('generated/notes/a.tex'), /\\cite\{lorem2020\}/);

	const badDefault = await run({ 'outline.md': outline('- [[A]]', 'latex-cite-command: nope\n'), 'A.md': '# A\nText.' });
	assert.match(messages(badDefault.result, 'error').join(), /latex-cite-command/);
});

test('a template without natbib gets a warning when natbib commands are used', async () => {
	const { result } = await run({
		'outline.md': outline('- [[A]]', 'latex-template: t/main.tex\n'),
		'A.md': '# A\n[[Paper#citet|x]]',
		'lit/Paper.md': litNote('One', 'Anna Lorem', 2020),
		't/main.tex': '\\input{generated/preamble}\\input{generated/body}',
	});
	assert.match(messages(result, 'warning').join(), /need natbib/);
});

test('the template in the vault is never written to, only copied', async () => {
	const source = '\\documentclass{article}\n\\input{generated/preamble}\n\\begin{document}\n\\input{generated/body}\n\\end{document}\n';
	const { vault, out, cleanup } = makeVault({
		'outline.md': outline('- [[A]]', 'latex-template: t/main.tex\n'),
		'A.md': '# A\nText.',
		't/main.tex': source,
		't/extra.tex': '% mine',
		't/notes.md': 'not copied',
	});
	const options = { vaultPath: vault, outlinePath: 'outline.md', compile: false };
	await build(options);
	assert.strictEqual(fs.readFileSync(path.join(vault, 't/main.tex'), 'utf8'), source);
	assert.strictEqual(fs.readFileSync(path.join(out, 'extra.tex'), 'utf8'), '% mine');
	assert.strictEqual(fs.existsSync(path.join(out, 'notes.md')), false);

	const edited = source.replace('article', 'report');
	fs.writeFileSync(path.join(vault, 't/main.tex'), edited);
	const second = await build(options);
	assert.deepStrictEqual(second.changes.changed, ['main.tex']);
	assert.strictEqual(fs.readFileSync(path.join(vault, 't/main.tex'), 'utf8'), edited);
	assert.strictEqual(fs.readFileSync(path.join(out, 'main.tex'), 'utf8'), edited);
	cleanup();
});

test('annotation files and other notes in the literature folder are not papers', async () => {
	// Sorts before the literature note, so it would overwrite it if treated as a paper.
	const { result, read } = await run({
		'outline.md': outline('- [[A]]'),
		'A.md': '# A\n[[A annotations|x]] and [[Paper|y]]',
		'lit/A annotations.md': 'Annotations.',
		'lit/Paper.md': litNote('Title', 'Anna Lorem', 2020).replace('venue:', 'annotations: "[[A annotations]]"\nvenue:'),
		'lit/Readme.md': 'Just a note, no paper.',
	});
	assert.deepStrictEqual(messages(result, 'error'), []);
	assert.match(read('generated/notes/a.tex'), /\\cite\{lorem2020\} and \\cite\{lorem2020\}|\\cite\{lorem2020,lorem2020\}/);
	assert.doesNotMatch(read('generated/references.bib'), /unknown/);
});

test('an empty property on a literature note stays out of the bibliography', async () => {
	const { read } = await run({
		'outline.md': outline('- [[A]]'),
		'A.md': '# A\n[[Paper|x]]',
		'lit/Paper.md': litNote('One', 'Anna Lorem', 2020, 'venue: V\nbibtype: article\nvolume:\ndoi:\n'),
	});
	assert.doesNotMatch(read('generated/references.bib'), /null/);
});

test('two notes with the same citation key are an error once cited', async () => {
	const { result } = await run({
		'outline.md': outline('- [[A]]'),
		'A.md': '# A\n[[Paper A|x]]',
		'lit/Paper A.md': litNote('One', 'Anna Lorem', 2020),
		'lit/Paper B.md': litNote('Two', 'Anna Lorem', 2020),
	});
	assert.match(messages(result, 'error').join(), /lorem2020/);
});

const bibBlock = (entry, lang = 'BibTex') => `## Resources\n### BibTex\n\`\`\`${lang}\n${entry}\n\`\`\`\n`;
const prashant = '@InProceedings{prashant2025guaranteeing,\n  title={Guaranteeing {OOD} Detection},\n  author={Prashant, Mohit and Das, Suman},\n  booktitle={Proceedings of the AAAI Conference},\n  pages={12452--12460},\n  year={2025}\n}';

test('a bibtex block in a literature note is the entry, verbatim and with its key', async () => {
	const { result, read } = await run({
		'outline.md': outline('- [[A]]'),
		'A.md': '# A\n[[Paper|x]] and [[Bare|y]]',
		'lit/Paper.md': litNote('Other title', 'Mohit Prashant', 2025, 'citekey: ignored\n') + bibBlock(prashant),
		'lit/Bare.md': `# Bare\n${bibBlock('@book{bare1999, title={Bare}, year={1999}}', 'bibtex')}`,
	});
	assert.deepStrictEqual(messages(result, 'error'), []);
	assert.deepStrictEqual(messages(result, 'warning'), []);
	assert.match(read('generated/notes/a.tex'), /\\cite\{prashant2025guaranteeing\} and \\cite\{bare1999\}/);
	const bib = read('generated/references.bib');
	assert.ok(bib.includes(`${prashant}\n`));
	assert.ok(bib.includes('@book{bare1999, title={Bare}, year={1999}}'));
	assert.doesNotMatch(bib, /ignored|@misc/);
});

test('a literature note without a bibtex block falls back to its properties with a warning', async () => {
	const { result, read } = await run({
		'outline.md': outline('- [[A]]'),
		'A.md': '# A\n[[Paper|x]] [[Mislabeled|y]]',
		'lit/Paper.md': litNote('One', 'Anna Lorem', 2020),
		'lit/Mislabeled.md': litNote('Two', 'Bob Dolor', 2021) + bibBlock('@article{dolor2021two,\n  title={Two}\n}', 'bib'),
	});
	assert.deepStrictEqual(messages(result, 'error'), []);
	const warnings = messages(result, 'warning');
	assert.strictEqual(warnings.filter((w) => /no bibtex block/.test(w)).length, 2);
	assert.match(warnings.join(), /marked "bib" looks like BibTeX/);
	assert.match(read('generated/references.bib'), /@article\{dolor2021,[\s\S]*@article\{lorem2020,/);
});

test('several or malformed bibtex blocks are an error once cited', async () => {
	const { result } = await run({
		'outline.md': outline('- [[A]]'),
		'A.md': '# A\n[[Two blocks|x]] [[Broken|y]] [[Two entries|z]]',
		'lit/Two blocks.md': litNote('One', 'Anna Lorem', 2020) + bibBlock(prashant) + bibBlock(prashant),
		'lit/Broken.md': litNote('Two', 'Bob Dolor', 2021) + bibBlock('title={Two}'),
		'lit/Two entries.md': litNote('Three', 'Carl Amet', 2022) + bibBlock(`${prashant}\n@misc{x2000, title={X}}`),
		'lit/Uncited.md': litNote('Four', 'Dan Elit', 2023) + bibBlock('nonsense'),
	});
	const errors = messages(result, 'error');
	assert.strictEqual(errors.length, 3);
	assert.match(errors.join(), /2 bibtex blocks/);
	assert.match(errors.join(), /isn't one @type\{key, \.\.\.\} entry/);
	assert.match(errors.join(), /several entries/);
	assert.strictEqual(result.ok, false);
});

test('two bibtex blocks with the same key are an error once cited', async () => {
	const { result } = await run({
		'outline.md': outline('- [[A]]'),
		'A.md': '# A\n[[Paper A|x]]',
		'lit/Paper A.md': litNote('One', 'Anna Lorem', 2020) + bibBlock(prashant),
		'lit/Paper B.md': litNote('Two', 'Bob Dolor', 2021) + bibBlock(prashant),
	});
	assert.match(messages(result, 'error').join(), /prashant2025guaranteeing/);
});

test('unwritten sections get a placeholder and fail a final build', async () => {
	const files = {
		'outline.md': outline('- [[A]]\n- [[Checklist only]]\n- [[Not created|Nice title]]'),
		'A.md': '# A\nSee [[Not created]] and [[Checklist only#^eq-later|later]].',
		'Checklist only.md': '# Checklist only\n> [!todo] Write this\n> - [ ] a\n\n%% remark %%\n',
	};
	const { result, read } = await run(files);
	assert.strictEqual(result.ok, true);
	assert.deepStrictEqual(result.stats, { sections: 3, unwritten: 2 });
	assert.match(read('generated/notes/checklist-only.tex'), /\\outlineUnwritten/);
	assert.doesNotMatch(read('generated/notes/checklist-only.tex'), /Write this/);
	assert.match(read('generated/notes/not-created.tex'), /\\section\{Nice title\}/);
	assert.match(read('generated/notes/a.tex'), /\\cref\{sec:not-created\}/);
	assert.match(messages(result, 'warning').join(), /still unwritten/);

	const final = await run(files, { final: true });
	assert.strictEqual(final.result.ok, false);
	assert.strictEqual(messages(final.result, 'error').length, 2);
});

test('notes to self stay out of the PDF, comments go to the .tex', async () => {
	const { read } = await run({
		'outline.md': outline('- [[A]]'),
		'A.md': '# A %%in heading%%\n> [!todo] callout text\n\nKept ~~struck~~ here %%inline note%% and on.\n\n%%\nblock\ncomment\n%%\n\n> A real quote.\n\n```latex\n% keep %%this%% as is\n\\raw{}\n```\n',
	});
	const a = read('generated/notes/a.tex');
	assert.doesNotMatch(a, /callout text|struck|in heading/);
	assert.match(a, /% inline note\n/);
	assert.match(a, /% block\n% comment/);
	assert.match(a, /A real quote/);
	assert.match(a, /% keep %%this%% as is\n\\raw\{\}/);
});

test('a latex block with an id keeps its label project-wide', async () => {
	const { result } = await run({
		'outline.md': outline('- [[A]]'),
		'A.md': '# A\n[[#^fig-x|x]]\n\n```latex\n\\caption{c}\\label{fig-x}\n```\n^fig-x\n\n```latex\nno label here\n```\n^fig-y\n',
	});
	assert.match(messages(result, 'error').join(), /fig-y/);
});

test('figures: copied, labelled, captioned, width, and citations in captions', async () => {
	const { result, out } = await run({
		'outline.md': outline('- [[A]]'),
		'A.md': '# A\n![[some pic.png|Caption with $x$.|w=0.5]] ^fig-a\n\nSee [[#^fig-a|it]]. ![[some pic.png]]\n',
		'attachments/some pic.png': 'not really a png',
	});
	assert.match(messages(result, 'error').join(), /alone on its line/);
	assert.strictEqual(fs.existsSync(path.join(out, 'generated')), false);

	const ok = await run({
		'outline.md': outline('- [[A]]'),
		'A.md': '# A\n![[some pic.png|Caption with $x$.|w=0.5]] ^fig-a\n\nSee [[#^fig-a|it]].\n',
		'attachments/some pic.png': 'not really a png',
	});
	assert.deepStrictEqual(messages(ok.result, 'error'), []);
	const a = ok.read('generated/notes/a.tex');
	assert.match(a, /\\includegraphics\[width=0\.5\\(text|line)width[^\]]*\]\{generated\/figures\/some-pic\.png\}/);
	assert.match(a, /\\caption\{Caption with \\\(x\\\)\.\}/);
	assert.match(a, /\\label\{a:fig-a\}/);
	assert.match(ok.read('generated/preamble.tex'), /keepaspectratio/);
	assert.ok(fs.existsSync(path.join(ok.out, 'generated/figures/some-pic.png')));
});

test('a missing image is an error', async () => {
	const { result } = await run({ 'outline.md': outline('- [[A]]'), 'A.md': '# A\n![[gone.png]]\n' });
	assert.match(messages(result, 'error').join(), /gone\.png/);
});

test('the report lists exactly what changed since the last build', async () => {
	const { vault, cleanup } = makeVault({
		'outline.md': outline('- [[A]]\n- [[B]]'),
		'A.md': '# A\nOne.',
		'B.md': '# B\nTwo.',
	});
	const options = { vaultPath: vault, outlinePath: 'outline.md', compile: false };

	const first = await build(options);
	assert.ok(first.changes.added.includes('generated/notes/a.tex'));

	const second = await build(options);
	assert.deepStrictEqual(second.changes, { added: [], changed: [], removed: [] });

	fs.writeFileSync(path.join(vault, 'A.md'), '# A\nChanged.');
	const third = await build(options);
	assert.deepStrictEqual(third.changes, { added: [], changed: ['generated/notes/a.tex'], removed: [] });

	fs.writeFileSync(path.join(vault, 'outline.md'), outline('- [[A]]'));
	const fourth = await build(options);
	assert.deepStrictEqual(fourth.changes, { added: [], changed: ['generated/body.tex'], removed: ['generated/notes/b.tex'] });
	cleanup();
});

test('a note in a drafts folder but not in the tree gets a warning', async () => {
	const { result } = await run({
		'outline.md': outline('- [[A]]', 'latex-drafts: drafts\n'),
		'drafts/A.md': '# A\nText.',
		'drafts/Forgotten.md': '# Forgotten\nText.',
	});
	const warning = result.diagnostics.find((item) => /isn't in the outline/.test(item.message));
	assert.strictEqual(warning.note, 'drafts/Forgotten.md');
});

test('changing the bibliography style in the template still compiles', { skip: !hasCommand('latexmk') }, async () => {
	const template = (extra, style) => `\\documentclass{article}\n${extra}\n\\input{generated/preamble}\n\\begin{document}\n\\input{generated/body}\n\\bibliographystyle{${style}}\n\\bibliography{generated/references}\n\\end{document}\n`;
	const { vault, cleanup } = makeVault({
		'outline.md': outline('- [[A]]', 'latex-template: t/main.tex\n'),
		'A.md': '# A\nSee [[Paper|a]].',
		'lit/Paper.md': litNote('One', 'Anna Lorem', 2020),
		't/main.tex': template('', 'plain'),
	});
	const options = { vaultPath: vault, outlinePath: 'outline.md', compile: true };
	const first = await build(options);
	assert.deepStrictEqual(messages(first, 'error'), []);

	fs.writeFileSync(path.join(vault, 't/main.tex'), template('\\usepackage{natbib}', 'plainnat'));
	const second = await build(options);
	assert.deepStrictEqual(messages(second, 'error'), []);
	assert.ok(second.pdf && fs.existsSync(second.pdf));
	cleanup();
});

test('a real LaTeX error is reported against its note', { skip: !hasCommand('latexmk') }, async () => {
	const { result } = await run({
		'outline.md': outline('- [[A]]'),
		'A.md': '# A\nThis command \\doesnotexist{} is wrong.',
	}, { compile: true });
	const error = result.diagnostics.find((item) => item.level === 'error');
	assert.match(error.message, /Undefined control sequence/);
	assert.strictEqual(error.note, 'A.md');
	assert.strictEqual(result.pdf, null);
});

test('a new report builds straight away, and its instructions are not read as outline', { skip: !hasCommand('latexmk') }, async () => {
	const report = newReportFiles('My report', 'Projects');
	const { vault, cleanup } = makeVault(Object.fromEntries(report.files));
	const result = await build({ vaultPath: vault, outlinePath: report.outlinePath });
	assert.deepStrictEqual(result.diagnostics.filter((item) => item.level !== 'warning'), []);
	assert.deepStrictEqual(result.stats, { sections: 6, unwritten: 6 });
	assert.ok(result.pdf && fs.existsSync(result.pdf));
	const abstract = fs.readFileSync(path.join(result.outDir, 'generated/notes/abstract.tex'), 'utf8');
	assert.doesNotMatch(abstract, /\\section/);
	assert.match(fs.readFileSync(path.join(result.outDir, 'generated/notes/supplementary-material.tex'), 'utf8'), /\\section\{Supplementary material\}/);
	fs.rmSync(path.dirname(result.outDir), { recursive: true, force: true });
	cleanup();
});

test('deleting the abstract and appendix from a new report\'s outline just works', { skip: !hasCommand('latexmk') }, async () => {
	const report = newReportFiles('My report', '');
	const { vault, cleanup } = makeVault(Object.fromEntries(report.files));
	const options = { vaultPath: vault, outlinePath: report.outlinePath };
	const first = await build(options);
	assert.deepStrictEqual(messages(first, 'error'), []);

	const outlinePath = path.join(vault, report.outlinePath);
	const trimmed = fs.readFileSync(outlinePath, 'utf8').replace(/## Abstract\n.*\n\n/, '').replace(/\n## Appendix\n.*\n/, '\n');
	fs.writeFileSync(outlinePath, trimmed);
	const second = await build(options);
	assert.deepStrictEqual(messages(second, 'error'), []);
	assert.deepStrictEqual(second.stats, { sections: 4, unwritten: 4 });
	assert.ok(second.pdf && fs.existsSync(second.pdf));
	assert.ok(second.changes.removed.includes('generated/appendix.tex'));
	fs.rmSync(path.dirname(second.outDir), { recursive: true, force: true });
	cleanup();
});

test('a new report avoids section names that exist in the vault', () => {
	const report = newReportFiles('Thesis', '', (name) => name === 'Methods');
	const outlineText = report.files[0][1];
	assert.match(outlineText, /- \[\[Thesis methods\|Methods\]\]/);
	assert.match(outlineText, /- \[\[Introduction\]\]/);
	assert.match(outlineText, /latex-drafts: Thesis\/sections/);
});

test('report names that would break links are refused', () => {
	assert.strictEqual(nameProblem('My report'), null);
	assert.ok(nameProblem('  '));
	assert.ok(nameProblem('a/b'));
	assert.ok(nameProblem('a#b'));
});

test('the built-in template compiles, with and without citations', { skip: !hasCommand('latexmk') }, async () => {
	for (const text of ['Plain text.', 'With [[Paper A|a]].']) {
		const { result } = await run({
			'outline.md': outline('- [[A]]'),
			'A.md': `# A\n${text}`,
			'lit/Paper A.md': litNote('One', 'Anna Lorem', 2020),
		}, { compile: true });
		assert.deepStrictEqual(messages(result, 'error'), []);
		assert.ok(result.pdf && fs.existsSync(result.pdf));
	}
});
