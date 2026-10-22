const ESCAPES: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;',
};

/**
 * Escapes text for HTML content and attribute values.
 *
 * @param value Text or number to escape.
 * @returns The escaped text.
 */
export function esc(value: string | number): string {
	return String(value).replace(/[&<>"']/g, (ch) => ESCAPES[ch] ?? ch);
}

type AttrValue = string | number | boolean | undefined | null;

/**
 * Serializes HTML attributes. `undefined`, `null` and `false` are skipped; `true` renders a bare
 * attribute.
 *
 * @param values Attribute names and values.
 * @returns The attributes, each preceded by a space.
 */
export function attrs(values: Record<string, AttrValue>): string {
	let out = '';

	for (const [name, value] of Object.entries(values)) {
		if (value === undefined || value === null || value === false) continue;

		out += value === true ? ` ${name}` : ` ${name}="${esc(value)}"`;
	}

	return out;
}

/**
 * Joins HTML fragments, dropping empty and falsy ones.
 *
 * @param parts Fragments, possibly `false`, `null` or `undefined`.
 * @returns The concatenated HTML.
 */
export function join(parts: Array<string | false | undefined | null>): string {
	return parts.filter(Boolean).join('');
}
