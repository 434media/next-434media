import { buildLlmsTxt } from "@/lib/seo/llms"

// Built from the generated brand strings and work records (lib/seo/llms.ts),
// so it follows the master and the record seed when they are regenerated.
// Nothing here reads the request, so it is rendered once at build time.
export const dynamic = "force-static"

export function GET() {
  return new Response(buildLlmsTxt(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
