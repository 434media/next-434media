import type { Metadata } from "next"
import { forbidden } from "next/navigation"
import RefreshWhenSignedIn from "@/components/admin/RefreshWhenSignedIn"
import { ReviewQueue } from "@/components/admin/review/ReviewQueue"
import { founderPageAccess } from "@/lib/founder-guard"

// The founder-review queue and the console (V1 item 4, the proof slice; build plan v3 R2: "Approvals happen in the
// signed-in admin's founder-review queue"). Founder only, guarded here on the server before anything renders, as the
// finance page is; the queue loads in the browser from GET /api/admin/review, which runs the same guard.
export const metadata: Metadata = {
  title: "Review",
  robots: { index: false, follow: false },
}

export default async function ReviewPage() {
  const access = await founderPageAccess("/admin/review")
  if (access === "signed_out") return <RefreshWhenSignedIn />
  if (access === "forbidden") forbidden()
  return <ReviewQueue />
}
