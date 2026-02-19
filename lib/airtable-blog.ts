import Airtable from "airtable"
import type { BlogPost, BlogCategory, CreateBlogPostData, UpdateBlogPostData, BlogFilters } from "../types/blog-types"
import { convertAirtableRichTextToHTMLSync } from "./rich-text-converter"

// Initialize Airtable base for Blog
const airtableBlogBaseId = process.env.AIRTABLE_BLOG_BASE_ID
const airtableBlogApiKey = process.env.AIRTABLE_BLOG_API_KEY

if (!airtableBlogBaseId || !airtableBlogApiKey) {
  throw new Error("Airtable Blog configuration is missing. Please set AIRTABLE_BLOG_BASE_ID and AIRTABLE_BLOG_API_KEY")
}

const blogBase = new Airtable({ apiKey: airtableBlogApiKey }).base(airtableBlogBaseId)

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

// Map Airtable record to BlogPost interface
function mapAirtableToBlogPost(record: any): BlogPost {
  const fields = record.fields

  // Handle featured image - could be URL string or Airtable attachment array
  let featuredImage: string | undefined = undefined
  
  // Check for "Featured Image" field (attachment type)
  if (fields["Featured Image"]) {
    if (Array.isArray(fields["Featured Image"]) && fields["Featured Image"].length > 0) {
      const attachment = fields["Featured Image"][0]
      featuredImage = attachment.url || attachment.thumbnails?.large?.url || attachment.thumbnails?.small?.url
    }
  }
  
  // Check for "Featured Image URL" field (text field) as fallback
  if (!featuredImage && fields["Featured Image URL"]) {
    if (typeof fields["Featured Image URL"] === "string") {
      featuredImage = fields["Featured Image URL"]
    }
  }

  // Process rich text content
  const processedContent = convertAirtableRichTextToHTMLSync(fields.Content)

  return {
    id: record.id,
    title: fields.Title || "",
    slug: fields.Slug || generateSlug(fields.Title || ""),
    content: processedContent,
    excerpt: fields.Excerpt || undefined,
    featured_image: featuredImage,
    meta_description: fields["Meta Description"] || undefined,
    category: fields.Category || "Technology", // Single select field - returns string directly
    tags: fields.Tags ? (Array.isArray(fields.Tags) ? fields.Tags : fields.Tags.split(',').map((tag: string) => tag.trim())) : [],
    status: (fields.Status === "Published" || fields["Is Published"] === true) ? "published" : "draft",
    author: fields.Author || "434 Media",
    published_at: fields["Published At"] || (fields.Status === "Published" ? record._createdTime : undefined),
    created_at: record._createdTime,
    updated_at: fields["Updated At"] || record._createdTime,
    read_time: fields["Read Time"] || calculateReadTime(processedContent || ""),
  }
}

// Map BlogPost interface to Airtable fields
function mapBlogPostToAirtable(post: Omit<BlogPost, "id" | "created_at" | "updated_at"> | Partial<BlogPost>): any {
  const airtableData: any = {}

  if (post.title !== undefined) airtableData.Title = post.title
  if (post.slug !== undefined) airtableData.Slug = post.slug
  if (post.content !== undefined) airtableData.Content = post.content
  if (post.excerpt !== undefined) airtableData.Excerpt = post.excerpt || ""
  if (post.featured_image !== undefined) airtableData["Featured Image URL"] = post.featured_image || ""
  if (post.meta_description !== undefined) airtableData["Meta Description"] = post.meta_description || ""
  if (post.category !== undefined) airtableData.Category = post.category
  if (post.tags !== undefined) airtableData.Tags = Array.isArray(post.tags) ? post.tags.join(', ') : post.tags
  if (post.status !== undefined) airtableData.Status = post.status === "published" ? "Published" : "Draft"
  if (post.author !== undefined) airtableData.Author = post.author
  if (post.published_at !== undefined && post.status === "published") {
    airtableData["Published At"] = post.published_at || new Date().toISOString()
  }
  if (post.read_time !== undefined) airtableData["Read Time"] = post.read_time

  // Always update the "Updated At" field
  airtableData["Updated At"] = new Date().toISOString()

  return airtableData
}




// Get all blog posts from Airtable
export async function getBlogPostsFromAirtable(filters: BlogFilters = {}): Promise<BlogPost[]> {
  try {
    let filterFormula = ""
    const conditions: string[] = []

    // Build filter formula based on filters
    if (filters.status) {
      if (filters.status === "published") {
        // Check multiple possible published states
        conditions.push(`OR({Status} = "Published", {Is Published} = TRUE(), {Status} = "Live")`)
      } else {
        conditions.push(`AND({Status} != "Published", {Is Published} != TRUE(), {Status} != "Live")`)
      }
    }

    if (filters.category) {
      conditions.push(`{Category} = "${filters.category}"`)
    }

    if (filters.tag) {
      conditions.push(`FIND("${filters.tag}", {Tags}) > 0`)
    }

    if (filters.search) {
      conditions.push(`OR(FIND("${filters.search}", {Title}) > 0, FIND("${filters.search}", {Content}) > 0)`)
    }

    if (conditions.length > 0) {
      filterFormula = conditions.length === 1 ? conditions[0] : `AND(${conditions.join(', ')})`
    }

    const selectOptions: any = {
      sort: [
        { field: "Published At", direction: "desc" },
      ],
    }

    if (filterFormula) {
      selectOptions.filterByFormula = filterFormula
    }

    if (filters.limit) {
      selectOptions.maxRecords = filters.limit
    }

    const records = await blogBase("Blog Posts")
      .select(selectOptions)
      .all()

    const posts = records.map(mapAirtableToBlogPost)

    // Apply offset if specified (Airtable doesn't support offset directly)
    if (filters.offset) {
      return posts.slice(filters.offset)
    }

    return posts
  } catch (error) {
    console.error("Error fetching blog posts from Airtable:", error)
    
    // Provide more detailed error information
    if (error instanceof Error) {
      console.error("Detailed error:", {
        message: error.message,
        name: error.name,
        stack: error.stack
      })
      
      // Check for common Airtable errors
      if (error.message.includes('NOT_FOUND')) {
        throw new Error(`Airtable base or table not found. Please verify AIRTABLE_BLOG_BASE_ID (${airtableBlogBaseId}) and ensure "Blog Posts" table exists.`)
      }
      
      if (error.message.includes('AUTHENTICATION_REQUIRED')) {
        throw new Error(`Airtable authentication failed. Please verify AIRTABLE_BLOG_API_KEY is correct.`)
      }
      
      if (error.message.includes('INVALID_PERMISSIONS')) {
        throw new Error(`Airtable API key lacks required permissions. Ensure the token has read/write access to the base.`)
      }
    }
    
    throw new Error(`Failed to fetch blog posts from Airtable: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Get a specific blog post by slug from Airtable
export async function getBlogPostBySlugFromAirtable(slug: string): Promise<BlogPost | null> {
  try {
    const records = await blogBase("Blog Posts")
      .select({
        filterByFormula: `AND({Slug} = "${slug}", {Status} = "Published")`,
        maxRecords: 1,
      })
      .all()

    if (records.length === 0) {
      return null
    }

    const post = mapAirtableToBlogPost(records[0])
    return post
  } catch (error) {
    console.error("Error fetching blog post by slug from Airtable:", error)
    return null
  }
}

// Get a specific blog post by ID from Airtable
export async function getBlogPostByIdFromAirtable(id: string): Promise<BlogPost | null> {
  try {
    const record = await blogBase("Blog Posts").find(id)
    return mapAirtableToBlogPost(record)
  } catch (error) {
    console.error("Error fetching blog post by ID from Airtable:", error)
    return null
  }
}

// Create a new blog post in Airtable
export async function createBlogPostInAirtable(postData: CreateBlogPostData): Promise<BlogPost> {
  try {
    // Generate slug if not provided
    const slug = postData.slug || generateSlug(postData.title)
    const readTime = postData.read_time || calculateReadTime(postData.content)

    const airtableData = mapBlogPostToAirtable({
      ...postData,
      slug,
      read_time: readTime,
    })

    const records = await blogBase("Blog Posts").create([
      {
        fields: airtableData,
      },
    ])

    if (records.length === 0) {
      throw new Error("No records created")
    }

    return mapAirtableToBlogPost(records[0])
  } catch (error) {
    console.error("Error creating blog post in Airtable:", error)
    throw new Error("Failed to create blog post in Airtable")
  }
}

// Update a blog post in Airtable
export async function updateBlogPostInAirtable(id: string, updates: UpdateBlogPostData): Promise<BlogPost> {
  try {
    // Calculate read time if content is being updated
    if (updates.content && !updates.read_time) {
      updates.read_time = calculateReadTime(updates.content)
    }

    // Generate slug if title is being updated but slug is not provided
    if (updates.title && !updates.slug) {
      updates.slug = generateSlug(updates.title)
    }

    const airtableUpdates = mapBlogPostToAirtable(updates)

    // Remove undefined values
    const cleanUpdates: any = {}
    for (const [key, value] of Object.entries(airtableUpdates)) {
      if (value !== undefined && value !== null) {
        cleanUpdates[key] = value
      }
    }

    const records = await blogBase("Blog Posts").update([
      {
        id,
        fields: cleanUpdates,
      },
    ])

    if (!records || records.length === 0) {
      throw new Error("No records updated")
    }

    return mapAirtableToBlogPost(records[0])
  } catch (error) {
    console.error("Error updating blog post in Airtable:", error)
    throw new Error("Failed to update blog post in Airtable")
  }
}

// Delete a blog post from Airtable
export async function deleteBlogPostFromAirtable(id: string): Promise<void> {
  try {
    await blogBase("Blog Posts").destroy([id])
  } catch (error) {
    console.error("Error deleting blog post from Airtable:", error)
    throw new Error("Failed to delete blog post from Airtable")
  }
}

// Get all blog categories from Airtable
export async function getBlogCategoriesFromAirtable(): Promise<BlogCategory[]> {
  try {
    // Get all published blog posts to extract categories from single select field
    const postRecords = await blogBase("Blog Posts")
      .select({
        filterByFormula: '{Status} = "Published"',
        fields: ["Category"],
      })
      .all()

    // Extract unique categories from posts
    const categoryMap = new Map<string, number>()
    
    postRecords.forEach((record) => {
      const category = record.fields.Category as string
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
    console.error("Error fetching blog categories from Airtable:", error)
    throw new Error("Failed to fetch blog categories from Airtable")
  }
}



// Test Airtable connection for blog
export async function testAirtableBlogConnection(): Promise<boolean> {
  try {
    console.log("Testing Airtable blog connection...")
    console.log("Base ID:", airtableBlogBaseId)
    console.log("API Key (first 10 chars):", airtableBlogApiKey?.substring(0, 10) + "...")
    
    await blogBase("Blog Posts")
      .select({ maxRecords: 1 })
      .firstPage()
    
    console.log("✅ Airtable blog connection successful")
    return true
  } catch (error) {
    console.error("❌ Airtable blog connection test failed:", error)
    
    if (error instanceof Error) {
      console.error("Connection error details:", {
        message: error.message,
        name: error.name
      })
    }
    
    return false
  }
}

