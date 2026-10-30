#!/usr/bin/env node
const { build } = require('./core/build');

const USAGE = `Usage: outline-to-latex <vault> <outline note> [--final] [--pdf | --no-pdf]

  --final    fail if any section is still unwritten
  --pdf      compile a PDF, whatever the note's latex-compile says
  --no-pdf   only generate the LaTeX`;

function printList(title, items) {
	if (items.length) console.log(`${title}:\n${items.map((item) => `  ${item}`).join('\n')}`);
}

async function main() {
	const args = process.argv.slice(2);
	const flags = args.filter((arg) => arg.startsWith('--'));
	const [vaultPath, outlinePath] = args.filter((arg) => !arg.startsWith('--'));
	if (!vaultPath || !outlinePath || flags.includes('--help')) {
		console.log(USAGE);
		process.exit(vaultPath ? 0 : 2);
	}

	const compile = flags.includes('--pdf') ? true : flags.includes('--no-pdf') ? false : undefined;
	const result = await build({ vaultPath, outlinePath, final: flags.includes('--final'), compile });

	for (const { level, message, note } of result.diagnostics) {
		console.log(`${level}: ${message}${note ? `  [${note}]` : ''}`);
	}
	const { added, changed, removed } = result.changes;
	printList('Added', added);
	printList('Changed', changed);
	printList('Removed', removed);
	if (result.ok && !added.length && !changed.length && !removed.length) console.log('No files changed.');
	if (result.stats) console.log(`${result.stats.sections} sections, ${result.stats.unwritten} unwritten.`);
	if (result.pdf) console.log(`PDF: ${result.pdf}`);
	process.exit(result.ok ? 0 : 1);
}

main();
