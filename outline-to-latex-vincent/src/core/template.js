// The LaTeX around the generated text. A template is the user's own LaTeX project;
// only layout lives there. It connects to the build through generated/ files.
const fs = require('fs');
const path = require('path');
const { listFiles } = require('./output');

const GENERATED_HEADER = (source) =>
	`% AUTOMATICALLY GENERATED from: ${source}\n% DO NOT EDIT: changes are overwritten on the next build. Edit the source note instead.\n\n`;

// What the generated text needs. Load it last in the template's preamble, because of hyperref.
const PREAMBLE = `\\usepackage{amsmath,amssymb}
\\usepackage{graphicx}
\\setkeys{Gin}{keepaspectratio}
\\usepackage{longtable,booktabs,array,calc}
\\usepackage[hidelinks]{hyperref}
\\usepackage[capitalise,noabbrev]{cleveref}
\\providecommand{\\tightlist}{\\setlength{\\itemsep}{0pt}\\setlength{\\parskip}{0pt}}
\\providecommand{\\pandocbounded}[1]{#1}
\\providecommand{\\outlineUnwritten}{\\textit{[To be written]}}
`;

const DEFAULT_TEMPLATE = `\\documentclass[a4paper,11pt]{article}
\\usepackage{natbib}
\\input{generated/preamble}

\\begin{document}
\\tableofcontents
\\input{generated/body}
\\bibliographystyle{plainnat}
\\bibliography{generated/references}
\\end{document}
`;

// Where a new report starts from. The optional parts check for their file, so
// deleting one from the outline is enough to remove it.
const STARTER_TEMPLATE = `% Your report's layout. Edit it freely: exports copy this file and never overwrite it.
% The text comes from your notes, through the generated/ files.
\\documentclass[a4paper,11pt]{article}
\\usepackage{natbib}
\\input{generated/preamble}

\\title{Your title}
\\author{Your name}

\\begin{document}
\\maketitle

% The "## Abstract" list in the outline. Delete that list and this disappears.
\\IfFileExists{generated/abstract.tex}{
\\begin{abstract}
\\input{generated/abstract}
\\end{abstract}
}{}

\\tableofcontents
\\newpage

\\input{generated/body}

\\bibliographystyle{plainnat}
\\bibliography{generated/references}

% The "## Appendix" list in the outline. Delete that list and this disappears.
\\IfFileExists{generated/appendix.tex}{
\\appendix
\\input{generated/appendix}
}{}
\\end{document}
`;

// Returns { mainFile, main, files }. The files are copied to the output folder, so
// the template in the vault is never written to: it's yours to edit.
function loadTemplate(vault, templatePath, parts, diagnostics) {
	if (!templatePath) return { mainFile: 'main.tex', main: DEFAULT_TEMPLATE, files: [['main.tex', DEFAULT_TEMPLATE]] };

	const resolved = vault.absolute(templatePath);
	if (!fs.existsSync(resolved)) {
		diagnostics.error(`Template "${templatePath}" doesn't exist.`);
		return { mainFile: 'main.tex', main: '', files: [] };
	}
	const dir = path.dirname(resolved);
	const mainFile = path.basename(resolved);
	const files = listFiles(dir)
		.filter((rel) => !rel.endsWith('.md'))
		.map((rel) => [rel, fs.readFileSync(path.join(dir, rel))]);

	const main = fs.readFileSync(resolved, 'utf8');
	for (const needed of ['preamble', ...parts]) {
		if (!main.includes(`generated/${needed}`)) {
			diagnostics.warn(`Template doesn't \\input{generated/${needed}}, so that part won't appear.`);
		}
	}
	return { mainFile, main, files };
}

module.exports = { loadTemplate, PREAMBLE, GENERATED_HEADER, STARTER_TEMPLATE };
