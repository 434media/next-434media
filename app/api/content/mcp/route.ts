/**
 * Content publishing connector — the MCP surface Smartie uses to export an
 * approved Canva design, stage it, prepare the publisher review, record the
 * founder's approval, publish through the owned Meta publisher and read back
 * verified links. Same hosting method as app/api/sor/mcp/route.ts.
 *
 * Auth: OAuth bearer (RS256 JWT from CONTENT_MCP_ISSUER for audience
 * CONTENT_MCP_AUDIENCE) for ChatGPT/Smartie, or the existing
 * SOR_MCP_TOKEN_INTERNAL static token in read-only scopes. The tool logic is
 * in lib/content-mcp-tools.ts; this file only binds it to Firestore, Blob,
 * Canva and the publisher actions.
 */
import type { AuthInfo } from "@modelcontextprotocol/server"
import { createMcpHandler, withMcpAuth } from "mcp-handler"
import { z } from "zod4"
import { put } from "@vercel/blob"
import { isCrmSuperAdmin } from "@/lib/auth"
import { getContentPosts, getContentPostById, createContentPost, findContentPostByCanvaDesignId, attachStagedExport, canvaTokenStore, decideOwnedMeta } from "@/lib/firestore-crm"
import { createCanvaClient } from "@/lib/canva-connect"
import { createContentAuthVerifier, type ContentAuth } from "@/lib/content-mcp-auth"
import { createContentTools } from "@/lib/content-mcp-tools"
import { runOwnedMetaAction, ownedMetaStatus, ownedMetaConnectionReport, ownedMetaCredentialHealth, sourceOrigins } from "@/lib/owned-meta-actions"
import { META_BRANDS } from "@/lib/owned-meta-publisher"

export const maxDuration = 120
export const runtime = "nodejs"

const tools = createContentTools({
  listPosts: getContentPosts,
  getPost: getContentPostById,
  findByDesign: findContentPostByCanvaDesignId,
  createPost: createContentPost,
  attachStaged: attachStagedExport,
  canva: () => (process.env.CANVA_CLIENT_ID && process.env.CANVA_CLIENT_SECRET ? createCanvaClient({ clientId: process.env.CANVA_CLIENT_ID, clientSecret: process.env.CANVA_CLIENT_SECRET, store: canvaTokenStore() }) : null),
  writeBlob: async (pathname, bytes, contentType) => put(pathname, Buffer.from(bytes), { access: "public", addRandomSuffix: false, contentType }),
  fetcher: fetch,
  isSuperAdmin: isCrmSuperAdmin,
  decide: decideOwnedMeta,
  runAction: runOwnedMetaAction,
  status: ownedMetaStatus,
  connection: ownedMetaConnectionReport,
  credentialHealth: ownedMetaCredentialHealth,
  allowedOrigins: sourceOrigins,
})

const authOf = (info?: AuthInfo): ContentAuth | undefined => info?.extra?.content as ContentAuth | undefined
const json = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }], ...(value && typeof value === "object" && (value as { ok?: boolean }).ok === false ? { isError: true } : {}) })
const brand = z.enum(META_BRANDS)
const status = z.enum(["ai_drafted", "to_do", "planning", "in_progress", "needs_approval", "approved", "rejected", "scheduled", "posted"])
const social = z.enum(["instagram", "youtube", "tiktok", "linkedin", "facebook"])

const handler = createMcpHandler((server) => {
  server.registerTool("find_content_records", {
    description: "Find CRM content records by id, Canva design id, exact title or status. Bounded to 20 rows. Read-only.",
    inputSchema: z.object({ id: z.string().optional(), canva_design_id: z.string().optional(), title: z.string().optional(), status: z.array(status).optional() }),
  }, async (args, extra) => json(await tools.find_content_records(authOf(extra?.http?.authInfo), args)))

  server.registerTool("create_content_record", {
    description: "Create a content record for a Canva design, or return the existing one bound to that design (or an unposted exact-title match). Never creates a duplicate and never replaces a posted record.",
    inputSchema: z.object({ title: z.string().min(1), canva_design_id: z.string().min(6), user: z.string().min(1), social_platforms: z.array(social).min(1), platform: z.string().optional(), social_copy: z.string().optional(), notes: z.string().optional(), date_to_post: z.string().optional() }),
  }, async (args, extra) => json(await tools.create_content_record(authOf(extra?.http?.authInfo), args as Parameters<typeof tools.create_content_record>[1])))

  server.registerTool("stage_canva_export", {
    description: "Export the Canva design as JPEG pages, measure and hash them, store them as the record's assets and return the export_fingerprint an approval must name. Idempotent for identical exports. Canva remains the source; nothing is published.",
    inputSchema: z.object({ content_post_id: z.string().min(1), canva_design_id: z.string().min(6), quality: z.number().int().min(1).max(100).optional() }),
  }, async (args, extra) => json(await tools.stage_canva_export(authOf(extra?.http?.authInfo), args)))

  server.registerTool("prepare_meta_batch", {
    description: "Create the immutable publisher review (manifest + hash) from the staged export. Requires the fingerprint returned by stage_canva_export. Returns preflight blockers per destination. Does not approve or publish.",
    inputSchema: z.object({ content_post_id: z.string().min(1), expected_fingerprint: z.string().length(64), brand, format: z.enum(["still", "carousel", "video"]), captions: z.object({ instagram: z.string(), facebook: z.string() }), ai_generated: z.boolean(), instagram_share_to_feed: z.boolean().optional(), template_revision: z.string().optional() }),
  }, async (args, extra) => json(await tools.prepare_meta_batch(authOf(extra?.http?.authInfo), args)))

  server.registerTool("approve_meta_batch", {
    description: "Record the founder's approval (or rejection) of one exact revision and hash. Only a CRM super admin identified by the token may call this. Approval is written once per revision.",
    inputSchema: z.object({ content_post_id: z.string().min(1), expected_revision: z.number().int().min(1), expected_hash: z.string().length(64), decision: z.enum(["approved", "rejected"]), note: z.string().max(2000).optional() }),
  }, async (args, extra) => json(await tools.approve_meta_batch(authOf(extra?.http?.authInfo), args)))

  server.registerTool("publish_meta_batch", {
    description: "Run the owned Meta publisher for an approved batch: resumes saved containers, continues processing, publishes each destination at most once, verifies and returns permalinks. Reports manual_required destinations as unsupported without blocking the others. If publication is 'uncertain', do not retry.",
    inputSchema: z.object({ content_post_id: z.string().min(1), batch_id: z.string().min(1), hash: z.string().length(64) }),
  }, async (args, extra) => json(await tools.publish_meta_batch(authOf(extra?.http?.authInfo), args)))

  server.registerTool("reconcile_meta_batch", {
    description: "Verify a destination whose final remote ID is saved but unverified. Never republishes.",
    inputSchema: z.object({ content_post_id: z.string().min(1), batch_id: z.string().min(1), hash: z.string().length(64), destination: z.enum(["instagram", "facebook"]) }),
  }, async (args, extra) => json(await tools.reconcile_meta_batch(authOf(extra?.http?.authInfo), args)))

  server.registerTool("record_manual_publication", {
    description: "Super admin only: record exact-post evidence (remote id + platform permalink) for a destination that was published outside the API or whose outcome was reconciled by inspection.",
    inputSchema: z.object({ content_post_id: z.string().min(1), batch_id: z.string().min(1), hash: z.string().length(64), destination: z.enum(["instagram", "facebook"]), remote_id: z.string().min(1), permalink: z.string().url() }),
  }, async (args, extra) => json(await tools.record_manual_publication(authOf(extra?.http?.authInfo), args)))

  server.registerTool("get_meta_batch_status", {
    description: "Current publisher batch for a record: jobs, permalinks, uncertainty, claim. Read-only.",
    inputSchema: z.object({ content_post_id: z.string().min(1) }),
  }, async (args, extra) => json(await tools.get_meta_batch_status(authOf(extra?.http?.authInfo), args)))

  server.registerTool("check_meta_connection", {
    description: "Read-only Meta connection diagnostics for a record's batch: identity, Page/IG link, recent posts with matching captions, saved container status. Production only.",
    inputSchema: z.object({ content_post_id: z.string().min(1) }),
  }, async (args, extra) => json(await tools.check_meta_connection(authOf(extra?.http?.authInfo), args)))

  server.registerTool("check_meta_credentials", {
    description: "Credential health for a brand without a batch: configured ids, evidence date, runtime switches, and a read-only self-check. Never returns the credential.",
    inputSchema: z.object({ brand }),
  }, async (args, extra) => json(await tools.check_meta_credentials(authOf(extra?.http?.authInfo), args)))

  server.registerTool("check_canva_connection", {
    description: "Whether the server-side Canva connection exists, its scope and expiry. Never returns token material.",
    inputSchema: z.object({}),
  }, async (_args, extra) => json(await tools.check_canva_connection(authOf(extra?.http?.authInfo))))
})

const verify = createContentAuthVerifier({
  ...(process.env.CONTENT_MCP_ISSUER && process.env.CONTENT_MCP_AUDIENCE ? { jwt: { issuer: process.env.CONTENT_MCP_ISSUER, audience: process.env.CONTENT_MCP_AUDIENCE, ...(process.env.CONTENT_MCP_JWKS_URL ? { jwksUrl: process.env.CONTENT_MCP_JWKS_URL } : {}) } } : {}),
  staticInternalToken: process.env.SOR_MCP_TOKEN_INTERNAL,
})

async function verifyToken(_req: Request, bearer?: string): Promise<AuthInfo | undefined> {
  const auth = await verify(bearer)
  if (!auth || !bearer) return undefined
  return { token: bearer, clientId: auth.clientId, scopes: auth.scopes, extra: { content: auth } }
}

const authHandler = withMcpAuth(handler, verifyToken, {
  required: true,
  requiredScopes: ["content:read"],
  resourceMetadataPath: "/.well-known/oauth-protected-resource/api/content/mcp",
})

export { authHandler as GET, authHandler as POST }
