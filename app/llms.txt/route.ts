import { BRAND_RECORDS } from "@/lib/brand-records"

// Served from the canonical brand strings rather than a static file, so the
// summary and the Home description follow the master when lib/brand-records.ts
// is regenerated. Nothing here reads the request, so the response is rendered
// once at build time.
export const dynamic = "force-static"

const LLMS_TXT = `# 434 MEDIA

> ${BRAND_RECORDS.canonicalDefinition}

- Headquarters: 816 Camaron St., Suite 1.11, San Antonio, TX 78212
- Contact: build@434media.com
- Founded and operated as 434 Media

## Key pages

- [Home](https://www.434media.com/): ${BRAND_RECORDS.shortDescriptor}
- [Blog](https://www.434media.com/blog)
- [Events](https://www.434media.com/events): Upcoming and recent community and industry events.
- [Shop](https://www.434media.com/shop): TXMX Boxing premium apparel rooted in Texas-Mexico boxing culture.
- [Contact](https://www.434media.com/contact): Start a project conversation.

## Sub-brands and initiatives

- TXMX Boxing — boxing-inspired apparel and content celebrating Texas-Mexico fight culture.
- SDOH — bilingual education on the social determinants of health.
- VemosVamos, AMPD Project, Salute to Troops, DEVSA TV — additional production initiatives.

## Machine-readable resources

- [Sitemap](https://www.434media.com/sitemap.xml)
- [Robots](https://www.434media.com/robots.txt)
`

export function GET() {
  return new Response(LLMS_TXT, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
