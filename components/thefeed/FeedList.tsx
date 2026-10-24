"use client"

import { useState } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "motion/react"
import { ArrowRight, Plus } from "lucide-react"
import type { PublicFeedItem } from "@/lib/thefeed"

// The Feed is 434's own content on 434media.com: 434 palette tokens and the
// visual system's type roles, nothing carried over from the Digital Canvas site
// (coordinator, carrying the founder's direction, 2026-10-24).

export function FeedList({ items }: { items: PublicFeedItem[] }) {
  if (items.length === 0) {
    return (
      <div className="text-center py-16 border border-neutral-200">
        <p className="t-body text-neutral-600">Nothing published yet.</p>
      </div>
    )
  }

  return (
    <ul className="border-t border-neutral-200">
      {items.map((item, index) => (
        <FeedListItem key={item.id} item={item} index={index} />
      ))}
    </ul>
  )
}

function FeedListItem({ item, index }: { item: PublicFeedItem; index: number }) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <motion.li
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="border-b border-neutral-200"
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        className="group w-full text-left py-6 type:py-8 cursor-pointer"
      >
        <div className="flex items-start gap-4 md:gap-6">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="t-metadata text-neutral-500">{item.date}</span>
              <span className="t-label text-neutral-600 border border-neutral-300 px-2 py-0.5">{item.type}</span>
            </div>
            <h2 className="t-heading-m text-neutral-900 group-hover:text-neutral-600 transition-colors">{item.title}</h2>
          </div>
          <motion.span
            animate={{ rotate: isExpanded ? 45 : 0 }}
            transition={{ duration: 0.2 }}
            className="shrink-0 mt-1 text-neutral-500 group-hover:text-neutral-900 transition-colors"
            aria-hidden="true"
          >
            <Plus className="w-5 h-5" />
          </motion.span>
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="pb-8 space-y-5">
              <div
                className="t-body text-neutral-700 max-w-3xl [&_p]:mb-3 [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: item.summaryHtml }}
              />

              <div className="flex flex-wrap gap-8">
                {item.authors.length > 0 && (
                  <div>
                    <span className="t-label text-neutral-500 block mb-2">Author</span>
                    <div className="flex flex-wrap gap-2">
                      {item.authors.map((author) => (
                        <span key={author} className="t-body-s text-neutral-800">{author}</span>
                      ))}
                    </div>
                  </div>
                )}
                {item.topics.length > 0 && (
                  <div>
                    <span className="t-label text-neutral-500 block mb-2">Topics</span>
                    <div className="flex flex-wrap gap-2">
                      {item.topics.map((topic) => (
                        <span key={topic} className="t-caption text-neutral-700 bg-neutral-100 px-2.5 py-1">
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <Link
                href={`/thefeed/${item.slug}`}
                className="t-control-emphasis inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--434-color-02-black)] text-[var(--434-white)] hover:bg-neutral-800 transition-colors"
              >
                Read more
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  )
}
