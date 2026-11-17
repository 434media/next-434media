import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { requireAdmin, isCrmSuperAdmin } from "@/lib/auth"
import { checkAuthProject, isPreview } from "@/lib/preview-auth"
import { buildStagingSeed, writeStagingSeed, type SeedDb } from "@/lib/staging/seed"

/**
 * Loads the made-up staging records (lib/staging/seed.ts) into c434-staging, from a preview. The preview already holds
 * staging's keyless access, so no credential leaves Vercel (Security Policy 7.5: no secrets on a workstation).
 *
 * Exists on a preview only: on production or anywhere else it answers 404 before reading anything. On a preview it
 * needs the deployment to be fully on staging (checkAuthProject), a signed-in super admin (a staging test account), and
 * writeStagingSeed refuses any project but c434-staging. GET shows one button; POST seeds. The session cookie is
 * SameSite=Lax, so a POST from another site carries no session.
 */

function gate(): NextResponse | null {
  if (!isPreview()) return new NextResponse("Not found", { status: 404 })
  const check = checkAuthProject()
  if (!check.ok) return NextResponse.json({ error: "config_error", message: check.reason }, { status: 503 })
  return null
}

async function requireSuperAdmin(): Promise<NextResponse | null> {
  const auth = await requireAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!(await isCrmSuperAdmin(auth.session.email))) return NextResponse.json({ error: "Forbidden: super admin required" }, { status: 403 })
  return null
}

export async function GET() {
  const refused = gate() ?? (await requireSuperAdmin())
  if (refused) return refused
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Staging seed</title></head>
<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1rem">
<h1 style="font-size:1.25rem">Load made-up staging data</h1>
<p>Writes invented content posts (one video), leads, contacts and two roster members to <b>c434-staging</b>. Running it again overwrites the same records.</p>
<form method="post"><button type="submit" style="padding:.6rem 1.2rem;font-size:1rem">Load staging data</button></form>
</body></html>`
  return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8" } })
}

export async function POST(request: NextRequest) {
  const refused = gate() ?? (await requireSuperAdmin())
  if (refused) return refused
  try {
    const { getDb } = await import("@/lib/firebase-admin")
    const { keylessProjectId } = await import("@/lib/gcp-keyless")
    const counts = await writeStagingSeed(
      getDb() as unknown as SeedDb,
      keylessProjectId(),
      buildStagingSeed({ origin: request.nextUrl.origin }),
    )
    console.log(`[staging-seed] wrote ${JSON.stringify(counts)}`)
    return NextResponse.json({ ok: true, project: keylessProjectId(), written: counts })
  } catch (error) {
    console.error("[staging-seed] failed:", error)
    return NextResponse.json({ error: "seed_failed", message: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
