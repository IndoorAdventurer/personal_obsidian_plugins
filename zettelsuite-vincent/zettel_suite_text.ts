/**
 * Turning user input into file names, frontmatter and links. No Obsidian in
 * here, so it can be tested on its own (npm test).
 */

/**
 * Removes what can't be in a file name or breaks a link to it. Titles of papers
 * regularly contain these, especially colons.
 */
export function safeFileName(name: string): string {
	return name
		.replace(/[\\/:|#^[\]*"<>?]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * Makes a string safe as a single frontmatter value, only quoting if needed.
 */
export function yamlValue(value: string): string {
	const needs_quotes =
		/:|#/.test(value) ||
		/^["'[\]{}&*!|>%@`\-?,\s]/.test(value) ||
		/\s$/.test(value) ||
		/^([\d.]+|true|false|null|yes|no)$/i.test(value);
	return needs_quotes ? JSON.stringify(value) : value;
}

/**
 * @param author "Lastname, Firstnames", or just a name (e.g. "Plato", "OpenAI")
 * @returns The frontmatter list item for this author
 */
export function authorListItem(author: string): string {
	const parts = author.split(",")
		.map(part => part.trim()).filter(part => part.length > 0);
	const name = parts.length === 2 ? `${parts[1]} ${parts[0]}` : author.trim();
	return `\n  - ${yamlValue(name)}`;
}

/**
 * @param link What's between the brackets of a wikilink
 * @returns The note it points to, so without alias, heading or block. Empty if
 * it points within the same note.
 */
export function noteOfWikiLink(link: string): string {
	return link.split("|")[0].split("#")[0].trim();
}

/**
 * Fills out the {{placeholders}} in a template. All in one go, and with a
 * replacer function, so whatever is in the values (e.g. $& or {{tags}} in pasted
 * BibTeX) stays as it is. Unknown placeholders are left alone.
 * @param yaml_keys Placeholders that need quoting when they're the entire value
 * of a frontmatter property
 */
export function fillTemplate(
	template: string,
	values: {[key: string]: string},
	yaml_keys: string[]
): string {
	return template.replace(
		/^([\w-]+: *)?{{(\w+)}}[ \t]*$|{{(\w+)}}/gm,
		(match, property, whole_line_key, inline_key) => {
			const key = whole_line_key ?? inline_key;
			if (!(key in values))
				return match;
			if (property && yaml_keys.includes(key) && values[key])
				return property + yamlValue(values[key]);
			return (property ?? "") + values[key];
		}
	);
}
