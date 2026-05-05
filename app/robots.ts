import type { MetadataRoute } from "next"

const PRIVATE_PATHS = ["/api/*", "/admin/*", "/test-meta"]

/**
 * AI / generative-engine crawlers we explicitly allow. Listing them by name
 * (instead of relying only on `*`) makes the intent unambiguous and lets us
 * tighten policy per-bot later without affecting traditional search crawlers.
 */
const AI_BOTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "Bytespider",
  "Amazonbot",
  "Meta-ExternalAgent",
  "DuckAssistBot",
  "Cohere-AI",
  "YouBot",
]

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.434media.com"

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
      ...AI_BOTS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: PRIVATE_PATHS,
      })),
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  }
}

