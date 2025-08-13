// Simple file-based storage for production
// In a real production app, use PostgreSQL, MongoDB, or a vector database

import fs from "fs/promises"
import path from "path"
import type { NotionPage } from "./notion-client"

const DATA_DIR = path.join(process.cwd(), "data")
const KNOWLEDGE_BASE_FILE = path.join(DATA_DIR, "knowledge-base.json")
const SYNC_STATUS_FILE = path.join(DATA_DIR, "sync-status.json")

interface SyncStatus {
  lastSync: string
  totalPages: number
  status: "success" | "error" | "in-progress"
  error?: string
}

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR)
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true })
  }
}

export async function saveKnowledgeBase(pages: NotionPage[]) {
  await ensureDataDir()

  const data = {
    pages,
    lastUpdated: new Date().toISOString(),
    version: "1.0",
  }

  await fs.writeFile(KNOWLEDGE_BASE_FILE, JSON.stringify(data, null, 2))
  console.log(`💾 Saved ${pages.length} pages to persistent storage`)
}

export async function loadKnowledgeBase(): Promise<NotionPage[]> {
  try {
    await ensureDataDir()
    const data = await fs.readFile(KNOWLEDGE_BASE_FILE, "utf-8")
    const parsed = JSON.parse(data)
    console.log(`📖 Loaded ${parsed.pages.length} pages from persistent storage`)
    return parsed.pages || []
  } catch (error) {
    console.log("📝 No existing knowledge base found, starting fresh")
    return []
  }
}

export async function saveSyncStatus(status: SyncStatus) {
  await ensureDataDir()
  await fs.writeFile(SYNC_STATUS_FILE, JSON.stringify(status, null, 2))
}

export async function loadSyncStatus(): Promise<SyncStatus | null> {
  try {
    const data = await fs.readFile(SYNC_STATUS_FILE, "utf-8")
    return JSON.parse(data)
  } catch {
    return null
  }
}
