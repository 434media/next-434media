/**
 * RFC 9728 protected-resource metadata for the content MCP route, so an OAuth
 * client (ChatGPT) can discover the authorization server from a 401 challenge.
 * The issuer is configuration; nothing here holds a credential.
 */
import { metadataCorsOptionsRequestHandler, generateProtectedResourceMetadata } from "mcp-handler"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
const CONTENT_MCP_SCOPES =["content:read", "content:write", "content:approve", "meta:read", "meta:publish"]

export async function GET() {
  const issuer = process.env.CONTENT_MCP_ISSUER, resourceUrl = process.env.CONTENT_MCP_AUDIENCE
  if (!issuer || !resourceUrl) return NextResponse.json({ error: "Content MCP OAuth is not configured" }, { status: 404 })
  const metadata = generateProtectedResourceMetadata({ authServerUrls: [issuer], resourceUrl, additionalMetadata: { scopes_supported: CONTENT_MCP_SCOPES, bearer_methods_supported: ["header"] } })
  return NextResponse.json(metadata, { headers: { "cache-control": "public, max-age=300" } })
}
export const OPTIONS = metadataCorsOptionsRequestHandler()
