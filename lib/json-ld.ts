/**
 * Serialize structured data for a `<script type="application/ld+json">` body.
 *
 * `JSON.stringify` alone is not safe inside a script element: a string value holding `</script>` (a blog title, a
 * product description, an author name) closes the element and whatever follows runs as HTML. The Next.js JSON-LD guide
 * gives the remedy used here: replace `<` with its JSON unicode escape. `>` and `&` are escaped too, so no `<!--` or
 * `-->` sequence or entity can form, and U+2028/U+2029, which some parsers treat as line terminators. Each replacement
 * is a JSON escape, so the parsed value is unchanged.
 *
 * Every JSON-LD script in the app goes through this; a raw `JSON.stringify` in a `dangerouslySetInnerHTML` is the bug.
 */
export function jsonLdScript(data: unknown): string {
  return (JSON.stringify(data) ?? "null")
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
}
