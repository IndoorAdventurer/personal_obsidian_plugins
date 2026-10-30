// Callouts are notes to self and never reach the PDF. Plain quotes do.
function isCallout(block) {
	if (block.t !== 'BlockQuote') return false;
	const first = block.c[0];
	if (!first || (first.t !== 'Para' && first.t !== 'Plain')) return false;
	const start = first.c[0];
	return start !== undefined && start.t === 'Str' && start.c.startsWith('[!');
}

module.exports = {
	name: 'callouts',
	isCallout,
	visitors: () => ({
		BlockQuote: (block) => (isCallout(block) ? null : undefined),
	}),
};
