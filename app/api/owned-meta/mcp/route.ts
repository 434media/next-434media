/**
 * Owned Meta publisher connector — an MCP server for Smartie (a ChatGPT agent in Slack).
 *
 * ChatGPT custom connectors authenticate with OAuth 2.1 or not at all; they cannot send
 * a static API key or bearer header (OpenAI, "Authentication", developers.openai.com/
 * plugins/build/auth, read 2026-10-16). So this route uses OAuth with Google as the
 * authorization server — the same identity provider as admin sign-in — and the same
 * admin roster and send-capable role gate as the admin publisher route.
 * See lib/owned-meta-oauth.ts. Built on mcp-handler, as app/api/sor/mcp is.
 */
import type { AuthInfo } from "@modelcontextprotocol/server"
import { createMcpHandler, withMcpAuth } from "mcp-handler"
import { authorizeAdminSignIn, canSend, isCrmSuperAdmin } from "@/lib/auth"
import { connectorClientIds, verifyConnectorToken } from "@/lib/owned-meta-oauth"
import { CONNECTOR_TOOLS, principalOf, toolSchema } from "@/lib/owned-meta-connector"
import { runOwnedMetaTool } from "@/lib/owned-meta-tool-handler"
import { ownedMetaConnectorDeps } from "@/lib/owned-meta-execution"

export const runtime = "nodejs"
export const maxDuration = 60

const handler = createMcpHandler((server) => {
  for (const tool of CONNECTOR_TOOLS) {
    server.registerTool(tool.name, {
      title: tool.title,
      description: tool.description,
      inputSchema: toolSchema(tool.name),
      annotations: { readOnlyHint: tool.readOnly, destructiveHint: false, openWorldHint: !tool.readOnly },
    }, async (args: unknown, extra: { http?: { authInfo?: AuthInfo } }) => {
      const principal = principalOf(extra?.http?.authInfo)
      if (!principal) return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Sign-in required" }) }], isError: true }
      const result = await runOwnedMetaTool(tool.name, args, principal, await ownedMetaConnectorDeps())
      return { content: [{ type: "text" as const, text: JSON.stringify(result.body, null, 2) }], ...(result.status >= 400 ? { isError: true } : {}) }
    })
  }
})

const authed = withMcpAuth(handler, (_req, bearer) => verifyConnectorToken(bearer, {
  clientIds: connectorClientIds(process.env.OWNED_META_CONNECTOR_GOOGLE_CLIENT_IDS),
  fetcher: fetch,
  authorize: email => authorizeAdminSignIn(email, "google"),
  sendCapable: async (email, role) => canSend(role) || await isCrmSuperAdmin(email),
  nowSeconds: () => Math.floor(Date.now() / 1000),
}), { required: true, resourceMetadataPath: "/api/owned-meta/oauth-protected-resource" })

// Previews never reach auth, storage or Meta, even if they share production Firestore.
async function gated(req: Request) {
  if (process.env.VERCEL_ENV !== "production") return Response.json({ error: "Previews cannot use the publisher connector" }, { status: 423 })
  return authed(req)
}
export { gated as GET, gated as POST }
