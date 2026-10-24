"use client"

import { useState } from "react"
import Image from "next/image"
import { motion } from "motion/react"
import { ArrowRight } from "lucide-react"
import type { NewsletterContent } from "@/lib/thefeed"

const CHARACTER_LIMIT = 255

// Every HTML string here was sanitized server side in lib/thefeed.ts.
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
  return result + `<span class="text-neutral-500">... </span>`
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
        className="text-neutral-500 hover:text-black transition-colors underline"
      >
        {isExpanded ? "less" : "more"}
      </button>
    </div>
  )
}

const RICH =
  "text-lg text-neutral-800 [&_p]:leading-relaxed [&_p]:mb-4 [&_strong]:font-bold [&_strong]:text-black [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:space-y-2 [&_ol]:list-decimal [&_ol]:ml-6 [&_li]:leading-relaxed [&_a]:underline"
const RICH_INVERT =
  "text-base leading-relaxed text-neutral-200 [&_p]:mb-4 [&_strong]:font-bold [&_strong]:text-white [&_a]:underline"

function Cta({ href, children, invert }: { href: string; children: React.ReactNode; invert?: boolean }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 px-6 py-3 text-sm uppercase tracking-wider font-mono font-bold transition-colors w-fit border-2 group ${
        invert ? "bg-white text-black hover:bg-neutral-200 border-white" : "bg-black text-white hover:bg-neutral-800 border-black"
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
          <Image src={heroImage.mobile} alt="Newsletter hero" fill sizes="100vw" className="object-contain" priority />
        </div>
      )}
      {heroImage.desktop && (
        <div className="relative w-full aspect-video overflow-hidden hidden md:block">
          <Image src={heroImage.desktop} alt="Newsletter hero" fill sizes="(min-width: 768px) 896px, 100vw" className="object-contain" priority />
        </div>
      )}

      {foundersNote.text && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="border-4 border-black p-6 md:p-8 lg:p-12 bg-white"
        >
          <h2 className="text-2xl md:text-3xl font-bold font-menda-black uppercase tracking-tight mb-8 border-b-4 border-black pb-4">
            Founder&apos;s Note
          </h2>
          <div className="grid md:grid-cols-2 gap-8 md:gap-12">
            <div className={`${RICH} md:tracking-tighter`} dangerouslySetInnerHTML={{ __html: foundersNote.text }} />
            {foundersNote.image && (
              <div className="relative aspect-4/5 border-4 border-black overflow-hidden bg-neutral-100">
                <Image src={foundersNote.image} alt="Founder's note" fill sizes="(min-width: 768px) 420px, 100vw" className="object-cover" />
              </div>
            )}
          </div>
        </motion.section>
      )}

      <section className="space-y-8">
        {content.lastMonthGif && (
          <div className="relative w-full aspect-3/1 border-4 border-black overflow-hidden bg-neutral-100">
            <Image src={content.lastMonthGif} alt="Last month in motion" fill className="object-cover" unoptimized />
          </div>
        )}

        {content.spotlights.map((spotlight, index) => (
          <div
            key={index}
            className={`grid md:grid-cols-2 gap-6 md:gap-8 border-4 border-black p-6 md:p-8 bg-white hover:bg-neutral-50 transition-colors ${
              index % 2 === 1 ? "md:grid-flow-dense" : ""
            }`}
          >
            {spotlight.image && (
              <div
                className={`relative aspect-4/5 border-4 border-black overflow-hidden bg-neutral-100 ${
                  index % 2 === 1 ? "md:col-start-2" : ""
                }`}
              >
                <Image src={spotlight.image} alt={spotlight.title} fill sizes="(min-width: 768px) 420px, 100vw" className="object-cover" />
              </div>
            )}
            <div className="flex flex-col justify-center space-y-4">
              <h3 className="text-xl md:text-2xl font-bold font-menda-black uppercase tracking-tight">{spotlight.title}</h3>
              <TruncatedText html={spotlight.description} className={`${RICH} md:tracking-tighter text-neutral-700`} />
              <Cta href={spotlight.ctaLink}>{spotlight.ctaText}</Cta>
            </div>
          </div>
        ))}
      </section>

      {featuredPost.title && (
        <section className="border-4 border-black bg-white overflow-hidden">
          {featuredPost.image && (
            <div className="relative w-full aspect-2/1 bg-neutral-100">
              <Image src={featuredPost.image} alt={featuredPost.title} fill sizes="(min-width: 768px) 896px, 100vw" className="object-cover" />
            </div>
          )}
          <div className="p-6 md:p-8 lg:p-12 space-y-6">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold font-menda-black uppercase tracking-tight border-b-4 border-black pb-4">
              {featuredPost.title}
            </h2>
            <div className={RICH} dangerouslySetInnerHTML={{ __html: featuredPost.content }} />
          </div>
        </section>
      )}

      <section className="space-y-8">
        {content.theDropGif && (
          <div className="relative w-full aspect-3/1 border-4 border-black overflow-hidden bg-neutral-100">
            <Image src={content.theDropGif} alt="The Drop" fill className="object-cover" unoptimized />
          </div>
        )}

        {upcomingEvent.title && (
          <div className="border-4 border-black bg-black text-white">
            {upcomingEvent.image.mobile && (
              <div className="relative aspect-4/5 bg-neutral-800 md:hidden">
                <Image src={upcomingEvent.image.mobile} alt={upcomingEvent.title} fill sizes="100vw" className="object-cover" />
              </div>
            )}
            {upcomingEvent.image.desktop && (
              <div className="relative aspect-video bg-neutral-800 hidden md:block">
                <Image src={upcomingEvent.image.desktop} alt={upcomingEvent.title} fill sizes="896px" className="object-cover" />
              </div>
            )}
            <div className="p-6 md:p-8 lg:p-12 space-y-4 md:space-y-6">
              <h3 className="text-xl md:text-3xl lg:text-4xl font-bold font-menda-black uppercase tracking-tight md:border-b-4 md:border-white md:pb-4">
                {upcomingEvent.title}
              </h3>
              <div className={RICH_INVERT} dangerouslySetInnerHTML={{ __html: upcomingEvent.description }} />
              <Cta href={upcomingEvent.ctaLink} invert>
                {upcomingEvent.ctaText}
              </Cta>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
