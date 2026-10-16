/**
 * Owned Meta publisher connector — an MCP server for Smartie (a ChatGPT agent in Slack).
 *
 * ChatGPT custom connectors authenticate with OAuth 2.1 or not at all; they cannot send a static API key or
 * bearer header (OpenAI, "Authentication", developers.openai.com/plugins/build/auth, read 2026-10-16). Sign-in
 * reuses Polí's working setup (cos-crm-pilot): Auth0 as the authorization server, ChatGPT as a registered public
 * PKCE client, JWT verification by subject map — then the existing admin roster and send-role gate.
 * Tools require their own scope (lib/owned-meta-connector.ts TOOL_SCOPE). Built on mcp-handler, as
 * app/api/sor/mcp is. Configuration problems are reported by name only and fail closed.
 */
import type { AuthInfo } from "@modelcontextprotocol/server"
import { createMcpHandler, withMcpAuth } from "mcp-handler"
import { authorizeAdminSignIn, canSend, isCrmSuperAdmin } from "@/lib/auth"
import { loadConnectorConfig, remoteJwks, verifyConnectorToken } from "@/lib/owned-meta-oauth"
import { CONNECTOR_TOOLS, principalOf, toolSchema, TOOL_SCOPE } from "@/lib/owned-meta-connector"
import { runOwnedMetaTool } from "@/lib/owned-meta-tool-handler"
import { ownedMetaConnectorDeps } from "@/lib/owned-meta-execution"

export const runtime = "nodejs"
export const maxDuration = 300 // Canva export polling plus up to ten staged pages

const handler = createMcpHandler((server) => {
  for (const tool of CONNECTOR_TOOLS) {
    server.registerTool(tool.name, {
      title: tool.title,
      description: `${tool.description} Requires scope ${TOOL_SCOPE[tool.name]}.`,
      inputSchema: toolSchema(tool.name),
      annotations: { readOnlyHint: tool.readOnly, destructiveHint: false, openWorldHint: !tool.readOnly },
    }, async (args: unknown, extra: { http?: { authInfo?: AuthInfo } }) => {
      const principal = principalOf(extra?.http?.authInfo, tool.name)
      if (!principal) return { content: [{ type: "text" as const, text: JSON.stringify({ error: `This connection lacks scope ${TOOL_SCOPE[tool.name]}` }) }], isError: true }
      const result = await runOwnedMetaTool(tool.name, args, principal, await ownedMetaConnectorDeps())
      return { content: [{ type: "text" as const, text: JSON.stringify(result.body, null, 2) }], ...(result.status >= 400 ? { isError: true } : {}) }
    })
  }
})

let jwks: { url: string; get: () => ReturnType<ReturnType<typeof remoteJwks>> } | null = null
async function gated(req: Request) {
  // Previews never reach auth, storage or Meta, even if they share production Firestore.
  if (process.env.VERCEL_ENV !== "production") return Response.json({ error: "Previews cannot use the publisher connector" }, { status: 423 })
  const { config, problems } = loadConnectorConfig(process.env)
  if (!config) { console.error("[owned-meta-mcp] not configured:", problems.join(",")); return Response.json({ error: "Publisher connector is not configured" }, { status: 503 }) }
  if (!jwks || jwks.url !== config.jwksUrl) { const fn = remoteJwks(config.jwksUrl); jwks = { url: config.jwksUrl, get: fn } }
  const keys = jwks
  return withMcpAuth(handler, (_req, bearer) => verifyConnectorToken(bearer, {
    config, jwks: keys.get,
    authorize: email => authorizeAdminSignIn(email, "google"),
    sendCapable: async (email, role) => canSend(role) || await isCrmSuperAdmin(email),
    nowSeconds: () => Math.floor(Date.now() / 1000),
    onRefuse: reason => console.warn("[owned-meta-mcp] refused:", reason),
  }), { required: true, resourceMetadataPath: "/api/owned-meta/oauth-protected-resource" })(req)
}
export { gated as GET, gated as POST }
