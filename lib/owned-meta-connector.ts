import type { AuthInfo } from "@modelcontextprotocol/server"
import { toolInput, type ToolName } from "./owned-meta-tool-handler"
import type { Principal } from "./owned-meta-intake"
import type { ConnectorScope } from "./owned-meta-oauth"

/** Tool catalog for the publisher MCP connector. Read-only tools are annotated so ChatGPT can skip confirmation. */
export const CONNECTOR_TOOLS: { name: ToolName; title: string; description: string; readOnly: boolean }[] = [
  { name: "find_posts", title: "Find content posts", description: "Search CRM content posts by id, title, caption or tags. Returns id, status, asset count, publisher state and whether the post is excluded (already published).", readOnly: true },
  { name: "create_post", title: "Create content post", description: "Create one CRM content post for a Meta property. Idempotent on requestId: repeating a request returns the post it already created. Check find_posts first.", readOnly: false },
  { name: "attach_exports", title: "Attach exports", description: "Replace a post's media with final exports, in carousel order, from public https URLs (for example Canva JPG export links). Measures each file; Instagram needs JPEG. Invalidates any unstarted draft so approval binds these files.", readOnly: false },
  { name: "attach_canva_design", title: "Attach Canva design", description: "Export a Canva design as JPG through the Canva API (optionally only some pages, in the order given) and attach the pages to a post as its final exports. Canva stays the source; files are staged for publishing. Invalidates any unstarted draft.", readOnly: false },
  { name: "prepare", title: "Prepare for approval", description: "Create an immutable draft from the post's saved exports and captions. Returns per-platform holds, unsupported-feature notices and the approval phrase the founder must post in Slack.", readOnly: false },
  { name: "approve", title: "Record Slack approval", description: "Record the founder's approval. Pass the Slack channel id and message ts of the founder's own message containing the approval phrase; the server reads that message itself.", readOnly: false },
  { name: "execute", title: "Publish approved post", description: "Publish an approved draft to Instagram and Facebook through the existing publisher. Never repeats a final publish; processing media is resumed automatically.", readOnly: false },
  { name: "status", title: "Publisher status", description: "Saved state, verified IDs, permalinks, holds and notices for a post's current draft.", readOnly: true },
  { name: "health", title: "Credential health", description: "Read-only Meta connection and credential check for the post's property.", readOnly: true },
  { name: "record_external", title: "Record external publication", description: "Record that one platform was already published outside the publisher, so it is never published again. Only for a platform the publisher has not attempted.", readOnly: false },
  { name: "exclude", title: "Exclude published post", description: "Mark a post published outside the publisher (owner-reported). Blocks every publish path for it.", readOnly: false },
]
export function toolSchema(name: ToolName) { return toolInput[name] }

/** Least privilege per tool, as Polí's pilot does: no scope implies another. */
export const TOOL_SCOPE: Record<ToolName, ConnectorScope> = {
  find_posts: "owned-meta:read", status: "owned-meta:read", health: "owned-meta:read",
  create_post: "owned-meta:write", attach_exports: "owned-meta:write", attach_canva_design: "owned-meta:write", prepare: "owned-meta:write",
  approve: "owned-meta:write", record_external: "owned-meta:write", exclude: "owned-meta:write",
  execute: "owned-meta:publish",
}

export function principalOf(info: AuthInfo | undefined, tool: ToolName): Principal | undefined {
  const extra = info?.extra as { email?: unknown; name?: unknown } | undefined
  if (typeof extra?.email !== "string" || !info?.scopes?.includes(TOOL_SCOPE[tool])) return undefined
  return { email: extra.email, ...(typeof extra.name === "string" ? { name: extra.name } : {}) }
}
