const { execFile } = require('child_process');

// Pandoc's Markdown, adjusted to read like Obsidian's.
const MARKDOWN_FORMAT = [
	'markdown',
	'+wikilinks_title_after_pipe',
	'+lists_without_preceding_blankline',
	'-blank_before_header',
	'-blank_before_blockquote',
	'-superscript',
	'-subscript',
	'-citations',
	'-implicit_figures',
	'-yaml_metadata_block',
].join('');

function run(command, args, input) {
	return new Promise((resolve, reject) => {
		const child = execFile(command, args, { maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
			if (error) {
				const hint = error.code === 'ENOENT' ? `${command} wasn't found` : stderr || error.message;
				reject(new Error(hint));
			} else {
				resolve(stdout);
			}
		});
		child.stdin.on('error', () => {});
		child.stdin.end(input);
	});
}

async function markdownToAst(markdown, tools) {
	return JSON.parse(await run(tools.pandoc, ['-f', MARKDOWN_FORMAT, '-t', 'json'], markdown));
}

function astToLatex(doc, tools) {
	return run(
		tools.pandoc,
		['-f', 'json', '-t', 'latex', '--wrap=none', '--no-highlight', '--top-level-division=section'],
		JSON.stringify(doc),
	);
}

module.exports = { markdownToAst, astToLatex };
