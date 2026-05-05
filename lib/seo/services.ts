/**
 * Canonical list of 434 MEDIA services for schema.org/Service JSON-LD.
 * Used on the homepage and /work to expose service offerings to AI search and traditional SEO.
 */

export interface ServiceEntity {
  name: string
  serviceType: string
  description: string
  /** Optional anchor or sub-path within the site that best represents this service. */
  url?: string
}

export const SERVICES: ServiceEntity[] = [
  {
    name: "Brand Storytelling",
    serviceType: "Brand Storytelling",
    description:
      "Narrative-first brand strategy and storytelling that turns enterprise positioning into audience-moving content for VCs, accelerators, and category-defining startups.",
  },
  {
    name: "Video Production",
    serviceType: "Video Production",
    description:
      "Full-service video production — from concept and scripting to multi-camera shoots, post-production, and distribution-ready cuts for events, brand films, and ad campaigns.",
  },
  {
    name: "Web Development",
    serviceType: "Web Development",
    description:
      "Modern, performant marketing sites and web platforms built on Next.js with measurable conversion goals, analytics instrumentation, and accessibility built in.",
  },
  {
    name: "Event Production",
    serviceType: "Event Production",
    description:
      "Programming, run-of-show, on-site capture, and post-event amplification for summits, accelerator demo days, and industry conferences across South Texas.",
  },
  {
    name: "Programmatic & OTT/CTV Advertising",
    serviceType: "Programmatic Advertising",
    description:
      "Audience-targeted programmatic, OTT, and connected-TV media buying with creative production and performance reporting tied to enterprise KPIs.",
  },
  {
    name: "Multichannel Marketing Strategy",
    serviceType: "Marketing Strategy",
    description:
      "Integrated multichannel campaigns spanning paid media, social, email, and content — sequenced to brand, demand, and pipeline objectives.",
  },
  {
    name: "Content Strategy & Production",
    serviceType: "Content Marketing",
    description:
      "Editorial planning, on-brand content production, and distribution playbooks for B2B brands building durable audience and category authority.",
  },
  {
    name: "Social Media Management",
    serviceType: "Social Media Marketing",
    description:
      "Channel-native strategy, content production, and community engagement across Instagram, LinkedIn, X, and emerging platforms.",
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
      { "@type": "Place", name: "South Texas" },
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
