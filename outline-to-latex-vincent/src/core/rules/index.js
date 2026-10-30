// A rule handles one construct, in its own file. It exports { name, visitors(ctx) },
// where visitors are as described in ../ast.js. To add a feature, add a rule here.
//
// ctx: { note, lookup, literature, assets, diagnostics }
//
// Rules run one after the other over the whole document, so the order matters
// only where noted.
const { walkDocument } = require('../ast');

const rules = [
	require('./callouts'), // first: notes to self may contain anything
	require('./strikeout'),
	require('./comments'),
	require('./rawLatex'),
	require('./headings'),
	require('./figures'),
	require('./equations'),
	require('./links'), // after figures and equations, whose text may contain links
	require('./citations'), // needs the citations made by links
	require('./blockLabels'), // last: labels any ^id the rules above didn't claim
];

function applyRules(doc, ctx) {
	for (const rule of rules) walkDocument(doc, rule.visitors(ctx));
}

module.exports = { applyRules };
