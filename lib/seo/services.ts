/**
 * Canonical list of 434 MEDIA services for schema.org/Service JSON-LD.
 * Used on the homepage and /work to expose service offerings to AI search and traditional SEO.
 *
 * Each entry is a master 2.4–2.7 scope, in master wording. The platform
 * definition is read from the generated 4.3 extract; the others quote the
 * master section named beside them, verbatim. Nothing here may claim media
 * buying, distribution or ad services (1.8, 2.11; 9.7 puts those concepts on
 * the Distribution page), and digital infrastructure appears only as 2.7
 * frames it, never as standalone web development.
 */
import { COMMERCIAL_MODEL_DEFINITIONS } from "@/lib/commercial-models"

export interface ServiceEntity {
  name: string
  serviceType: string
  description: string
  /** Optional anchor or sub-path within the site that best represents this service. */
  url?: string
}

export const SERVICES: ServiceEntity[] = [
  {
    name: "Content",
    serviceType: "Content production",
    // 2.4, first paragraph, verbatim.
    description:
      "434 produces individual and episodic media, including films, short films, commercials, brand films, documentaries, interviews, podcasts, branded series, broadcasts, event coverage, social content, and other short- or long-form units.",
  },
  {
    name: "Experiences",
    serviceType: "Experience production",
    // 2.5, first paragraph, verbatim.
    description:
      "434 produces live and recorded experiences, including events, conferences, performances, panels, broadcasts, activations, and sponsor-led programs.",
  },
  {
    name: "Platforms for Brands",
    serviceType: "Platform production",
    // 1.7 / 4.3, from the generated extract (2.6's own list names distribution).
    description: COMMERCIAL_MODEL_DEFINITIONS["Platforms for Brands"],
  },
  {
    name: "Digital infrastructure",
    serviceType: "Digital infrastructure",
    // 2.7, first sentence, verbatim.
    description:
      "Digital infrastructure qualifies as 434 work when it is purpose-built for, or functions as an integrated part of, a production, experience, platform, campaign, or approved program.",
  },
]

/**
 * Build a schema.org/Service object for an individual offering, linked
 * to the LocalBusiness entity defined in the root layout via @id.
 */
export function buildServiceLd(service: ServiceEntity, siteUrl: string) {
  return {
    "@type": "Service",
    name: service.name,
    serviceType: service.serviceType,
    description: service.description,
    provider: { "@id": `${siteUrl}/#localbusiness` },
    areaServed: [
      { "@type": "City", name: "San Antonio" },
      { "@type": "State", name: "Texas" },
    ],
    ...(service.url ? { url: service.url } : {}),
  }
}

/**
 * Build a schema.org/ItemList of Service entries — preferred shape when
 * declaring a catalog of offerings on a single page.
 */
export function buildServicesItemListLd(siteUrl: string, listUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "434 MEDIA Services",
    url: listUrl,
    itemListElement: SERVICES.map((service, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      item: buildServiceLd(service, siteUrl),
    })),
  }
}
