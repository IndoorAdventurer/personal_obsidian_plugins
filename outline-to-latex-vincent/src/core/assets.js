// Figure files. Rules ask for a file and get back the path LaTeX should use; the
// files are copied or converted after the rules are done.
//
// To support another format, add a converter for its extension. Converted files
// are cached and only redone when the source changes.
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { slugify } = require('./labels');

const FIGURE_DIR = 'generated/figures';

const converters = {
	'.svg': {
		outputExtension: '.pdf',
		convert: (source, target, tools) =>
			new Promise((resolve, reject) => {
				execFile(tools.inkscape, [source, `--export-filename=${target}`], (error) => {
					if (!error) resolve();
					else reject(new Error(error.code === 'ENOENT' ? `${tools.inkscape} wasn't found (needed for SVG figures)` : error.message));
				});
			}),
	},
};

class Assets {
	constructor(vault, cacheDir, tools, diagnostics) {
		this.vault = vault;
		this.cacheDir = cacheDir;
		this.tools = tools;
		this.diagnostics = diagnostics;
		this.requested = new Map(); // vault path -> output path
		this.taken = new Set();
	}

	request(vaultPath) {
		if (this.requested.has(vaultPath)) return this.requested.get(vaultPath);
		const extension = path.extname(vaultPath).toLowerCase();
		const outputExtension = converters[extension]?.outputExtension || extension;
		const base = slugify(path.basename(vaultPath, path.extname(vaultPath)));

		let name = base;
		for (let n = 2; this.taken.has(name + outputExtension); n += 1) name = `${base}-${n}`;
		this.taken.add(name + outputExtension);

		const output = `${FIGURE_DIR}/${name}${outputExtension}`;
		this.requested.set(vaultPath, output);
		return output;
	}

	// Returns [output path, contents] for every requested file.
	async materialize() {
		const files = [];
		for (const [vaultPath, output] of this.requested) {
			const source = this.vault.absolute(vaultPath);
			const converter = converters[path.extname(vaultPath).toLowerCase()];
			try {
				const file = converter ? await this.#converted(source, output, converter) : source;
				files.push([output, fs.readFileSync(file)]);
			} catch (error) {
				this.diagnostics.error(`Couldn't convert "${vaultPath}": ${error.message}`, vaultPath);
			}
		}
		return files;
	}

	async #converted(source, output, converter) {
		const cached = path.join(this.cacheDir, path.basename(output));
		const fresh = fs.existsSync(cached) && fs.statSync(cached).mtimeMs >= fs.statSync(source).mtimeMs;
		if (!fresh) {
			fs.mkdirSync(this.cacheDir, { recursive: true });
			await converter.convert(source, cached, this.tools);
		}
		return cached;
	}
}

module.exports = { Assets };
