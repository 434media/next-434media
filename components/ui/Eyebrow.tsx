import type { ElementType, ReactNode } from "react"

/**
 * The small uppercase label — section kickers, field labels, card metadata,
 * "PRODUCING WITH", "BUILD WITH US", "NO SPAM · 1 SEND/MONTH".
 *
 * This role had drifted into six variants across the site:
 *
 *   Geist Mono 10px w400 ls1.8px    ×22  /work card metadata
 *   Geist Mono 11px w400 ls2.2px         footer eyebrows
 *   Geist Mono 11px w400 ls2.42px        section labels
 *   Geist Mono 11px w500 ls1.76px        navbar links
 *   Geist Sans 12px w600 ls0.3px    ×6   contact form labels  ← not even mono
 *
 * The last one is why this exists. Every small-caps label on the site is
 * Geist Mono except the six labels on the contact form, which is the one
 * surface where the brand voice matters most.
 *
 * Two sizes, because two is what the site actually needs: `sm` (10px) for
 * metadata riding on top of cards and images, `md` (11px) for section kickers
 * that head a block of content.
 */

type Size = "sm" | "md"
type Tone = "muted" | "strong" | "inherit"

const SIZES: Record<Size, string> = {
  sm: "text-[10px] tracking-[0.18em]",
  md: "text-[11px] tracking-[0.2em]",
}

const TONES: Record<Tone, string> = {
  muted: "text-neutral-500",
  strong: "text-neutral-900",
  inherit: "",
}

interface EyebrowProps {
  as?: ElementType
  size?: Size
  tone?: Tone
  className?: string
  children: ReactNode
  /** Forwarded for <label>. */
  htmlFor?: string
}

export function Eyebrow({
  as: Tag = "p",
  size = "md",
  tone = "muted",
  className = "",
  children,
  ...rest
}: EyebrowProps) {
  return (
    <Tag
      className={`font-geist-mono font-medium uppercase leading-none ${SIZES[size]} ${TONES[tone]} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  )
}
