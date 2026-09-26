import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getTravelItinerary } from "@/lib/travel/airtable"
import { canReadEditorNotes, getTravelAccess } from "@/lib/travel/auth"
import { getTravelProject } from "@/lib/travel/projects"
import TravelItinerary from "@/components/travel/TravelItinerary"

export const dynamic = "force-dynamic"

/**
 * A link preview is rendered by services the recipient does not control, and is
 * often cached past the page's own access rules. So the card names the purpose
 * and nothing else: no client, no traveller, no dates. Defining openGraph and
 * twitter here also replaces the site-wide brand card, since metadata merges
 * shallowly and a nested segment overwrites what an ancestor defined.
 */
const CARD_TITLE = "Production travel itinerary"
const CARD_DESCRIPTION = "Access required. Sign in to view."

export const metadata: Metadata = {
  title: CARD_TITLE,
  description: CARD_DESCRIPTION,
  robots: { index: false, follow: false, nocache: true },
  openGraph: { type: "website", title: CARD_TITLE, description: CARD_DESCRIPTION },
  twitter: { card: "summary_large_image", title: CARD_TITLE, description: CARD_DESCRIPTION },
}

export default async function TravelPage({
  params,
}: {
  params: Promise<{ project: string; traveler: string }>
}) {
  const { project: projectSlug, traveler: travelerSlug } = await params
  const config = getTravelProject(projectSlug, travelerSlug)
  if (!config) notFound()
  const viewer = await getTravelAccess(projectSlug, travelerSlug)
  if (!viewer) {
    redirect(`/travel/sign-in?next=${encodeURIComponent(`/travel/${projectSlug}/${travelerSlug}`)}`)
  }
  const itinerary = await getTravelItinerary({
    baseId: config.project.airtableBaseId,
    projectSlug,
    travelerSlug,
    startDate: config.project.startDate,
    endDate: config.project.endDate,
  })
  return (
    <TravelItinerary
      initialItinerary={itinerary}
      canReadEditorNotes={canReadEditorNotes(viewer)}
      project={{
        client: config.project.client,
        purpose: config.project.purpose,
        year: config.project.year,
        startDate: config.project.startDate,
        endDate: config.project.endDate,
      }}
      traveler={{
        name: config.traveler.name,
        displayName: config.traveler.displayName,
        routeStops: [...config.traveler.routeStops],
      }}
    />
  )
}
