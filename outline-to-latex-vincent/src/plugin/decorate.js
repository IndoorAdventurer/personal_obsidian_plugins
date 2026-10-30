const { editorInfoField } = require('obsidian');
const { RangeSetBuilder, StateEffect } = require('@codemirror/state');
const { Decoration, ViewPlugin } = require('@codemirror/view');

const LINK = /(!?)\[\[([^[\]|]+)(?:\|[^[\]]*)?\]\]/g;

// Asks open editors to redraw, for when something changed in another note.
const refreshEffect = StateEffect.define();

function classOf(result) {
	switch (result.kind) {
		case 'cite': return 'otl-ref otl-ref-citation';
		case 'section':
		case 'heading': return 'otl-ref otl-ref-section';
		case 'block': return `otl-ref otl-ref-${result.blockType}`;
		case 'broken': return 'otl-ref otl-ref-broken';
		case 'pending': return 'otl-ref otl-ref-pending';
		default: return null;
	}
}

function buildDecorations(view, projects) {
	const builder = new RangeSetBuilder();
	const file = view.state.field(editorInfoField, false)?.file;
	const project = file && projects.forFile(file);
	if (!project) return builder.finish();

	for (const { from, to } of view.visibleRanges) {
		const text = view.state.doc.sliceString(from, to);
		for (const match of text.matchAll(LINK)) {
			if (match[1]) continue;
			const result = project.classify(match[2], file.path);
			const cls = classOf(result);
			if (!cls) continue;
			const start = from + match.index;
			const attributes = { spellcheck: 'false', ...(result.reason ? { title: result.reason } : {}) };
			builder.add(start, start + match[0].length, Decoration.mark({ class: cls, attributes }));
		}
	}
	return builder.finish();
}

function referenceDecorations(projects) {
	return ViewPlugin.fromClass(
		class {
			constructor(view) {
				this.decorations = buildDecorations(view, projects);
			}

			update(update) {
				const refreshed = update.transactions.some((transaction) => transaction.effects.some((effect) => effect.is(refreshEffect)));
				if (update.docChanged || update.viewportChanged || refreshed) {
					this.decorations = buildDecorations(update.view, projects);
				}
			}
		},
		{ decorations: (plugin) => plugin.decorations },
	);
}

function decorateReadingView(el, ctx, projects) {
	const file = ctx.sourcePath && { path: ctx.sourcePath };
	const project = file && projects.forFile(file);
	if (!project) return;
	for (const link of el.querySelectorAll('a.internal-link')) {
		const target = link.getAttribute('data-href');
		if (!target) continue;
		const result = project.classify(target, ctx.sourcePath);
		const cls = classOf(result);
		if (cls) link.classList.add(...cls.split(' '));
		if (result.reason) link.setAttribute('title', result.reason);
	}
}

module.exports = { referenceDecorations, refreshEffect, decorateReadingView };
