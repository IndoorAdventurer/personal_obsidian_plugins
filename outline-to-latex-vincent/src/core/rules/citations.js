// Tidies what authors write around citations: "([[a]]; [[b]])" becomes \cite{a,b},
// without the parentheses, because the bibliography style or command decides how a
// citation looks. Only for commands that stand alone: \citet and \citeauthor are
// part of a sentence, so they're left as written.
const { rawInline, str } = require('../ast');

const CITE = /^\\(cite|citep)\{(.*)\}$/;
const parseCite = (node) => (node && node.t === 'RawInline' && CITE.exec(node.c[1])) || null;
const isSeparator = (node) => node && node.t === 'Str' && (node.c === ';' || node.c === ',');

function mergeAdjacent(list) {
	const out = [];
	for (let i = 0; i < list.length; i += 1) {
		const current = parseCite(list[i]);
		const previous = parseCite(out[out.length - 1]);
		if (current && previous && current[1] === previous[1]) {
			out[out.length - 1] = rawInline(`\\${current[1]}{${previous[2]},${current[2]}}`);
		} else if (previous && isSeparator(list[i]) && list[i + 1]?.t === 'Space' && parseCite(list[i + 2])?.[1] === previous[1]) {
			i += 1; // drop the separator and its space
		} else {
			out.push(list[i]);
		}
	}
	return out;
}

function dropParentheses(list) {
	const out = [...list];
	for (let i = out.length - 2; i > 0; i -= 1) {
		const before = out[i - 1];
		const after = out[i + 1];
		if (parseCite(out[i]) && before.t === 'Str' && before.c.endsWith('(') && after.t === 'Str' && after.c.startsWith(')')) {
			out[i + 1] = str(after.c.slice(1));
			out[i - 1] = str(before.c.slice(0, -1));
		}
	}
	return out.filter((node) => !(node.t === 'Str' && node.c === ''));
}

module.exports = {
	name: 'citations',
	visitors: () => ({
		List(list) {
			if (!list.some((node) => parseCite(node))) return list;
			return dropParentheses(mergeAdjacent(list));
		},
	}),
};
