# Outline to LaTeX
Write a LaTeX report in your notes. An outline note defines the structure, your notes are the only source of the text, and the LaTeX and PDF are compiled from them. You never edit generated LaTeX, so there's no second version to keep in sync.

Needs [pandoc](https://pandoc.org) and a LaTeX distribution with `latexmk`, plus [Inkscape](https://inkscape.org) for SVG figures. Exporting works on desktop only.

The `Outline to LaTeX demo` folder in the test vault shows all of it. Start with its `Demo guide` note, which also has the syntax table.

## Starting a report
Run **Outline to LaTeX: New report**. It creates a folder with an outline note, which explains everything, a `sections` folder with an abstract, and a starter template to edit, set up for an abstract and appendix you can delete from the outline. It never overwrites an existing folder.

## The outline note
Any note with a `latex-output` property is an outline:

```markdown
---
latex-output: ~/somewhere/outside/the/vault   # required; relative paths start at the vault root
latex-template: path/in/vault/main.tex        # optional; without it a minimal one is used
latex-compile: true                           # also make a PDF
latex-literature: path/to/literature          # one or more folders
latex-drafts: path/to/sections                # warns about notes here that aren't in the outline
latex-cite-command: citep                     # what a plain citation link uses; default cite
---
# My report
Free text for yourself.

- [[Introduction]]
	- [[Research questions]]
- [[Methods]]

## Appendix
- [[Proofs]]
```

Indentation sets the level (`\section`, `\subsection`, `\subsubsection`). A `## heading` starts a part, written to `generated/<part>.tex`; lists before the first heading are the part `body`. A link to a note that doesn't exist yet is an unwritten section.

## The template
Your own LaTeX project: layout only. The folder holding the template file is copied to the output folder. It connects to the build through these files:

```latex
\input{generated/preamble}            % last in the preamble, because of hyperref
\input{generated/body}                % one for each part
\bibliography{generated/references}
```

Edit the template freely: the build only reads it and copies it, so it's never overwritten. Don't edit the copy in the output folder, that one is replaced. Without `latex-template` a built-in minimal template is used.

Redefine `\outlineUnwritten` to change what unwritten sections show. To change the packages' options, use for example `\hypersetup{...}` after the preamble, or leave `generated/preamble` out and load everything yourself.

## Citations
A link to a literature note is a citation. The link's fragment chooses the command, and the text after the `|` is only for you: `[[Paper#citet|Lorem (2021)]]` gives `\citet{lorem2021}`. Supported: `cite`, `citep`, `citet`, `citeauthor`, `citeyear`. All but `cite` need `natbib` in the template. A link without a fragment uses `latex-cite-command`. In autocomplete, `@citet-lorem` inserts that form.

## Note properties
- `latex-heading: false`: leave the title out (for an abstract).
- `latex-numbered: false`: no number on the heading (for acknowledgements).

Literature notes: `title`, `authors`, `published`, `venue`, `bibtype` (`article`, `inproceedings`, ...), and optionally `citekey`, `volume`, `number`, `pages`, `publisher`, `edition`, `doi`, `url`. Other property names can be mapped with `latex-literature-fields` in the outline.

## Command line
The pipeline doesn't depend on Obsidian:

```bash
node src/cli.js <vault> "<outline note>" [--final] [--pdf | --no-pdf]
```

## Development
```bash
npm run dev    # rebuild main.js on every change
npm run build  # production build
npm test
```

`src/plugin` is the Obsidian part; everything else is in `src/core`:

| To add | Where |
|---|---|
| Handling of a Markdown construct | A new file in `src/core/rules`, listed in `rules/index.js` |
| A figure format | A converter in `src/core/assets.js` |
| Syntax pandoc can't parse | `src/core/scan.js` and `preprocess.js`, only if a rule can't do it |
| What a link means | `src/core/classify.js`, used by both the build and the editor |
| What labels look like | `src/core/labels.js` |

A rule handles one construct and doesn't know about the others. After changing a rule, the list of changed files from an export shows exactly what it affected.
