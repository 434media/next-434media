"use client"

import { useEffect, useState } from "react"
import { Tag, ChevronDown, Loader2, ExternalLink } from "lucide-react"

interface MailchimpTag {
  id: string | number
  name: string
  member_count?: number
}

/**
 * Compact "Mailchimp tags" reference panel for the Submissions page.
 *
 * Was previously a full panel on the Mailchimp Analytics page — moved here
 * because tags are operational segmentation data (used to decide who to
 * push to which audience), not analytical data.
 *
 * Renders collapsed by default — single chip showing total tag count, click
 * to expand into a scrollable list. Stays out of the way until you need it.
 */
export function MailchimpTagsReference() {
  const [tags, setTags] = useState<MailchimpTag[]>([])
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch("/api/mailchimp?endpoint=tags", { cache: "no-store" })
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        const list = (data?.data?.tags ?? data?.tags ?? []) as MailchimpTag[]
        // Sort by member count desc — most-used tags first
        list.sort((a, b) => (b.member_count ?? 0) - (a.member_count ?? 0))
        setTags(list)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (isLoading && tags.length === 0) return null
  if (!isLoading && tags.length === 0) return null

  const totalMembers = tags.reduce((sum, t) => sum + (t.member_count ?? 0), 0)

  return (
    <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden mb-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-neutral-50 transition-colors text-left"
      >
        <Tag className="w-4 h-4 text-neutral-400 shrink-0" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          Mailchimp tags
        </span>
        <span className="text-[10px] text-neutral-400">
          {tags.length} {tags.length === 1 ? "tag" : "tags"} · {totalMembers.toLocaleString()} tagged
          members
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-neutral-400 ml-auto transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="border-t border-neutral-100">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
            </div>
          ) : (
            <ul className="max-h-72 overflow-y-auto divide-y divide-neutral-100">
              {tags.map((tag) => (
                <li
                  key={tag.id}
                  className="flex items-center gap-3 px-4 py-2 hover:bg-neutral-50 transition-colors"
                >
                  <Tag className="w-3 h-3 text-neutral-300 shrink-0" />
                  <span className="text-[13px] text-neutral-900 truncate flex-1">{tag.name}</span>
                  <span className="text-[11px] font-medium text-neutral-600 tabular-nums shrink-0">
                    {(tag.member_count ?? 0).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="px-4 py-2 border-t border-neutral-100 bg-neutral-50 flex items-center justify-between text-[11px] text-neutral-400">
            <span>Reference for segmenting submissions before pushing to Mailchimp.</span>
            <a
              href="https://us19.admin.mailchimp.com/audience/tags/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-neutral-700 shrink-0 ml-3"
            >
              Manage in Mailchimp
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
