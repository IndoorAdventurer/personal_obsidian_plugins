const fs = require('fs');
const os = require('os');
const path = require('path');

// Creates a temporary vault from { 'relative/path.md': contents }, with the outline
// frontmatter pointing at an output folder inside the temp dir.
function makeVault(files) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), 'otl-test-'));
	const vault = path.join(root, 'vault');
	for (const [rel, contents] of Object.entries(files)) {
		const full = path.join(vault, rel);
		fs.mkdirSync(path.dirname(full), { recursive: true });
		fs.writeFileSync(full, contents);
	}
	return { vault, out: path.join(root, 'out'), cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

function outline(tree, extraFrontmatter = '') {
	return `---\nlatex-output: ../out\nlatex-literature: lit\n${extraFrontmatter}---\n# Outline\nFree text is ignored.\n\n${tree}\n`;
}

const litNote = (title, author, year, extra = 'venue: Some Venue\nbibtype: article\n') =>
	`---\ntitle: ${title}\nauthors:\n  - ${author}\npublished: ${year}\n${extra}---\n# ${title}\n`;

const messages = (result, level) => result.diagnostics.filter((item) => item.level === level).map((item) => item.message);

module.exports = { makeVault, outline, litNote, messages };
