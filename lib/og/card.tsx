import { ImageResponse } from "next/og"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { BRAND } from "@/lib/seo/brand"
import { COLOR } from "@/lib/visual/tokens.generated"

/**
 * The one social share card (Display and Design Standard 3.8).
 *
 * Every 434 card is this layout: the site card's treatment, which 3.8 names as
 * the one a new card starts from. A white field with the 6% dot grid; the
 * primary lockup at the top; the headline in Geist 800 and a line of
 * description; a rule, then the page's address and the location.
 *
 * Replaces four treatments: the site card, the cyan /api/og card, the
 * indigo-violet blog cards, and the per-page fallbacks. Two of those were off
 * the palette, and all of them typed "434 MEDIA" (or a "434" tile) as text,
 * which the visual system forbids: the logo is artwork. Here it is the
 * supplied SVG, public/brand/434-primary-dark.svg, at 264px wide, well above
 * its 72px digital minimum, with the 72px padding as its clear space.
 *
 * Colours are the palette's, read from lib/visual/tokens.generated.ts, not
 * typed. Satori cannot read CSS custom properties, so the generated TS export
 * is the route the tokens reach an image by.
 */

export const OG_SIZE = { width: 1200, height: 630 }

const LOGO_WIDTH = 264
// The lockup's own ratio: viewBox 1720.77 × 150.75.
const LOGO_HEIGHT = Math.round((LOGO_WIDTH * 150.75) / 1720.7695)

const fontPath = (file: string) => path.join(process.cwd(), "fonts", file)
const assetPath = (file: string) => path.join(process.cwd(), "public", file)

let assets: Promise<{ fonts: Buffer[]; logo: string }> | null = null
function loadAssets() {
  assets ??= Promise.all([
    readFile(fontPath("Geist-Regular.otf")),
    readFile(fontPath("Geist-SemiBold.otf")),
    readFile(fontPath("Geist-ExtraBold.otf")),
    readFile(assetPath("brand/434-primary-dark.svg")),
  ]).then(([g400, g600, g800, svg]) => ({
    fonts: [g400, g600, g800],
    logo: `data:image/svg+xml;base64,${svg.toString("base64")}`,
  }))
  return assets
}

// The headline steps down as it grows, so a long article title still fits
// three lines without being cut. 96px is the site card's size.
function headlineSize(text: string) {
  if (text.length <= 22) return 96
  if (text.length <= 44) return 72
  if (text.length <= 80) return 56
  return 46
}

function clamp(text: string, max: number) {
  const t = text.replace(/\s+/g, " ").trim()
  return t.length <= max ? t : `${t.slice(0, max - 1).replace(/\s+\S*$/, "")}…`
}

export interface CardOptions {
  /** A short label above the headline: "The Feed", "Blog", a category. */
  kicker?: string
  headline: string
  description?: string
  /** The page's path, shown after the domain in the footer. "/" or omitted is the domain alone. */
  path?: string
  /** A detail for the footer's right side; the location when omitted. */
  footerRight?: string
}

export async function renderCard({ kicker, headline, description, path: pagePath, footerRight }: CardOptions) {
  const { fonts, logo } = await loadAssets()
  const [g400, g600, g800] = fonts

  // The footer names the page's section, not its full path: an article slug
  // is long enough to wrap into the right-hand detail. One slash between the
  // domain and the section, however the caller wrote it; The Feed's card used
  // to read "www.434media.com//thefeed".
  const section = (pagePath ?? "").replace(/^\/+/, "").split(/[/?#]/)[0]
  const address = section ? `${BRAND.domain}/${section}` : BRAND.domain
  const title = clamp(headline, 110)

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: COLOR.white,
        padding: 72,
        fontFamily: "Geist",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.06,
          backgroundImage: `radial-gradient(circle, ${COLOR["color-02-black"]} 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
          display: "flex",
        }}
      />

      {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders <img>, not next/image */}
      <img src={logo} width={LOGO_WIDTH} height={LOGO_HEIGHT} alt="" style={{ zIndex: 1 }} />

      <div style={{ display: "flex", flexDirection: "column", zIndex: 1 }}>
        {kicker && (
          <div
            style={{
              color: COLOR["color-03"],
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: 4,
              textTransform: "uppercase",
              marginBottom: 20,
            }}
          >
            {clamp(kicker, 48)}
          </div>
        )}
        <div
          style={{
            color: COLOR["color-02-black"],
            fontSize: headlineSize(title),
            fontWeight: 800,
            lineHeight: 1.02,
            letterSpacing: headlineSize(title) >= 72 ? -3 : -1.5,
            maxWidth: 1056,
          }}
        >
          {title}
        </div>
        {description && (
          <div
            style={{
              marginTop: 28,
              color: COLOR["color-03"],
              fontSize: 26,
              fontWeight: 400,
              lineHeight: 1.4,
              maxWidth: 980,
            }}
          >
            {clamp(description, 150)}
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: `1px solid ${COLOR["color-04"]}`,
          paddingTop: 24,
          zIndex: 1,
        }}
      >
        <div style={{ color: COLOR["color-02-black"], fontSize: 22, fontWeight: 600, whiteSpace: "nowrap" }}>
          {address}
        </div>
        <div style={{ color: COLOR["color-03"], fontSize: 18, fontWeight: 600, letterSpacing: 3, whiteSpace: "nowrap" }}>
          {footerRight ?? BRAND.location}
        </div>
      </div>
    </div>,
    {
      ...OG_SIZE,
      fonts: [
        { name: "Geist", data: g400, style: "normal", weight: 400 },
        { name: "Geist", data: g600, style: "normal", weight: 600 },
        { name: "Geist", data: g800, style: "normal", weight: 800 },
      ],
    },
  )
}
