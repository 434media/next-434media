import { Marked } from "marked"

// Shared markdown → HTML renderer. Single source of truth so the RichTextEditor
// preview and any read-only view (SOP detail, etc.) produce identical output —
// what an author sees while writing is exactly what readers get.
//
// Authors are authenticated internal staff/interns, and this is the same render
// path the editor preview already used, so the output is trusted (no extra
// sanitization beyond marked's defaults — consistent with prior behavior).
const syncMarked = new Marked({
  async: false,
  gfm: true, // GitHub Flavored Markdown
  breaks: true, // Convert \n to <br> — important for line breaks
})

// Custom renderer (marked v16 API). Block renderers MUST parse their child
// tokens via `this.parser` — returning raw `token.text` would leak inline
// markdown (e.g. **bold**, links) as literal characters. Tailwind classes are
// applied inline because there is no global prose stylesheet.
/* eslint-disable @typescript-eslint/no-explicit-any */
const renderer: any = {
  paragraph(token: any) {
    return `<p class="mb-4 leading-relaxed">${this.parser.parseInline(token.tokens)}</p>\n`
  },
  heading(token: any) {
    const sizes: Record<number, string> = {
      1: "text-2xl font-bold mt-8 mb-4",
      2: "text-xl font-bold mt-6 mb-3",
      3: "text-lg font-semibold mt-5 mb-2",
      4: "text-base font-semibold mt-4 mb-2",
      5: "text-sm font-semibold mt-3 mb-1",
      6: "text-xs font-semibold mt-3 mb-1 uppercase tracking-wider",
    }
    return `<h${token.depth} class="${sizes[token.depth] || ""} text-gray-900">${this.parser.parseInline(token.tokens)}</h${token.depth}>\n`
  },
  strong(token: any) {
    return `<strong class="font-semibold text-gray-900">${this.parser.parseInline(token.tokens)}</strong>`
  },
  em(token: any) {
    return `<em class="italic text-gray-700">${this.parser.parseInline(token.tokens)}</em>`
  },
  codespan(token: any) {
    return `<code class="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-sm font-mono">${token.text}</code>`
  },
  code(token: any) {
    return `<pre class="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto my-4 text-sm"><code class="language-${token.lang || "text"}">${token.text}</code></pre>\n`
  },
  link(token: any) {
    const titleAttr = token.title ? ` title="${token.title}"` : ""
    return `<a href="${token.href}"${titleAttr} class="text-blue-600 underline decoration-blue-300 underline-offset-2 hover:decoration-blue-600 transition-colors" target="_blank" rel="noopener noreferrer">${this.parser.parseInline(token.tokens)}<svg class="inline-block w-3 h-3 ml-0.5 -mt-0.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg></a>`
  },
  blockquote(token: any) {
    return `<blockquote class="border-l-4 border-gray-300 pl-4 my-4 text-gray-600 italic">${this.parser.parse(token.tokens)}</blockquote>\n`
  },
  list(token: any) {
    const tag = token.ordered ? "ol" : "ul"
    const cls = token.ordered ? "list-decimal" : "list-disc"
    const body = token.items.map((item: any) => this.listitem(item)).join("")
    return `<${tag} class="${cls} pl-6 my-4 space-y-1 text-gray-700">${body}</${tag}>\n`
  },
  listitem(item: any) {
    // parse (not parseInline) so loose items keep block structure; tight items
    // render inline without a wrapping <p>.
    return `<li class="leading-relaxed">${this.parser.parse(item.tokens, !!item.loose)}</li>\n`
  },
  hr() {
    return `<hr class="border-t border-gray-200 my-8" />\n`
  },
  br() {
    return `<br />`
  },
}
/* eslint-enable @typescript-eslint/no-explicit-any */

syncMarked.use({ renderer })

/** Render a markdown string to HTML using the shared 434 renderer. */
export function renderMarkdown(md: string): string {
  return syncMarked.parse(md ?? "") as string
}
