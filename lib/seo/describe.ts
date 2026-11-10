/**
 * A meta description that fits a search result.
 *
 * Google and Bing cut a description off at roughly 155–160 characters and
 * replace the rest with an ellipsis of their own, often mid-word. Descriptions
 * drawn from content (a post's excerpt) have no length of their own, so they
 * are cut here instead, at a word boundary, with one ellipsis.
 */
export function metaDescription(text: string | null | undefined, max = 155): string {
  const clean = (text ?? "").replace(/\s+/g, " ").trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(" ")
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.–—-]+$/, "")}…`
}
