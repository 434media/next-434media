"use client"

import { useState } from "react"

// Provider brand logo for the model picker. Uses the lobehub icon set (the
// de-facto AI-provider logo collection — covers all our providers including the
// newer labs Simple Icons doesn't carry) pinned via jsDelivr. If the CDN ever
// fails it degrades to a plain brand-colored chip so the UI never breaks.

// cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@<ver>/icons/<slug>.svg
// All six slugs below verified to return 200 at this pinned version.
const CDN = "https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.91.0/icons"

// Creator prefix → { lobehub icon slug, display name, fallback chip color }.
const PROVIDERS: Record<string, { slug: string; label: string; color: string }> = {
  openai: { slug: "openai", label: "OpenAI", color: "#10a37f" },
  google: { slug: "gemini", label: "Google", color: "#1a73e8" },
  xai: { slug: "grok", label: "xAI", color: "#111111" },
  bfl: { slug: "flux", label: "Black Forest Labs", color: "#e5484d" },
  klingai: { slug: "kling", label: "Kling", color: "#6e56cf" },
  bytedance: { slug: "bytedance", label: "ByteDance", color: "#0a7cff" },
}

export function providerLabel(provider: string): string {
  return PROVIDERS[provider]?.label ?? provider
}

interface ProviderLogoProps {
  provider: string
  /** px — square. */
  size?: number
  className?: string
}

export function ProviderLogo({ provider, size = 18, className = "" }: ProviderLogoProps) {
  const [failed, setFailed] = useState(false)
  const meta = PROVIDERS[provider]
  const label = meta?.label ?? provider

  if (!meta || failed) {
    // Fallback — a plain brand-colored chip (no letter), only if the CDN fails
    // or an unknown provider id appears. lobehub covers all current providers.
    return (
      <span
        className={`inline-block rounded-[5px] shrink-0 ${className}`}
        style={{ width: size, height: size, backgroundColor: meta?.color ?? "#525252" }}
        title={label}
        aria-label={label}
      />
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${CDN}/${meta.slug}.svg`}
      alt={label}
      title={label}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={`shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  )
}
