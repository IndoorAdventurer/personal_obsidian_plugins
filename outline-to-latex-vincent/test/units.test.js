const test = require('node:test');
const assert = require('node:assert');
const { scan, isOnlyComments } = require('../src/core/scan');
const { preprocess } = require('../src/core/preprocess');
const { parseOutline } = require('../src/core/outline');
const { classifyLink } = require('../src/core/classify');
const { Diagnostics } = require('../src/core/diagnostics');

const types = (text) => scan(text).map((segment) => segment.type);

test('scan gives back the input unchanged', () => {
	const text = 'a %%b%% c `d` $e$ $$f$$\n```\n%%g%%\n```\n![[h.png|i]] 5$ and 6$';
	assert.strictEqual(scan(text).map((segment) => segment.text).join(''), text);
});

test('scan leaves %% and ![[ alone inside code and math', () => {
	assert.deepStrictEqual(types('`%%a%%`'), ['code']);
	assert.deepStrictEqual(types('$50%%$'), ['math']);
	assert.deepStrictEqual(types('$$\n![[a.png]]\n$$'), ['math']);
	assert.deepStrictEqual(types('```latex\n% %%a%%\n```\n'), ['code']);
});

test('scan finds comments and embeds in text', () => {
	assert.deepStrictEqual(types('x %%a%% y'), ['text', 'comment', 'text']);
	assert.deepStrictEqual(types('![[a.png|cap $x$]]'), ['embed']);
	assert.deepStrictEqual(types('x %%never closed'), ['text', 'comment']);
});

test('scan treats dollar amounts as text', () => {
	assert.deepStrictEqual(types('costs 5$ or 6$ today'), ['text']);
	assert.deepStrictEqual(types('escaped \\$x\\$ %%c%%'), ['text', 'comment']);
});

test('isOnlyComments', () => {
	assert.strictEqual(isOnlyComments('%% a %%\n\n%% b %%\n'), true);
	assert.strictEqual(isOnlyComments('  \n'), true);
	assert.strictEqual(isOnlyComments('%% a %% text'), false);
	assert.strictEqual(isOnlyComments('`%% code %%`'), false);
});

test('preprocess turns embeds into images, with an optional width', () => {
	const diagnostics = new Diagnostics();
	assert.strictEqual(preprocess('![[a b.png|Cap|w=0.5]]', diagnostics), '![Cap](<a b.png>){width=50%}');
	assert.strictEqual(preprocess('![[a.png]]', diagnostics), '![](<a.png>)');
	assert.strictEqual(diagnostics.hasErrors, false);
});

test('preprocess refuses note embeds', () => {
	const diagnostics = new Diagnostics();
	preprocess('![[Some note]]', diagnostics);
	assert.strictEqual(diagnostics.hasErrors, true);
});

function parse(tree) {
	const diagnostics = new Diagnostics();
	const { items } = parseOutline(tree, diagnostics, 'outline.md');
	return { items, errors: diagnostics.items.filter((item) => item.level === 'error').map((item) => item.message) };
}

test('outline: nesting sets depth and headings set parts', () => {
	const { items, errors } = parse('- [[A]]\n\t- [[B]]\n\t\t- [[C]]\n- [[D|Title D]]\n\n## Appendix\n- [[E]] %% a remark %%\n');
	assert.deepStrictEqual(errors, []);
	assert.deepStrictEqual(items.map((item) => [item.name, item.depth, item.part]), [
		['A', 1, 'body'], ['B', 2, 'body'], ['C', 3, 'body'], ['D', 1, 'body'], ['E', 1, 'appendix'],
	]);
	assert.strictEqual(items[3].alias, 'Title D');
});

test('outline: spaces work as well as tabs', () => {
	const { items, errors } = parse('- [[A]]\n    - [[B]]\n        - [[C]]\n    - [[D]]\n');
	assert.deepStrictEqual(errors, []);
	assert.deepStrictEqual(items.map((item) => item.depth), [1, 2, 3, 2]);
});

test('outline: rejects what it should', () => {
	assert.match(parse('- [[A]]\n\t- [[B]]\n\t\t- [[C]]\n\t\t\t- [[D]]\n').errors[0], /depth 4/);
	assert.match(parse('- [[A]]\n- [[A]]\n').errors[0], /twice/);
	assert.match(parse('- plain text\n').errors[0], /single \[\[link\]\]/);
	assert.match(parse('\t- [[A]]\n').errors[0], /no parent/);
	assert.match(parse('- [[A]]\n        - [[B]]\n    - [[C]]\n').errors[0], /line up/);
});

const lookup = {
	resolve: (name) => ({ Note: 'note.md', Lit: 'lit.md', Other: 'other.md', Empty: 'empty.md' }[name] ?? null),
	isLiterature: (key) => key === 'lit.md',
	isInTree: (key) => key === 'note.md' || key === 'empty.md',
	isWritten: (key) => key !== 'empty.md',
	hasBlock: (key, id) => key === 'note.md' && id === 'eq-a',
	hasHeading: (key, heading) => key === 'note.md' && heading === 'Sub',
	titleOf: () => 'Note title',
};
const classify = (target) => classifyLink(target, 'note.md', lookup);

test('classify covers every kind of link', () => {
	assert.strictEqual(classify('Lit').kind, 'cite');
	assert.strictEqual(classify('Note').kind, 'section');
	assert.strictEqual(classify('Note#Note title').kind, 'section');
	assert.strictEqual(classify('Note#Sub').kind, 'heading');
	assert.deepStrictEqual(classify('#^eq-a').blockType, 'equation');
	assert.strictEqual(classify('Note#^nope').kind, 'broken');
	assert.strictEqual(classify('Note#Nope').kind, 'broken');
	assert.strictEqual(classify('Empty#^eq-a').kind, 'pending');
	assert.strictEqual(classify('Other').kind, 'plain');
	assert.strictEqual(classify('Nowhere').kind, 'plain');
});
