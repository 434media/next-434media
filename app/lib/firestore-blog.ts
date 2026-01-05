import { getDb, COLLECTIONS, admin } from "./firebase-admin"
import type { BlogPost, BlogCategory, CreateBlogPostData, UpdateBlogPostData, BlogFilters } from "../types/blog-types"
import { convertAirtableRichTextToHTMLSync } from "./rich-text-converter"

// ============================================
// SIMPLE IN-MEMORY CACHE (reduces Firestore reads)
// ============================================
interface CacheEntry<T> {
  data: T
  timestamp: number
}

const cache = new Map<string, CacheEntry<unknown>>()
const CACHE_TTL = 30 * 1000 // 30 seconds cache

function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key)
    return null
  }
  return entry.data as T
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() })
}

// Invalidate cache for blog posts
export function invalidateBlogCache(): void {
  for (const key of cache.keys()) {
    if (key.includes("blog")) {
      cache.delete(key)
    }
  }
}

// Generate slug from title
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
}

// Calculate read time (average 200 words per minute)
function calculateReadTime(content: string): number {
  const wordCount = content.split(/\s+/).length
  return Math.ceil(wordCount / 200)
}

// Convert Firestore document to BlogPost interface
function mapFirestoreToBlogPost(doc: admin.firestore.DocumentSnapshot, rawContent: boolean = false): BlogPost {
  const data = doc.data()
  if (!data) {
    throw new Error(`Document ${doc.id} has no data`)
  }

  const Timestamp = admin.firestore.Timestamp

  // Convert markdown content to HTML for display, unless raw content is requested (for admin editing)
  const processedContent = rawContent 
    ? (data.content || "") 
    : convertAirtableRichTextToHTMLSync(data.content || "")

  return {
    id: doc.id,
    title: data.title || "",
    slug: data.slug || generateSlug(data.title || ""),
    content: processedContent,
    excerpt: data.excerpt || undefined,
    featured_image: data.featured_image || undefined,
    meta_description: data.meta_description || undefined,
    category: data.category || "Technology",
    tags: data.tags || [],
    status: data.status || "draft",
    author: data.author || "434 Media",
    published_at: data.published_at instanceof Timestamp 
      ? data.published_at.toDate().toISOString() 
      : data.published_at,
    created_at: data.created_at instanceof Timestamp 
      ? data.created_at.toDate().toISOString() 
      : data.created_at || new Date().toISOString(),
    updated_at: data.updated_at instanceof Timestamp 
      ? data.updated_at.toDate().toISOString() 
      : data.updated_at || new Date().toISOString(),
    read_time: data.read_time || calculateReadTime(data.content || ""),
    embedded_media: data.embedded_media || undefined,
  }
}

// Get all blog posts from Firestore (with caching)
// Set rawContent=true for admin editing (returns markdown), false for display (returns HTML)
export async function getBlogPostsFromFirestore(filters: BlogFilters = {}, rawContent: boolean = false): Promise<BlogPost[]> {
  // Generate cache key from filters and rawContent flag
  const cacheKey = `blog_posts:${JSON.stringify(filters)}:raw=${rawContent}`
  const cached = getCached<BlogPost[]>(cacheKey)
  if (cached) {
    console.log("[Firestore] Cache hit for blog posts")
    return cached
  }

  try {
    const db = getDb()
    let query: admin.firestore.Query = db.collection(COLLECTIONS.BLOG_POSTS)

    // Apply status filter
    if (filters.status) {
      query = query.where("status", "==", filters.status)
    }

    if (filters.category) {
      query = query.where("category", "==", filters.category)
    }

    // Apply limit if specified
    if (filters.limit) {
      query = query.limit(filters.limit)
    }

    const snapshot = await query.get()
    let posts = snapshot.docs.map(doc => mapFirestoreToBlogPost(doc, rawContent))
    
    // Sort by published_at client-side to avoid composite index requirement
    posts.sort((a, b) => {
      const dateA = a.published_at ? new Date(a.published_at).getTime() : 0
      const dateB = b.published_at ? new Date(b.published_at).getTime() : 0
      return dateB - dateA // Descending order
    })
    
    console.log(`[Firestore] Fetched ${posts.length} blog posts`)

    // Apply tag filter (Firestore doesn't support array-contains with other where clauses easily)
    if (filters.tag) {
      posts = posts.filter((post: BlogPost) => post.tags.includes(filters.tag!))
    }

    // Apply search filter (client-side for now)
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      posts = posts.filter((post: BlogPost) => 
        post.title.toLowerCase().includes(searchLower) ||
        post.content.toLowerCase().includes(searchLower)
      )
    }

    // Apply offset if specified
    if (filters.offset) {
      posts = posts.slice(filters.offset)
    }

    // Cache the results
    setCache(cacheKey, posts)

    return posts
  } catch (error) {
    console.error("Error fetching blog posts from Firestore:", error)
    throw new Error(`Failed to fetch blog posts from Firestore: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Get a specific blog post by slug from Firestore
// Set rawContent=true for admin editing (returns markdown), false for display (returns HTML)
export async function getBlogPostBySlugFromFirestore(slug: string, rawContent: boolean = false): Promise<BlogPost | null> {
  try {
    const db = getDb()
    const snapshot = await db
      .collection(COLLECTIONS.BLOG_POSTS)
      .where("slug", "==", slug)
      .where("status", "==", "published")
      .limit(1)
      .get()

    if (snapshot.empty) {
      return null
    }

    return mapFirestoreToBlogPost(snapshot.docs[0], rawContent)
  } catch (error) {
    console.error("Error fetching blog post by slug from Firestore:", error)
    return null
  }
}

// Get a specific blog post by ID from Firestore
// Set rawContent=true for admin editing (returns markdown), false for display (returns HTML)
export async function getBlogPostByIdFromFirestore(id: string, rawContent: boolean = false): Promise<BlogPost | null> {
  try {
    const db = getDb()
    const doc = await db.collection(COLLECTIONS.BLOG_POSTS).doc(id).get()

    if (!doc.exists) {
      return null
    }

    return mapFirestoreToBlogPost(doc, rawContent)
  } catch (error) {
    console.error("Error fetching blog post by ID from Firestore:", error)
    return null
  }
}

// Create a new blog post in Firestore
export async function createBlogPostInFirestore(postData: CreateBlogPostData): Promise<BlogPost> {
  try {
    const db = getDb()
    const FieldValue = admin.firestore.FieldValue
    const now = FieldValue.serverTimestamp()

    // Generate slug if not provided
    const slug = postData.slug || generateSlug(postData.title)
    const readTime = postData.read_time || calculateReadTime(postData.content)

    const docData: Record<string, unknown> = {
      title: postData.title,
      slug,
      content: postData.content,
      excerpt: postData.excerpt || "",
      featured_image: postData.featured_image || "",
      meta_description: postData.meta_description || "",
      category: postData.category,
      tags: postData.tags || [],
      status: postData.status,
      author: postData.author,
      read_time: readTime,
      created_at: now,
      updated_at: now,
    }

    // Set published_at if publishing
    if (postData.status === "published") {
      docData.published_at = postData.published_at || new Date().toISOString()
    }

    if (postData.embedded_media) {
      docData.embedded_media = postData.embedded_media
    }

    const docRef = await db.collection(COLLECTIONS.BLOG_POSTS).add(docData)
    
    // Invalidate blog cache
    invalidateBlogCache()
    
    const doc = await docRef.get()

    return mapFirestoreToBlogPost(doc)
  } catch (error) {
    console.error("Error creating blog post in Firestore:", error)
    throw new Error("Failed to create blog post in Firestore")
  }
}

// Update a blog post in Firestore
export async function updateBlogPostInFirestore(id: string, updates: UpdateBlogPostData): Promise<BlogPost> {
  try {
    const db = getDb()
    const FieldValue = admin.firestore.FieldValue
    const docRef = db.collection(COLLECTIONS.BLOG_POSTS).doc(id)

    // Calculate read time if content is being updated
    if (updates.content && !updates.read_time) {
      updates.read_time = calculateReadTime(updates.content)
    }

    // Generate slug if title is being updated but slug is not provided
    if (updates.title && !updates.slug) {
      updates.slug = generateSlug(updates.title)
    }

    // Clean the updates (remove undefined values)
    const cleanUpdates: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined && key !== "id") {
        cleanUpdates[key] = value
      }
    }

    cleanUpdates.updated_at = FieldValue.serverTimestamp()

    // Set published_at if publishing
    if (updates.status === "published" && !cleanUpdates.published_at) {
      cleanUpdates.published_at = new Date().toISOString()
    }

    await docRef.update(cleanUpdates)

    // Invalidate blog cache
    invalidateBlogCache()

    const doc = await docRef.get()
    // Return with processed HTML content for display
    return mapFirestoreToBlogPost(doc)
  } catch (error) {
    console.error("Error updating blog post in Firestore:", error)
    throw new Error("Failed to update blog post in Firestore")
  }
}

// Delete a blog post from Firestore
export async function deleteBlogPostFromFirestore(id: string): Promise<void> {
  try {
    const db = getDb()
    await db.collection(COLLECTIONS.BLOG_POSTS).doc(id).delete()
    
    // Invalidate blog cache
    invalidateBlogCache()
  } catch (error) {
    console.error("Error deleting blog post from Firestore:", error)
    throw new Error("Failed to delete blog post from Firestore")
  }
}

// Get all blog categories from Firestore
export async function getBlogCategoriesFromFirestore(): Promise<BlogCategory[]> {
  try {
    const db = getDb()
    
    // Get all published blog posts to extract categories
    const snapshot = await db
      .collection(COLLECTIONS.BLOG_POSTS)
      .where("status", "==", "published")
      .get()

    // Extract unique categories from posts
    const categoryMap = new Map<string, number>()
    
    snapshot.docs.forEach((doc: admin.firestore.DocumentSnapshot) => {
      const data = doc.data()
      if (!data) return
      const category = data.category as string
      if (category) {
        categoryMap.set(category, (categoryMap.get(category) || 0) + 1)
      }
    })

    // Convert to BlogCategory format and sort alphabetically
    return Array.from(categoryMap.entries())
      .map(([categoryName, count], index) => ({
        id: `cat-${index}`,
        name: categoryName,
        slug: categoryName.toLowerCase().replace(/\s+/g, '-'),
        post_count: count,
        created_at: new Date().toISOString()
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  } catch (error) {
    console.error("Error fetching blog categories from Firestore:", error)
    throw new Error("Failed to fetch blog categories from Firestore")
  }
}

// Test Firestore Blog connection
export async function testFirestoreBlogConnection(): Promise<boolean> {
  try {
    const db = getDb()
    await db.collection(COLLECTIONS.BLOG_POSTS).limit(1).get()
    console.log("✅ Firestore Blog connection successful")
    return true
  } catch (error) {
    console.error("❌ Firestore Blog connection test failed:", error)
    return false
  }
}
