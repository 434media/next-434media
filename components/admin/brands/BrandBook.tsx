import { Fragment, type ReactNode } from "react"
import { designerBook, hexColumn, hexOf, inlineTokens, markInternal, type BookBlock, type BrandBook as Book } from "@/lib/content-pipeline/brand-book"

/**
 * A brand's brand book (plan v11.2.1 Step 4 item 3), drawn from its published profile's `visual` block, which was
 * generated from the brand's visual standard. It names the profile version it was built from and the standard's
 * version. The same component renders a vendor's shared copy (Step 4 item 4, app/share/brand-book), so it takes the
 * book as data; its print styles (no swatch or row split across pages, code wrapped) are that copy's Download PDF.
 *
 * `view` decides what is drawn. "designer" is the brand book a designer needs (designerBook: colour, type, marks,
 * photography), sent to vendors and shown to staff first, with no profile id or hash in the header. "full" is the whole
 * visual standard for super-admins, every internal block marked, so nothing is lost. The share page also filters on
 * the server before it renders, so nothing else reaches a vendor. `collapsible` folds each section under its heading;
 * `open` starts every section open (the vendor's page, whose Save as PDF opens any the reader closed first).
 */
/**
 * The vendor's downloads (Step 4 item 6), drawn into the book's own tables: a tick box and a thumbnail on each logo
 * file's row in Marks, and a tick box and a source link on the first row of each face in Typography. A logo whose
 * delivered copy is not in storage yet is listed with "File to follow" and no tick box. The boxes belong to the form
 * `formId` (the page's Download selected), so ticking and downloading work without script.
 */
export interface BookPicks {
  formId: string
  logos: Record<string, { id: string; available: boolean; dark: boolean; thumb: string }>
  fonts: Record<string, { id: string; sourceUrl: string }>
}

export function BrandBook({ book, brand, versionId, view = "designer", collapsible = false, open = false, picks }: { book: Book; brand: string; versionId: string; view?: "designer" | "full"; collapsible?: boolean; open?: boolean; picks?: BookPicks }) {
  const designer = view === "designer"
  const sections = markInternal(designer ? designerBook(book) : book)
  const version = book.standard.version.replace(/^Version\s+/i, "v")
  return (
    <article className="text-sm text-neutral-800">
      <header className="border-b border-neutral-200 pb-3">
        <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">{designer ? "Brand book" : "Visual standard, in full"}</p>
        <h3 className="mt-1 text-xl font-semibold text-neutral-900">{brand}</h3>
        {designer
          ? <p className="mt-1 text-xs text-neutral-500">{version}</p>
          : <p className="mt-1 text-xs text-neutral-500">
              Built from profile <span className="font-mono">{versionId}</span> · {book.standard.title}, {version} <span className="font-mono">({book.standard.sha256.slice(0, 8)})</span>
            </p>}
      </header>
      {sections.map(s => {
        const body = <div className="mt-2 space-y-2">{s.blocks.map((m, i) => m.internal
          ? <div key={i} className="rounded border border-dashed border-amber-300 bg-amber-50/60 px-2 py-1.5"><p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-amber-700">Internal: not in the designer&apos;s copy</p><Block block={m.block} /></div>
          : <Block key={i} block={m.block} picks={picks} />)}</div>
        return collapsible
          ? <details key={s.title} open={open || undefined} className="group/bk mt-3 border-b border-neutral-100 pb-3"><summary className="cursor-pointer list-none text-base font-semibold text-neutral-900 marker:hidden"><span className="mr-1.5 inline-block text-neutral-400 transition-transform group-open/bk:rotate-90">›</span>{s.title}</summary>{body}</details>
          : <section key={s.title} className="mt-5"><h4 className="text-base font-semibold text-neutral-900">{s.title}</h4>{body}</section>
      })}
    </article>
  )
}

function Block({ block: b, picks }: { block: BookBlock; picks?: BookPicks }) {
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
  if (picks) {
    const logoRows = (b.rows ?? []).map(r => picks.logos[fileOf(r.cells[0] ?? "")])
    const faceCol = (b.head ?? []).findIndex(h => /^(face|typeface|font)$/i.test(h.trim()))
    if (logoRows.some(Boolean)) return <PickTable block={b} formId={picks.formId} rows={logoRows.map(l => l && { id: l.id, available: l.available, thumb: { src: l.thumb, dark: l.dark } })} />
    if (faceCol >= 0) {
      const seen = new Set<string>()
      const fontRows = (b.rows ?? []).map(r => {
        const face = plainCell(r.cells[faceCol] ?? ""), f = picks.fonts[face]
        if (!f || seen.has(face)) return undefined
        seen.add(face)
        return { id: f.id, available: true, link: { col: faceCol, href: f.sourceUrl } }
      })
      if (fontRows.some(Boolean)) return <PickTable block={b} formId={picks.formId} rows={fontRows} />
    }
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        {(b.head ?? []).some(h => h) && <thead><tr>{(b.head ?? []).map((h, i) => <th key={i} className="text-left font-medium text-neutral-500 border-b border-neutral-200 py-1 pr-3">{inline(h)}</th>)}</tr></thead>}
        <tbody>{(b.rows ?? []).map((r, i) => <tr key={i} className="border-b border-neutral-100 align-top break-inside-avoid">{r.cells.map((c, j) => <td key={j} className="py-1 pr-3">{inline(c)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

const fileOf = (cell: string) => cell.trim().replace(/^`|`$/g, "")
const plainCell = (cell: string) => cell.replace(/\\\*/g, "").replace(/[`*]/g, "").trim()

type PickRow = { id: string; available: boolean; thumb?: { src: string; dark: boolean }; link?: { col: number; href: string } } | undefined | null

/** A table with a tick box (and, for logos, a thumbnail) before each offered row. Hidden from the printed PDF. */
function PickTable({ block: b, formId, rows }: { block: BookBlock; formId: string; rows: PickRow[] }) {
  const thumbs = rows.some(r => r?.thumb)
  return (
    <div className="overflow-x-auto">
      <table className={`w-full text-xs border-collapse ${thumbs ? "min-w-[38rem]" : ""}`}>
        <thead><tr>
          <th className="w-7 border-b border-neutral-200 print:hidden"><span className="sr-only">Download</span></th>
          {thumbs && <th className="w-16 sm:w-24 border-b border-neutral-200"><span className="sr-only">Preview</span></th>}
          {(b.head ?? []).map((h, i) => <th key={i} className="text-left font-medium text-neutral-500 border-b border-neutral-200 py-1 pr-3">{inline(h)}</th>)}
        </tr></thead>
        <tbody>{(b.rows ?? []).map((r, i) => {
          const p = rows[i]
          return (
            <tr key={i} className="border-b border-neutral-100 align-middle break-inside-avoid">
              <td className="py-1.5 print:hidden">{p?.available && <input type="checkbox" name="f" value={p.id} form={formId} data-vendor-pick aria-label={`Download ${plainCell(r.cells[p.link?.col ?? 0] ?? "")}`} className="h-4 w-4 accent-neutral-900" />}</td>
              {thumbs && <td className="py-1.5 pr-3">{p?.thumb && (p.available
                ? <span className={`flex h-10 w-14 items-center justify-center rounded border border-neutral-200 sm:h-12 sm:w-20 ${p.thumb.dark ? "bg-neutral-800" : "bg-neutral-50"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- a private file served through the share link, not an optimisable public image */}
                    <img src={p.thumb.src} alt="" className="max-h-8 max-w-12 object-contain sm:max-h-10 sm:max-w-[4.5rem]" loading="lazy" />
                  </span>
                : <span className="text-[11px] leading-tight text-neutral-400">File to follow</span>)}</td>}
              {/* A file name stays whole (the table scrolls sideways on a phone, as the brand page's do). */}
              {r.cells.map((c, j) => <td key={j} className={`py-1.5 pr-3 ${thumbs && j === 0 ? "whitespace-nowrap" : ""}`}>{p?.link?.col === j
                ? <a href={p.link.href} target="_blank" rel="noreferrer" className="underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-900">{inline(c)}</a>
                : inline(c)}</td>)}
            </tr>
          )
        })}</tbody>
      </table>
    </div>
  )
}

/** The standard's inline marks as elements (never as HTML): `code`, **bold** and *italic*. */
function inline(text: string): ReactNode {
  return inlineTokens(text).map((t, i) => {
    if (t.kind === "code") return <code key={i} className="font-mono text-[0.92em] bg-neutral-100 rounded px-1">{t.text}</code>
    if (t.kind === "strong") return <strong key={i} className="font-semibold">{t.text}</strong>
    if (t.kind === "em") return <em key={i}>{t.text}</em>
    return t.text.startsWith("✓") ? <span key={i} className="text-green-700">{t.text}</span> : <Fragment key={i}>{t.text}</Fragment>
  })
}
