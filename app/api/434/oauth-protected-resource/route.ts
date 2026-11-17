import { generateProtectedResourceMetadata, metadataCorsOptionsRequestHandler } from "mcp-handler"
import { loadConnectorConfig } from "@/lib/owned-meta-oauth"
import { CONNECTOR_434_ENV_PREFIX, CONNECTOR_434_SCOPE } from "@/lib/connector-434/tools"

/** RFC 9728 protected-resource metadata for the 434 connector; advertised on every 401. Off until configured. */
export function GET() {
  const { config } = loadConnectorConfig(process.env, CONNECTOR_434_ENV_PREFIX)
  if (process.env.VERCEL_ENV !== "production" || !config) return Response.json({ error: "The 434 connector is not switched on" }, { status: 503 })
  return Response.json(generateProtectedResourceMetadata({ authServerUrls: [config.issuer], resourceUrl: config.audience, additionalMetadata: { scopes_supported: [CONNECTOR_434_SCOPE] } }), { headers: { "access-control-allow-origin": "*", "cache-control": "max-age=300" } })
}
const options = metadataCorsOptionsRequestHandler()
export { options as OPTIONS }
