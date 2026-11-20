/**
 * Security headers for every response (434 security log SW-9).
 *
 * The Content-Security-Policy is built from what the site loads (read 2026-11-20 from the code and from the live
 * home page's requests):
 *  - Public trackers (components/PublicTrackers.tsx, components/MetaPixel.tsx): Google Tag Manager and gtag, the
 *    Google Ads conversion tags GTM loads (doubleclick, googleadservices, www.google.com), LinkedIn Insight, Meta Pixel.
 *    A new GTM tag from another vendor needs its origin added here, or the browser blocks it.
 *  - Firebase email/password sign-in for /admin and /travel (identitytoolkit, securetoken). No popup, so no auth iframe.
 *  - Vercel Blob client uploads (vercel.com/api/blob, *.blob.vercel-storage.com); BotID is first-party.
 *  - Video: same-origin hero files, Cloud Storage and Blob; YouTube and Vimeo embeds.
 *  - Images: any https source, because admin pages render entered URLs and Instagram's CDN hosts vary.
 *  - Form posts: this origin and the Shopify store (checkout).
 *  - On preview deployments only, the Vercel toolbar (vercel.live).
 * script-src keeps 'unsafe-inline': Next.js and the tracker snippets are inline, and the public pages are
 * prerendered, so a per-request nonce would make every page dynamic. Framing is allowed from this origin only.
 */
const isPreview = process.env.VERCEL_ENV === "preview"
// The cart's checkout server action redirects to the Shopify store (components/shopify/cart/actions.ts); without
// JavaScript that redirect follows a form post, so form-action names the store too.
const shopifyStore = process.env.SHOPIFY_STORE_DOMAIN?.replace(/^https?:\/\//, "").replace(/\/.*$/, "")
const toolbar = (...sources: string[]) => (isPreview ? sources : [])

const csp: Record<string, string[]> = {
  "default-src": ["'self'"],
  "script-src": [
    "'self'",
    "'unsafe-inline'",
    "https://www.googletagmanager.com",
    "https://*.googletagmanager.com",
    "https://www.google-analytics.com",
    "https://googleads.g.doubleclick.net",
    "https://www.googleadservices.com",
    "https://www.google.com",
    "https://snap.licdn.com",
    "https://connect.facebook.net",
    ...toolbar("https://vercel.live"),
  ],
  "connect-src": [
    "'self'",
    "https://identitytoolkit.googleapis.com",
    "https://securetoken.googleapis.com",
    "https://*.google-analytics.com",
    "https://*.analytics.google.com",
    "https://*.googletagmanager.com",
    "https://www.google.com",
    "https://*.doubleclick.net",
    "https://www.googleadservices.com",
    "https://px.ads.linkedin.com",
    "https://www.facebook.com",
    "https://connect.facebook.net",
    "https://vercel.com",
    "https://*.blob.vercel-storage.com",
    ...toolbar("https://vercel.live", "wss://ws-us3.pusher.com"),
  ],
  "img-src": ["'self'", "data:", "blob:", "https:"],
  "media-src": ["'self'", "blob:", "https://storage.googleapis.com", "https://*.public.blob.vercel-storage.com"],
  "frame-src": [
    "https://www.youtube.com",
    "https://www.youtube-nocookie.com",
    "https://player.vimeo.com",
    "https://www.googletagmanager.com",
    "https://td.doubleclick.net",
    ...toolbar("https://vercel.live"),
  ],
  "style-src": ["'self'", "'unsafe-inline'", ...toolbar("https://vercel.live")],
  "font-src": ["'self'", "data:", ...toolbar("https://vercel.live", "https://assets.vercel.com")],
  "worker-src": ["'self'", "blob:"],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'", "https://*.myshopify.com", ...(shopifyStore ? [`https://${shopifyStore}`] : [])],
  "frame-ancestors": ["'self'"],
  "upgrade-insecure-requests": [],
}

export const contentSecurityPolicy = Object.entries(csp)
  .map(([directive, sources]) => [directive, ...sources].join(" "))
  .join("; ")

export const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
]
