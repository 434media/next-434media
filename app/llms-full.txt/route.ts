import { buildLlmsFullTxt } from "@/lib/seo/llms"

// The long form of /llms.txt: every published work record in full, with the
// services and FAQ answers. Same sources, same build-time rendering.
export const dynamic = "force-static"

export function GET() {
  return new Response(buildLlmsFullTxt(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
