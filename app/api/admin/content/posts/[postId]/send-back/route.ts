import { NextResponse, type NextRequest } from "next/server"
import { requireContentRunner } from "../../../../content-pipeline/auth"
import { getContentPostById, sendBackToReview } from "@/lib/firestore-crm"
import { MetaBlocked } from "@/lib/owned-meta-publisher"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/admin/content/posts/[postId]/send-back — Send back to Review (plan v11.1 Step 3 part 2): an approved or
 * scheduled post goes back to Review with its approval withdrawn. A publisher approval is revoked on its batch, so the
 * post can't be published until it is approved again; a hand-post approval stops covering it. Refused (409) once
 * anything of the post is out or publishing has started. Gate: the admin gate plus the content permission, the people
 * who approve. Production-only, like the drawer's other writes (previews may share production Firestore).
 */
const POST_ID = /^[A-Za-z0-9_-]{8,64}$/

export async function POST(_req: NextRequest, ctx: { params: Promise<{ postId: string }> }) {
  const auth = await requireContentRunner()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const postId = (await ctx.params).postId ?? ""
  if (!POST_ID.test(postId)) return NextResponse.json({ error: "Unknown post" }, { status: 400 })
  if (process.env.VERCEL_ENV !== "production") return NextResponse.json({ error: "Sending back happens on the live site only" }, { status: 423 })
  const email = auth.session.email.toLowerCase(), name = auth.session.name?.trim() || auth.session.email
  try {
    await sendBackToReview(postId, { email, name })
    console.info("[content/send-back]", JSON.stringify({ by: email, post: postId }))
    return NextResponse.json({ post: await getContentPostById(postId) })
  } catch (err) {
    if (err instanceof MetaBlocked) return NextResponse.json({ error: err.message }, { status: /not found/i.test(err.message) ? 404 : 409 })
    console.error("[POST /api/admin/content/posts/send-back] failed:", postId, err)
    return NextResponse.json({ error: "Could not send the post back; reload and try again" }, { status: 500 })
  }
}
