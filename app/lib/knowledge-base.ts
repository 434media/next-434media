import type { NotionPage } from "./notion-client"
import { saveKnowledgeBase, loadKnowledgeBase } from "./ai-database"

// In-memory cache for fast access
let knowledgeBaseCache: NotionPage[] = []
let isInitialized = false

// Initialize knowledge base from persistent storage
async function initializeKnowledgeBase() {
  if (isInitialized) return

  try {
    knowledgeBaseCache = await loadKnowledgeBase()
    isInitialized = true
    console.log(`🚀 Knowledge base initialized with ${knowledgeBaseCache.length} pages`)
  } catch (error) {
    console.error("❌ Failed to initialize knowledge base:", error)
    knowledgeBaseCache = []
    isInitialized = true
  }
}

export async function storeInKnowledgeBase(page: NotionPage) {
  await initializeKnowledgeBase()

  // Remove existing page if it exists
  knowledgeBaseCache = knowledgeBaseCache.filter((p) => p.id !== page.id)

  // Add the new/updated page
  knowledgeBaseCache.push(page)

  console.log(`✅ Stored page: ${page.title} (${page.id})`)
  console.log(`📊 Knowledge base now has ${knowledgeBaseCache.length} pages`)
}

export async function saveKnowledgeBaseToDisk() {
  await saveKnowledgeBase(knowledgeBaseCache)
}

export async function searchKnowledgeBase(query: string): Promise<(NotionPage & { relevanceScore: number })[]> {
  await initializeKnowledgeBase()

  console.log(`🔍 Searching knowledge base for: "${query}"`)
  console.log(`📚 Knowledge base has ${knowledgeBaseCache.length} pages`)

  if (!query.trim()) {
    console.log("❌ Empty query provided")
    return []
  }

  if (knowledgeBaseCache.length === 0) {
    console.log("❌ Knowledge base is empty")
    return []
  }

  const searchTerms = query
    .toLowerCase()
    .split(" ")
    .filter((term) => term.length > 2)

  console.log(`🔎 Search terms: ${searchTerms.join(", ")}`)

  // Enhanced text-based search with better scoring
  const results = knowledgeBaseCache
    .map((page) => {
      let relevanceScore = 0

      // Title matching (higher weight)
      searchTerms.forEach((term) => {
        const titleMatches = (page.title.toLowerCase().match(new RegExp(term, "g")) || []).length
        relevanceScore += titleMatches * 3
      })

      // Content matching
      searchTerms.forEach((term) => {
        const contentMatches = (page.content.toLowerCase().match(new RegExp(term, "g")) || []).length
        relevanceScore += contentMatches
      })

      // Boost score for exact phrase matches
      if (page.title.toLowerCase().includes(query.toLowerCase())) {
        relevanceScore += 5
      }
      if (page.content.toLowerCase().includes(query.toLowerCase())) {
        relevanceScore += 3
      }

      // Boost score for common business terms
      const businessTerms = ["team", "member", "employee", "staff", "department", "role", "position", "contact"]
      businessTerms.forEach((term) => {
        if (query.toLowerCase().includes(term) && page.content.toLowerCase().includes(term)) {
          relevanceScore += 2
        }
      })

      return {
        ...page,
        relevanceScore,
      }
    })
    .filter((page) => page.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 5) // Return top 5 results

  console.log(`✅ Found ${results.length} relevant documents`)
  results.forEach((result, index) => {
    console.log(`${index + 1}. "${result.title}" (score: ${result.relevanceScore})`)
  })

  return results
}

export async function getKnowledgeBaseStats() {
  await initializeKnowledgeBase()

  return {
    totalPages: knowledgeBaseCache.length,
    pages: knowledgeBaseCache.map((p) => ({ id: p.id, title: p.title, lastEdited: p.lastEdited })),
  }
}

// Auto-sync on startup (for production)
export async function autoSyncOnStartup() {
  if (process.env.NODE_ENV === "production") {
    console.log("🔄 Auto-syncing Notion data on startup...")
    try {
      const { ingestNotionData } = await import("./notion-client")
      await ingestNotionData()
      await saveKnowledgeBaseToDisk()
      console.log("✅ Auto-sync completed successfully")
    } catch (error) {
      console.error("❌ Auto-sync failed:", error)
    }
  }
}
