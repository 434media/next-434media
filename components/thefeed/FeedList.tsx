"use client"

import { useState } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "motion/react"
import type { PublicFeedItem } from "@/lib/thefeed"

// The Feed is a Digital Canvas surface and keeps that brand's colours; it moved
// here from the Digital Canvas site in 2026-10 without a redesign.
const TYPE_COLORS: Record<PublicFeedItem["type"], string> = {
  video: "bg-white/10 text-white border border-white/10",
  article: "bg-[#88FF00]/10 text-[#88FF00] border border-[#88FF00]/20",
  podcast: "bg-[#FF006E]/10 text-[#FF006E] border border-[#FF006E]/20",
  newsletter: "bg-[#fbbf24]/10 text-[#fbbf24] border border-[#fbbf24]/20",
}

export function FeedList({ items }: { items: PublicFeedItem[] }) {
  if (items.length === 0) {
    return (
      <div className="text-center py-16 border border-[#222] bg-[#111] rounded-sm">
        <p className="text-lg font-medium text-white/60">Nothing published yet</p>
      </div>
    )
  }

  return (
    <ul className="border border-[#222] rounded-sm bg-[#0a0a0a] divide-y divide-[#222]">
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="relative group hover:bg-white/2 transition-colors"
    >
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#88FF00] opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

      <button
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        className="w-full text-left py-6 md:py-8 px-4 md:px-6 cursor-pointer"
      >
        <div className="flex items-start gap-4 md:gap-6">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-xs text-white/30 uppercase tracking-widest font-mono font-medium">{item.date}</span>
              <span className="text-white/20">•</span>
              <span
                className={`text-[10px] uppercase tracking-widest font-mono font-semibold px-2.5 py-0.5 rounded-sm ${TYPE_COLORS[item.type]}`}
              >
                {item.type}
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold leading-snug tracking-tight text-white">{item.title}</h2>
          </div>

          <div className="flex items-center justify-center shrink-0 w-8 h-8 mt-1">
            <motion.div
              animate={{ rotate: isExpanded ? 45 : 0 }}
              transition={{ duration: 0.2 }}
              className="text-white/50 group-hover:text-white transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="stroke-current" strokeWidth="2" aria-hidden="true">
                <path d="M 0 9 L 18 9" />
                <path d="M 9 0 L 9 18" />
              </svg>
            </motion.div>
          </div>
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
            <div className="px-4 md:px-6 pb-8 space-y-5">
              <div className="h-px bg-[#222]" />

              <div>
                <span className="text-[10px] uppercase tracking-widest font-mono font-semibold text-white/30 block mb-2">Summary</span>
                <div
                  className="text-base leading-relaxed text-white/60 [&_p]:mb-3 [&_a]:underline"
                  dangerouslySetInnerHTML={{ __html: item.summaryHtml }}
                />
              </div>

              <div className="flex flex-wrap gap-8">
                {item.authors.length > 0 && (
                  <div>
                    <span className="text-[10px] uppercase tracking-widest font-mono font-semibold text-white/30 block mb-2">Author</span>
                    <div className="flex flex-wrap gap-2">
                      {item.authors.map((author) => (
                        <span key={author} className="text-sm font-medium text-white/70">{author}</span>
                      ))}
                    </div>
                  </div>
                )}
                {item.topics.length > 0 && (
                  <div>
                    <span className="text-[10px] uppercase tracking-widest font-mono font-semibold text-white/30 block mb-2">Topics</span>
                    <div className="flex flex-wrap gap-2">
                      {item.topics.map((topic) => (
                        <span
                          key={topic}
                          className="text-xs font-medium uppercase tracking-wide px-2.5 py-1 bg-white/5 text-white/50 rounded-sm border border-white/10"
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <Link
                href={`/thefeed/${item.slug}`}
                className="inline-flex items-center gap-2 mt-2 px-5 py-2.5 bg-[#88FF00] text-[#0a0a0a] text-sm font-semibold tracking-wide hover:bg-[#ffaa22] transition-colors rounded-sm"
              >
                Read More
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  )
}
