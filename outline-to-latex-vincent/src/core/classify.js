// Decides what a [[link]] means. The build and the editor both use this, so what
// you see while writing matches what ends up in the PDF.
//
// `lookup` answers questions about the project:
//   resolve(linkpath, fromKey) -> key, or null when there's no such note
//   isLiterature(key), isInTree(key), isWritten(key)
//   hasBlock(key, id), hasHeading(key, heading), titleOf(key)
const CITE_COMMANDS = ['cite', 'citep', 'citet', 'citeauthor', 'citeyear'];

function classifyLink(target, fromKey, lookup) {
	const hash = target.indexOf('#');
	const linkpath = hash === -1 ? target : target.slice(0, hash);
	const fragment = hash === -1 ? '' : target.slice(hash + 1).split('#').pop().trim();
	const key = linkpath.trim() ? lookup.resolve(linkpath, fromKey) : fromKey;

	if (key === null) return { kind: 'plain', reason: `"${linkpath}" doesn't exist` };
	if (lookup.isLiterature(key)) {
		// The fragment can choose the citation command: [[Paper#citet|Lorem (2021)]].
		if (CITE_COMMANDS.includes(fragment)) return { kind: 'cite', key, command: fragment };
		if (/^cite/.test(fragment)) return { kind: 'broken', key, reason: `"${fragment}" isn't a citation command (${CITE_COMMANDS.join(', ')})` };
		return { kind: 'cite', key };
	}
	if (!lookup.isInTree(key)) return { kind: 'plain', key, reason: `"${linkpath || key}" isn't in the outline` };
	if (!fragment) return { kind: 'section', key };

	if (fragment.startsWith('^')) {
		const id = fragment.slice(1);
		if (lookup.hasBlock(key, id)) return { kind: 'block', key, id, blockType: blockType(id) };
		if (!lookup.isWritten(key)) return { kind: 'pending', key, reason: `block ^${id} is in a section that's still unwritten` };
		return { kind: 'broken', key, reason: `block ^${id} doesn't exist in "${linkpath || key}"` };
	}

	if (lookup.hasHeading(key, fragment)) return { kind: 'heading', key, heading: fragment };
	if (normalize(lookup.titleOf(key)) === normalize(fragment)) return { kind: 'section', key };
	if (!lookup.isWritten(key)) return { kind: 'pending', key, reason: `heading "${fragment}" is in a section that's still unwritten` };
	return { kind: 'broken', key, reason: `heading "${fragment}" doesn't exist in "${linkpath || key}"` };
}

function blockType(id) {
	if (id.startsWith('eq-')) return 'equation';
	if (id.startsWith('fig-')) return 'figure';
	if (id.startsWith('tab-')) return 'table';
	return 'block';
}

const normalize = (text) => String(text || '').trim().toLowerCase();

module.exports = { classifyLink, normalizeHeading: normalize, CITE_COMMANDS };
