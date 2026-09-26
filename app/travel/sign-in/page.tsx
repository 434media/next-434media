import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getTravelAccess } from "@/lib/travel/auth"
import { getTravelProject } from "@/lib/travel/projects"
import TravelSignIn from "./travel-sign-in"

export const metadata: Metadata = {
  title: "Travel access",
  description: "Access required. Sign in to view.",
  robots: { index: false, follow: false },
  // A link that redirects here must not fall back to the brand card either.
  openGraph: { type: "website", title: "Production travel itinerary", description: "Access required. Sign in to view." },
  twitter: { card: "summary_large_image", title: "Production travel itinerary", description: "Access required. Sign in to view." },
}

export default async function TravelSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next = "/travel/bvc-agm-2026/aj" } = await searchParams
  const match = next.match(/^\/travel\/([a-z0-9-]+)\/([a-z0-9-]+)$/)
  if (!match || !getTravelProject(match[1], match[2])) notFound()
  const [, projectSlug, travelerSlug] = match
  if (await getTravelAccess(projectSlug, travelerSlug)) redirect(next)
  return <TravelSignIn projectSlug={projectSlug} travelerSlug={travelerSlug} nextPath={next} />
}
