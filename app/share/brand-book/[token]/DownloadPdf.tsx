"use client"

import { Download } from "lucide-react"

/** The browser renders this page with its print styles as a PDF, on request: nothing is stored (Step 4 item 4). */
export function DownloadPdf() {
  return (
    <button type="button" onClick={() => window.print()} className="inline-flex h-9 items-center gap-1.5 rounded bg-neutral-900 px-3 text-sm text-white hover:bg-neutral-800">
      <Download className="h-4 w-4" /> Download PDF
    </button>
  )
}
