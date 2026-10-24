"use client"

import { useState } from "react"
import { FeedImage } from "./FeedImage"
import { motion } from "motion/react"
import { ArrowRight } from "lucide-react"
import type { NewsletterContent } from "@/lib/thefeed"

const CHARACTER_LIMIT = 255

// Every HTML string here was sanitized server side in lib/thefeed.ts. Styled in
// 434 palette tokens and type roles; the Digital Canvas version's look is not
// carried over (coordinator, 2026-10-24).
//
// Two decorative stickers the Digital Canvas version hard-coded are left out:
// an "Actions Speak Louder" sticker on the founder's note, which spells the
// motto wrong and is not its styled form, and a "434 Featured Event" badge that
// retypes the 434 mark. Neither resolves to the current canon (no asset by
// inheritance), so neither is carried over.

function plainLength(html: string): number {
  let text = html
  let previous: string
  do {
    previous = text
    text = text.replace(/<[^>]*>/g, "")
  } while (text !== previous)
  return text.length
}

function truncateHtml(html: string): string {
  let count = 0
  let result = ""
  let inTag = false
  for (const char of html) {
    if (char === "<") inTag = true
    if (inTag || count < CHARACTER_LIMIT) {
      result += char
      if (!inTag) count++
    } else {
      break
    }
    if (char === ">") inTag = false
  }
  return result + `<span>… </span>`
}

function TruncatedText({ html, className }: { html: string; className?: string }) {
  const [isExpanded, setIsExpanded] = useState(false)
  if (plainLength(html) <= CHARACTER_LIMIT) {
    return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
  }
  return (
    <div className={className}>
      <div dangerouslySetInnerHTML={{ __html: isExpanded ? html : truncateHtml(html) }} />
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="t-body-s text-neutral-600 hover:text-neutral-900 transition-colors underline"
      >
        {isExpanded ? "less" : "more"}
      </button>
    </div>
  )
}

const RICH =
  "t-body-l text-neutral-800 [&_p]:mb-4 [&_strong]:font-semibold [&_strong]:text-neutral-900 [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:space-y-2 [&_ol]:list-decimal [&_ol]:ml-6 [&_li]:leading-relaxed [&_a]:underline"
const RICH_INVERT =
  "t-body text-[var(--color-on-dark-text-secondary)] [&_p]:mb-4 [&_strong]:font-semibold [&_strong]:text-[var(--color-on-dark-text)] [&_a]:underline"

function Cta({ href, children, invert }: { href: string; children: React.ReactNode; invert?: boolean }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`t-control-emphasis inline-flex items-center gap-2 px-6 py-3 transition-colors w-fit group ${
        invert
          ? "bg-[var(--434-white)] text-[var(--434-color-02-black)] hover:bg-neutral-100"
          : "bg-[var(--434-color-02-black)] text-[var(--434-white)] hover:bg-neutral-800"
      }`}
    >
      {children}
      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
    </a>
  )
}

export function NewsletterTemplate({ content }: { content: NewsletterContent }) {
  const { heroImage, foundersNote, featuredPost, upcomingEvent } = content

  return (
    <div className="space-y-16 md:space-y-24">
      {heroImage.mobile && (
        <div className="relative w-full aspect-4/5 overflow-hidden bg-neutral-100 md:hidden">
          <FeedImage src={heroImage.mobile} alt="Newsletter hero" sizes="100vw" className="object-contain" priority />
        </div>
      )}
      {heroImage.desktop && (
        <div className="relative w-full aspect-video overflow-hidden hidden md:block">
          <FeedImage src={heroImage.desktop} alt="Newsletter hero" sizes="(min-width: 768px) 896px, 100vw" className="object-contain" priority />
        </div>
      )}

      {foundersNote.text && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="border border-neutral-300 p-6 md:p-8 lg:p-12"
        >
          <h2 className="font-ggx88 t-display-s text-neutral-900 mb-8 border-b border-neutral-300 pb-4">
            Founder&apos;s Note
          </h2>
          <div className="grid md:grid-cols-2 gap-8 md:gap-12">
            <div className={RICH} dangerouslySetInnerHTML={{ __html: foundersNote.text }} />
            {foundersNote.image && (
              <div className="relative aspect-4/5 overflow-hidden bg-neutral-100">
                <FeedImage src={foundersNote.image} alt="Founder's note" sizes="(min-width: 768px) 420px, 100vw" className="object-cover" />
              </div>
            )}
          </div>
        </motion.section>
      )}

      <section className="space-y-8">
        {content.lastMonthGif && (
          <div className="relative w-full aspect-3/1 overflow-hidden bg-neutral-100">
            <FeedImage src={content.lastMonthGif} alt="Last month in motion" className="object-cover" unoptimized />
          </div>
        )}

        {content.spotlights.map((spotlight, index) => (
          <div
            key={index}
            className={`grid md:grid-cols-2 gap-6 md:gap-8 border border-neutral-300 p-6 md:p-8 ${
              index % 2 === 1 ? "md:grid-flow-dense" : ""
            }`}
          >
            {spotlight.image && (
              <div
                className={`relative aspect-4/5 overflow-hidden bg-neutral-100 ${
                  index % 2 === 1 ? "md:col-start-2" : ""
                }`}
              >
                <FeedImage src={spotlight.image} alt={spotlight.title} sizes="(min-width: 768px) 420px, 100vw" className="object-cover" />
              </div>
            )}
            <div className="flex flex-col justify-center space-y-4">
              <h3 className="t-heading-m text-neutral-900">{spotlight.title}</h3>
              <TruncatedText html={spotlight.description} className={RICH} />
              {spotlight.ctaLink && <Cta href={spotlight.ctaLink}>{spotlight.ctaText}</Cta>}
            </div>
          </div>
        ))}
      </section>

      {featuredPost.title && (
        <section className="border border-neutral-300 overflow-hidden">
          {featuredPost.image && (
            <div className="relative w-full aspect-2/1 bg-neutral-100">
              <FeedImage src={featuredPost.image} alt={featuredPost.title} sizes="(min-width: 768px) 896px, 100vw" className="object-cover" />
            </div>
          )}
          <div className="p-6 md:p-8 lg:p-12 space-y-6">
            <h2 className="t-heading-xl text-neutral-900 border-b border-neutral-300 pb-4">
              {featuredPost.title}
            </h2>
            <div className={RICH} dangerouslySetInnerHTML={{ __html: featuredPost.content }} />
          </div>
        </section>
      )}

      <section className="space-y-8">
        {content.theDropGif && (
          <div className="relative w-full aspect-3/1 overflow-hidden bg-neutral-100">
            <FeedImage src={content.theDropGif} alt="The Drop" className="object-cover" unoptimized />
          </div>
        )}

        {upcomingEvent.title && (
          <div className="bg-[var(--color-chrome-bg)] text-[var(--color-on-dark-text)]">
            {upcomingEvent.image.mobile && (
              <div className="relative aspect-4/5 bg-neutral-900 md:hidden">
                <FeedImage src={upcomingEvent.image.mobile} alt={upcomingEvent.title} sizes="100vw" className="object-cover" />
              </div>
            )}
            {upcomingEvent.image.desktop && (
              <div className="relative aspect-video bg-neutral-900 hidden md:block">
                <FeedImage src={upcomingEvent.image.desktop} alt={upcomingEvent.title} sizes="896px" className="object-cover" />
              </div>
            )}
            <div className="p-6 md:p-8 lg:p-12 space-y-4 md:space-y-6">
              <h3 className="t-heading-xl border-b border-[var(--color-chrome-divider)] pb-4">
                {upcomingEvent.title}
              </h3>
              <div className={RICH_INVERT} dangerouslySetInnerHTML={{ __html: upcomingEvent.description }} />
              {upcomingEvent.ctaLink && (
                <Cta href={upcomingEvent.ctaLink} invert>
                  {upcomingEvent.ctaText}
                </Cta>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
