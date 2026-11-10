"use client"

import { useEffect, useState } from "react"
import { Download, Printer } from "lucide-react"

/**
 * The bar at the foot of a vendor's brand page (Step 4 item 6): Select all, the count, Save as PDF and Download
 * selected. The tick boxes live in the book's tables and belong to the form `formId`, whose submit is Download
 * selected, so the download works without this script; the script adds Select all and the count.
 *
 * Save as PDF is the browser's own rendering of the page with its print styles, made on request and never stored
 * (Step 4 item 4). Sections the reader folded are opened first, so the PDF is the whole book.
 */
export function VendorFilesBar({ formId, total }: { formId: string; total: number }) {
  const [count, setCount] = useState(0)
  const boxes = () => [...document.querySelectorAll<HTMLInputElement>(`input[data-vendor-pick][form="${formId}"]`)]
  useEffect(() => {
    const update = () => setCount(boxes().filter(b => b.checked).length)
    const openAll = () => document.querySelectorAll("details").forEach(d => { d.open = true })
    document.addEventListener("change", update)
    window.addEventListener("beforeprint", openAll)
    update()
    return () => { document.removeEventListener("change", update); window.removeEventListener("beforeprint", openAll) }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the boxes are found in the page, not in state
  }, [formId])
  const all = total > 0 && count === total
  const selectAll = (on: boolean) => { boxes().forEach(b => { b.checked = on }); setCount(on ? total : 0) }
  return (
    <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-neutral-200 bg-white pb-8 pt-3 print:hidden">
      {total > 0 && (
        <label className="flex items-center gap-2 text-sm text-neutral-800">
          <input type="checkbox" checked={all} onChange={e => selectAll(e.target.checked)} className="h-4 w-4 accent-neutral-900" /> Select all
        </label>
      )}
      <span className="min-w-[7rem] flex-1 text-sm text-neutral-500" aria-live="polite">{total > 0 ? `${count} ${count === 1 ? "file" : "files"} selected` : ""}</span>
      <button type="button" onClick={() => window.print()} className="inline-flex h-9 items-center gap-1.5 rounded border border-neutral-300 px-3 text-sm text-neutral-800 hover:bg-neutral-50">
        <Printer className="h-4 w-4" /> Save as PDF
      </button>
      {total > 0 && (
        <button type="submit" form={formId} onClick={e => { if (count === 0) e.preventDefault() }} aria-disabled={count === 0} className="inline-flex h-9 items-center gap-1.5 rounded bg-neutral-900 px-3 text-sm text-white hover:bg-neutral-800 aria-disabled:cursor-not-allowed aria-disabled:bg-neutral-300">
          <Download className="h-4 w-4" /> Download selected
        </button>
      )}
    </div>
  )
}
