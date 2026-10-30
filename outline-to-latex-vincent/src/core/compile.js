// Runs latexmk and turns the log into diagnostics that point at the source note.
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

function runLatexmk(mainFile, outDir, tools) {
	return new Promise((resolve) => {
		execFile(
			tools.latexmk,
			['-pdf', '-interaction=nonstopmode', '-halt-on-error', '-file-line-error', mainFile],
			{ cwd: outDir, env: { ...process.env, max_print_line: '1000' }, maxBuffer: 64 * 1024 * 1024 },
			(error) => resolve(error),
		);
	});
}

// What LaTeX keeps between runs. It can break a later run, for example after a
// template change, and latexmk then stops before it gets to regenerate it.
const LEFTOVER_EXTENSIONS = ['.aux', '.bbl', '.blg', '.fdb_latexmk', '.fls', '.out', '.toc'];

function removeLeftovers(stem, outDir) {
	for (const extension of LEFTOVER_EXTENSIONS) fs.rmSync(path.join(outDir, stem + extension), { force: true });
}

function noteFromFile(file, noteByOutput) {
	const clean = file.replace(/^\.\//, '');
	return noteByOutput.get(clean);
}

function reportLog(logPath, noteByOutput, diagnostics) {
	if (!fs.existsSync(logPath)) return;
	const log = fs.readFileSync(logPath, 'latin1');

	for (const match of log.matchAll(/^(\S+\.tex):(\d+): (.*)$/gm)) {
		const note = noteFromFile(match[1], noteByOutput);
		diagnostics.error(`LaTeX: ${match[3]} (${match[1]}, line ${match[2]})`, note);
	}
	const undefinedItems = new Set();
	for (const match of log.matchAll(/(Reference|Citation) [`']([^']+)' on page \d+ undefined/g)) {
		undefinedItems.add(`${match[1]} ${match[2]}`);
	}
	for (const item of undefinedItems) diagnostics.warn(`LaTeX: undefined ${item}.`);
}

async function compile(mainFile, outDir, tools, noteByOutput, diagnostics) {
	const stem = path.basename(mainFile, '.tex');
	let error = await runLatexmk(mainFile, outDir, tools);
	if (error && error.code === 'ENOENT') {
		diagnostics.error(`${tools.latexmk} wasn't found, so no PDF was made.`);
		return null;
	}
	if (error) {
		removeLeftovers(stem, outDir);
		error = await runLatexmk(mainFile, outDir, tools);
	}
	const before = diagnostics.items.length;
	reportLog(path.join(outDir, `${stem}.log`), noteByOutput, diagnostics);
	if (error) {
		const found = diagnostics.items.slice(before).some((item) => item.level === 'error');
		if (!found) diagnostics.error(`LaTeX failed, see ${stem}.log in the output folder.`);
		return null;
	}
	return path.join(outDir, `${stem}.pdf`);
}

module.exports = { compile };
