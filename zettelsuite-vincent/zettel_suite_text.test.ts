import test from "node:test";
import assert from "node:assert";
import { authorListItem, fillTemplate, noteOfWikiLink, safeFileName, yamlValue } from "./zettel_suite_text.ts";

test("safeFileName removes what Obsidian or links can't handle", () => {
	assert.strictEqual(safeFileName("CuriousRL: Curiosity-Driven RL"), "CuriousRL Curiosity-Driven RL");
	assert.strictEqual(safeFileName("A/B testing? [Now] #1"), "A B testing Now 1");
	assert.strictEqual(safeFileName("Lorem, 2020, Plain title"), "Lorem, 2020, Plain title");
});

test("yamlValue only quotes when it has to", () => {
	assert.strictEqual(yamlValue("A plain title, with a comma"), "A plain title, with a comma");
	assert.strictEqual(yamlValue("CuriousRL: Curiosity"), '"CuriousRL: Curiosity"');
	assert.strictEqual(yamlValue('He said: "go"'), '"He said: \\"go\\""');
	assert.strictEqual(yamlValue("2001"), '"2001"');
	assert.strictEqual(yamlValue("- a dash first"), '"- a dash first"');
});

test("authorListItem handles every shape of name", () => {
	assert.strictEqual(authorListItem("Lorem, Anna"), "\n  - Anna Lorem");
	assert.strictEqual(authorListItem("Plato"), "\n  - Plato");
	assert.strictEqual(authorListItem(" OpenAI "), "\n  - OpenAI");
	assert.strictEqual(authorListItem("King, Martin, Jr."), "\n  - King, Martin, Jr.");
});

test("noteOfWikiLink keeps only the note", () => {
	assert.strictEqual(noteOfWikiLink("Haider"), "Haider");
	assert.strictEqual(noteOfWikiLink("Haider|alias"), "Haider");
	assert.strictEqual(noteOfWikiLink("Haider#Results|x"), "Haider");
	assert.strictEqual(noteOfWikiLink("Haider#^eq-a"), "Haider");
	assert.strictEqual(noteOfWikiLink("#^eq-a"), "");
});

test("fillTemplate quotes frontmatter values only where it should", () => {
	const template = "title: {{title}}\nauthors: {{authors}}\n# {{title}} by {{file_name}}\n{{unknown}}\n";
	const filled = fillTemplate(
		template,
		{ title: "A: B", authors: "\n  - Plato", file_name: "Note" },
		["title"]
	);
	assert.strictEqual(filled, 'title: "A: B"\nauthors: \n  - Plato\n# A: B by Note\n{{unknown}}\n');
});

test("fillTemplate leaves what's in the values alone", () => {
	const filled = fillTemplate("{{bibtex}} {{tags}}", { bibtex: "$& $1 {{tags}}", tags: "x" }, []);
	assert.strictEqual(filled, "$& $1 {{tags}} x");
});

test("fillTemplate keeps a placeholder glued to other text", () => {
	const filled = fillTemplate("  - zettelkasten{{tags}}\ncreated: {{today}}", { tags: "\n  - a", today: "now" }, []);
	assert.strictEqual(filled, "  - zettelkasten\n  - a\ncreated: now");
});
