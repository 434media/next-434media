import { neon } from "@neondatabase/serverless"
import type { NotionPage } from "./notion-client"
import { promises as fs } from "fs"
import path from "path"

// Graceful optional database initialization. If DATABASE_URL is missing we fall back to JSON files.
type NeonClient = ReturnType<typeof neon>
let sql: NeonClient | null = null
let dbAvailable = true
let schemaEnsured = false

try {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set; falling back to local JSON storage.")
  }
  sql = neon(process.env.DATABASE_URL)
  console.log("✅ Neon database client initialized")
  ensureSchema().catch((e) => console.warn("⚠️ Failed to ensure schema (background):", e))
} catch (e) {
  dbAvailable = false
  console.warn("⚠️ Neon database disabled:", e instanceof Error ? e.message : e)
}

// Local JSON fallback paths
const dataDir = path.join(process.cwd(), "data")
const kbFile = path.join(dataDir, "knowledge-base.json")
const syncFile = path.join(dataDir, "sync-status.json")

async function ensureDataDir() {
  try {
    await fs.mkdir(dataDir, { recursive: true })
  } catch {}
}

interface SyncStatus {
  lastSync: string
  totalPages: number
  status: "success" | "error" | "in-progress"
  error?: string
}

async function ensureSchema() {
  if (!sql || schemaEnsured) return
  schemaEnsured = true
  try {
    // Attempt to enable pgcrypto (ignore if fails)
    try { await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`; } catch {}
    await sql`CREATE TABLE IF NOT EXISTS knowledge_base (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      url TEXT,
      last_edited TIMESTAMP NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS sync_status (
      id SERIAL PRIMARY KEY,
      last_sync TIMESTAMP NOT NULL,
      total_pages INT NOT NULL,
      status TEXT NOT NULL,
      error_message TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS chat_conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS chat_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_knowledge_base_updated_at ON knowledge_base(updated_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_sync_status_created_at ON sync_status(created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id)`;
    console.log("🛠️ Database schema ensured")
  } catch (e) {
    console.error("❌ Failed ensuring schema:", e)
  }
}

export async function saveKnowledgeBase(pages: NotionPage[]) {
  if (!dbAvailable || !sql) {
    await ensureDataDir()
    try {
      await fs.writeFile(kbFile, JSON.stringify({ pages }, null, 2), "utf8")
      console.log(`💾 (FS) Saved ${pages.length} pages to ${kbFile}`)
    } catch (error) {
      console.error("❌ (FS) Failed to save knowledge base:", error)
      throw error
    }
    return
  }
  console.log(`💾 Saving ${pages.length} pages to Neon database`)

  try {
  await ensureSchema()
    // Begin transaction
    await sql`BEGIN`

    // Clear existing knowledge base
    await sql`DELETE FROM knowledge_base`

    // Insert all pages
    for (const page of pages) {
      await sql`
        INSERT INTO knowledge_base (id, title, content, url, last_edited)
        VALUES (${page.id}, ${page.title}, ${page.content}, ${page.url || null}, ${page.lastEdited || null})
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          content = EXCLUDED.content,
          url = EXCLUDED.url,
          last_edited = EXCLUDED.last_edited,
          updated_at = NOW()
      `
    }

    // Commit transaction
    await sql`COMMIT`
    console.log(`✅ Successfully saved ${pages.length} pages to Neon database`)
  } catch (error) {
    await sql`ROLLBACK`
    console.error("❌ Failed to save knowledge base to Neon:", error)
    throw error
  }
}

export async function loadKnowledgeBase(): Promise<NotionPage[]> {
  if (!dbAvailable || !sql) {
    try {
      const raw = await fs.readFile(kbFile, "utf8")
      const parsed = JSON.parse(raw)
      console.log(`📖 (FS) Loaded ${(parsed.pages || []).length} pages from ${kbFile}`)
      return (parsed.pages || []) as NotionPage[]
    } catch (e) {
      console.warn("⚠️ (FS) No existing knowledge base file, starting empty")
      return []
    }
  }
  try {
    if (!sql) return []
  await ensureSchema()
    const result = (await sql`
      SELECT id, title, content, url, last_edited
      FROM knowledge_base
      ORDER BY updated_at DESC
    `) as any[]

    const pages: NotionPage[] = (result as any[]).map((row: any) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      url: row.url,
      lastEdited: row.last_edited,
    }))

    console.log(`📖 Loaded ${pages.length} pages from Neon database`)
    return pages
  } catch (error) {
    console.error("❌ Failed to load knowledge base from Neon:", error)
    console.log("📝 No existing knowledge base found, starting fresh")
    return []
  }
}

export async function saveSyncStatus(status: SyncStatus) {
  if (!dbAvailable || !sql) {
    await ensureDataDir()
    try {
      await fs.writeFile(syncFile, JSON.stringify(status, null, 2), "utf8")
      console.log("✅ (FS) Sync status saved to", syncFile)
    } catch (e) {
      console.error("❌ (FS) Failed to save sync status:", e)
      throw e
    }
    return
  }
  try {
    await sql`
      INSERT INTO sync_status (last_sync, total_pages, status, error_message)
      VALUES (${status.lastSync}, ${status.totalPages}, ${status.status}, ${status.error || null})
    `
    console.log("✅ Sync status saved to Neon database")
  } catch (error) {
    console.error("❌ Failed to save sync status to Neon:", error)
    throw error
  }
}

export async function loadSyncStatus(): Promise<SyncStatus | null> {
  if (!dbAvailable || !sql) {
    try {
      const raw = await fs.readFile(syncFile, "utf8")
      const parsed = JSON.parse(raw)
      return parsed as SyncStatus
    } catch {
      return null
    }
  }
  try {
    if (!sql) return null
  await ensureSchema()
    const result = (await sql`
      SELECT last_sync, total_pages, status, error_message
      FROM sync_status
      ORDER BY created_at DESC
      LIMIT 1
    `) as any[]

    if ((result as any[]).length === 0) {
      return null
    }

    const row = (result as any[])[0]
    return {
      lastSync: row.last_sync,
      totalPages: row.total_pages,
      status: row.status,
      error: row.error_message,
    }
  } catch (error) {
    console.error("❌ Failed to load sync status from Neon:", error)
    return null
  }
}

// Optional: Chat history functions for persistent conversations
export async function saveMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  metadata: any = {},
) {
  try {
    if (!sql) return // skip persist when DB unavailable
  await ensureSchema()
    await sql`
      INSERT INTO chat_messages (conversation_id, role, content, metadata)
      VALUES (${conversationId}, ${role}, ${content}, ${JSON.stringify(metadata)})
    `
  } catch (error) {
    console.error("❌ Failed to save message to Neon:", error)
    throw error
  }
}

export async function loadConversation(conversationId: string) {
  try {
    if (!sql) return []
  await ensureSchema()
    const result = (await sql`
      SELECT role, content, metadata, created_at
      FROM chat_messages
      WHERE conversation_id = ${conversationId}
      ORDER BY created_at ASC
    `) as any[]

    return (result as any[]).map((row: any) => ({
      role: row.role,
      content: row.content,
      metadata: row.metadata,
      createdAt: row.created_at,
    }))
  } catch (error) {
    console.error("❌ Failed to load conversation from Neon:", error)
    return []
  }
}

export async function createConversation(title?: string) {
  try {
    if (!sql) return "local-temp-convo" // simple fallback id
  await ensureSchema()
    const result = (await sql`
      INSERT INTO chat_conversations (title)
      VALUES (${title || null})
      RETURNING id
    `) as any[]
    return (result as any[])[0].id
  } catch (error) {
    console.error("❌ Failed to create conversation in Neon:", error)
    throw error
  }
}
