import { redirect } from "next/navigation"

// The old /admin/inbox was retired on 2026-11-17 (one work area, V1 item 4): website inquiries are answered in the
// People Inbox. This address stays so links in earlier new-inquiry emails and bookmarks still land somewhere useful.
export default async function OldInboxRedirect({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const search = (await searchParams).search
  const q = typeof search === "string" && search ? `&search=${encodeURIComponent(search)}` : ""
  redirect(`/admin/people?tab=inbox${q}`)
}
