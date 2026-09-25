import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getTravelItinerary } from "@/lib/travel/airtable"
import { getTravelAccess } from "@/lib/travel/auth"
import { getTravelProject } from "@/lib/travel/projects"
import TravelItinerary from "@/components/travel/TravelItinerary"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "AJ — BVC AGM Travel",
  description: "Protected production travel itinerary.",
  robots: { index: false, follow: false, nocache: true },
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
      project={{
        client: config.project.client,
        purpose: config.project.purpose,
        year: config.project.year,
        startDate: config.project.startDate,
        endDate: config.project.endDate,
      }}
      traveler={{
        displayName: config.traveler.displayName,
        routeStops: [...config.traveler.routeStops],
      }}
    />
  )
}
