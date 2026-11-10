import type { WorkRecord } from "@/lib/work-records"
import { RECORD_MEDIA } from "@/lib/work-media"

/**
 * The Work page's records as structured data: one CreativeWork per published
 * record, in the master's order, inside the page's CollectionPage.
 *
 * Until this, the CollectionPage named no works at all, so search engines and
 * agents could read "434 MEDIA has a portfolio" but not what is in it; the
 * titles existed only as page text. Every field here is one the Work page
 * already shows, from the public allowlist in lib/work-records.ts: the title
 * and description verbatim (Section 4), the commercial model, the categories,
 * the record's own site and its tile still. Nothing internal is read.
 */
export function buildWorkCollectionLd(records: readonly WorkRecord[], siteUrl: string) {
  const items = records.map((r, i) => {
    const tile = r.recordKey ? RECORD_MEDIA[r.recordKey]?.tile : undefined
    return {
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "CreativeWork",
        name: r.title,
        ...(r.description ? { description: r.description } : {}),
        genre: r.model,
        ...(r.categories ? { keywords: r.categories } : {}),
        ...(r.publicUrl ? { url: r.publicUrl } : {}),
        ...(tile?.wide ? { image: tile.wide } : {}),
        producer: { "@id": `${siteUrl}/#organization` },
      },
    }
  })

  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Our Work | 434 MEDIA",
    url: `${siteUrl}/work`,
    description:
      "Selected 434 MEDIA work organized by commercial model: original IP, platforms for brands, and productions for brands.",
    isPartOf: { "@id": `${siteUrl}/#website` },
    about: { "@id": `${siteUrl}/#organization` },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: items.length,
      itemListElement: items,
    },
  }
}
