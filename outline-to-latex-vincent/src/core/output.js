// Writes the build output and reports what actually changed compared to the
// previous build. Untouched files keep their timestamps, so latexmk skips them.
const fs = require('fs');
const path = require('path');

function listFiles(dir, root = dir) {
	if (!fs.existsSync(dir)) return [];
	return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) return listFiles(full, root);
		return [path.relative(root, full).split(path.sep).join('/')];
	});
}

// `files`: [relative path, string or Buffer]. Files under `managedDir` that are
// no longer produced get removed; anything else in the output folder is left alone.
function writeOutput(outDir, files, managedDir) {
	const changes = { added: [], changed: [], removed: [] };
	const wanted = new Set(files.map(([rel]) => rel));

	for (const [rel, contents] of files) {
		const full = path.join(outDir, rel);
		const data = Buffer.from(contents);
		if (!fs.existsSync(full)) changes.added.push(rel);
		else if (!fs.readFileSync(full).equals(data)) changes.changed.push(rel);
		else continue;
		fs.mkdirSync(path.dirname(full), { recursive: true });
		fs.writeFileSync(full, data);
	}

	for (const rel of listFiles(path.join(outDir, managedDir))) {
		const relative = `${managedDir}/${rel}`;
		if (!wanted.has(relative)) {
			fs.rmSync(path.join(outDir, relative));
			changes.removed.push(relative);
		}
	}
	return changes;
}

module.exports = { writeOutput, listFiles };
