import { generateProtectedResourceMetadata, metadataCorsOptionsRequestHandler } from "mcp-handler"
import { loadConnectorConfig } from "@/lib/owned-meta-oauth"

/** RFC 9728 protected-resource metadata for the publisher connector; advertised on every 401. */
export function GET() {
  const { config } = loadConnectorConfig(process.env)
  if (process.env.VERCEL_ENV !== "production" || !config) return Response.json({ error: "Publisher connector is not configured" }, { status: 503 })
  return Response.json(generateProtectedResourceMetadata({ authServerUrls: [config.issuer], resourceUrl: config.audience, additionalMetadata: { scopes_supported: ["owned-meta:read", "owned-meta:write", "owned-meta:publish"] } }), { headers: { "access-control-allow-origin": "*", "cache-control": "max-age=300" } })
}
const options = metadataCorsOptionsRequestHandler()
export { options as OPTIONS }
