import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getDeckByShareId } from "@/lib/firestore-deck"
import { DeckViewer } from "./DeckViewer"

// Public, unlisted share view for a published sales deck. Reached only via the
// unguessable share_id. Draft or unknown decks 404. noindex — these are private
// share links, never meant to be crawled or listed.

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ shareId: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { shareId } = await params
  const deck = await getDeckByShareId(shareId).catch(() => null)

  if (!deck || deck.status !== "published") {
    return { title: "Deck not found | 434 Media", robots: { index: false, follow: false } }
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.434media.com"
  const url = `${baseUrl}/deck/${shareId}`
  return {
    title: `${deck.name} | 434 Media`,
    description: "A sales deck from 434 Media.",
    robots: { index: false, follow: false },
    openGraph: {
      title: deck.name,
      description: "A sales deck from 434 Media.",
      url,
      siteName: "434 MEDIA",
      type: "website",
    },
    twitter: { card: "summary_large_image", title: deck.name },
    alternates: { canonical: url },
  }
}

export default async function PublicDeckPage({ params }: Props) {
  const { shareId } = await params
  const deck = await getDeckByShareId(shareId).catch(() => null)
  if (!deck || deck.status !== "published") notFound()

  return <DeckViewer slides={deck.slides} name={deck.name} />
}
