/**
 * Replaces the `{name}` placeholders of a template. Unknown placeholders are left as they are.
 *
 * @param template Text containing `{name}` placeholders.
 * @param values Value of each placeholder.
 * @returns The filled-in text.
 */
export function fill(template: string, values: Record<string, string | number>): string {
	return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}
