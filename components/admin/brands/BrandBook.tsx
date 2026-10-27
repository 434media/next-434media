import { Fragment, type ReactNode } from "react"
import { hexColumn, hexOf, markInternal, vendorBook, type BookBlock, type BrandBook as Book } from "@/lib/content-pipeline/brand-book"

/**
 * A brand's brand book (plan v11.2.1 Step 4 item 3), drawn from its published profile's `visual` block, which was
 * generated from the brand's visual standard. It names the profile version it was built from and the standard's
 * version. The same component renders a vendor's shared copy (Step 4 item 4, app/share/brand-book), so it takes the
 * book as data; its print styles (no swatch or row split across pages, code wrapped) are that copy's Download PDF.
 *
 * `audience` decides what is drawn. Staff (the brand page) see the whole book, each internal block marked "Internal:
 * not in the vendor copy", so nothing is lost. A vendor sees only vendorBook(), with no profile id or hash in the
 * header; the share page also filters on the server before it renders, so internal blocks never reach the vendor.
 */
export function BrandBook({ book, brand, versionId, audience = "staff" }: { book: Book; brand: string; versionId: string; audience?: "staff" | "vendor" }) {
  const vendor = audience === "vendor"
  const sections = markInternal(vendor ? vendorBook(book) : book)
  const version = book.standard.version.replace(/^Version\s+/i, "v")
  return (
    <article className="text-sm text-neutral-800">
      <header className="border-b border-neutral-200 pb-3">
        <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">Brand book</p>
        <h3 className="mt-1 text-xl font-semibold text-neutral-900">{brand}</h3>
        {vendor
          ? <p className="mt-1 text-xs text-neutral-500">{version}</p>
          : <p className="mt-1 text-xs text-neutral-500">
              Built from profile <span className="font-mono">{versionId}</span> · {book.standard.title}, {version} <span className="font-mono">({book.standard.sha256.slice(0, 8)})</span>
            </p>}
      </header>
      {sections.map(s => (
        <section key={s.title} className="mt-5">
          <h4 className="text-base font-semibold text-neutral-900">{s.title}</h4>
          <div className="mt-2 space-y-2">{s.blocks.filter(m => !vendor || !m.internal).map((m, i) => m.internal
            ? <div key={i} className="rounded border border-dashed border-amber-300 bg-amber-50/60 px-2 py-1.5"><p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-amber-700">Internal: not in the vendor copy</p><Block block={m.block} /></div>
            : <Block key={i} block={m.block} />)}</div>
        </section>
      ))}
    </article>
  )
}

function Block({ block: b }: { block: BookBlock }) {
  if (b.kind === "heading") return b.level === 3
    ? <h5 className="pt-2 text-sm font-semibold text-neutral-900">{inline(b.text ?? "")}</h5>
    : <h6 className="pt-1 text-sm font-medium text-neutral-800">{inline(b.text ?? "")}</h6>
  if (b.kind === "paragraph") return <p className="leading-relaxed">{inline(b.text ?? "")}</p>
  if (b.kind === "code") return <pre className="overflow-x-auto print:overflow-visible print:whitespace-pre-wrap rounded bg-neutral-100 p-2 font-mono text-xs leading-relaxed">{b.text}</pre>
  if (b.kind === "list") {
    // Nested items are indented by their depth; a numbered list keeps its numbers at the margin.
    const List = b.ordered ? "ol" : "ul"
    return <List className={`${b.ordered ? "list-decimal" : "list-disc"} pl-5 space-y-0.5`}>{(b.items ?? []).map((x, i) => <li key={i} style={b.depths?.[i] ? { marginLeft: `${b.depths[i] * 1.25}rem`, listStyleType: "circle" } : undefined}>{inline(x)}</li>)}</List>
  }
  const hex = hexColumn(b)
  if (hex >= 0) return (
    // Colours as swatches: the value, its name and what it is for, in the standard's own words.
    <div className="grid gap-2 grid-cols-2 sm:grid-cols-3">
      {(b.rows ?? []).map((r, i) => {
        const c = hexOf(r.cells[hex] ?? "")
        return (
          <div key={i} className="rounded border border-neutral-200 overflow-hidden break-inside-avoid">
            <div className="h-14 border-b border-neutral-200" style={c ? { background: c } : undefined} />
            <div className="p-2 text-xs">
              {(b.head ?? []).map((h, j) => <p key={j} className={j === hex ? "font-mono text-neutral-500" : j === 0 ? "font-medium text-neutral-900" : "text-neutral-600"}>{j === hex ? c ?? r.cells[j] : inline(r.cells[j] ?? "")}</p>)}
            </div>
          </div>
        )
      })}
    </div>
  )
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        {(b.head ?? []).some(h => h) && <thead><tr>{(b.head ?? []).map((h, i) => <th key={i} className="text-left font-medium text-neutral-500 border-b border-neutral-200 py-1 pr-3">{inline(h)}</th>)}</tr></thead>}
        <tbody>{(b.rows ?? []).map((r, i) => <tr key={i} className="border-b border-neutral-100 align-top break-inside-avoid">{r.cells.map((c, j) => <td key={j} className="py-1 pr-3">{inline(c)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

/** The standard's inline marks as elements (never as HTML): `code`, **bold** and *italic*. */
function inline(text: string): ReactNode {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g)
  return parts.map((p, i) => {
    if (/^`[^`]+`$/.test(p)) return <code key={i} className="font-mono text-[0.92em] bg-neutral-100 rounded px-1">{p.slice(1, -1)}</code>
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={i} className="font-semibold">{p.slice(2, -2)}</strong>
    if (/^\*[^*]+\*$/.test(p)) return <em key={i}>{p.slice(1, -1)}</em>
    return <Fragment key={i}>{p}</Fragment>
  })
}
