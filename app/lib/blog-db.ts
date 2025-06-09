import { Pool } from "pg"
import type {
  BlogPost,
  CreateBlogPostData,
  UpdateBlogPostData,
  BlogCategory,
  BlogFilters,
  UpdateBlogImageData,
} from "../types/blog-types"

// Use the same pool as events
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

let dbInitialized = false

// Initialize blog tables
export async function initializeBlogDatabase() {
  if (dbInitialized) return

  const client = await pool.connect()

  try {
    // Create blog_posts table with IF NOT EXISTS
    await client.query(`
      CREATE TABLE IF NOT EXISTS blog_posts (
        id SERIAL PRIMARY KEY,
        title VARCHAR(500) NOT NULL,
        slug VARCHAR(500) UNIQUE NOT NULL,
        content TEXT NOT NULL,
        excerpt TEXT,
        featured_image TEXT,
        meta_description VARCHAR(300),
        category VARCHAR(100) DEFAULT 'technology',
        tags TEXT[] DEFAULT '{}',
        status VARCHAR(20) DEFAULT 'draft',
        author VARCHAR(255) DEFAULT '434 Media',
        published_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        read_time INTEGER,
        view_count INTEGER DEFAULT 0
      );
    `)

    // Create blog_categories table with IF NOT EXISTS
    await client.query(`
      CREATE TABLE IF NOT EXISTS blog_categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `)

    // Create blog_images table with IF NOT EXISTS
    await client.query(`
      CREATE TABLE IF NOT EXISTS blog_images (
        id VARCHAR(255) PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        url VARCHAR(500) NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        width INTEGER,
        height INTEGER,
        alt_text VARCHAR(500),
        uploaded_by VARCHAR(255) DEFAULT '434 Media',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `)

    // Create indexes only if they don't exist
    await client.query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_blog_posts_slug') THEN
          CREATE INDEX idx_blog_posts_slug ON blog_posts(slug);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_blog_posts_status') THEN
          CREATE INDEX idx_blog_posts_status ON blog_posts(status);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_blog_posts_category') THEN
          CREATE INDEX idx_blog_posts_category ON blog_posts(category);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_blog_posts_published_at') THEN
          CREATE INDEX idx_blog_posts_published_at ON blog_posts(published_at);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_blog_categories_slug') THEN
          CREATE INDEX idx_blog_categories_slug ON blog_categories(slug);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_blog_images_filename') THEN
          CREATE INDEX idx_blog_images_filename ON blog_images(filename);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_blog_images_created_at') THEN
          CREATE INDEX idx_blog_images_created_at ON blog_images(created_at);
        END IF;
      END $$;
    `)

    // Check if categories table is empty before inserting
    const existingCategories = await client.query(`SELECT COUNT(*) as count FROM blog_categories`)
    const categoryCount = Number.parseInt(existingCategories.rows[0].count)

    if (categoryCount === 0) {
      // Insert default categories only if table is completely empty
      await client.query(`
        INSERT INTO blog_categories (name, slug, description) VALUES
          ('Technology', 'technology', 'Latest tech trends and innovations'),
          ('Marketing', 'marketing', 'Digital marketing strategies and tips'),
          ('Events', 'events', 'Event planning and networking insights'),
          ('Business', 'business', 'Business growth and entrepreneurship'),
          ('Local', 'local', 'Local community news and partnerships'),
          ('Medical', 'medical', 'Medical innovations and healthcare technology'),
          ('Science', 'science', 'Scientific breakthroughs and research'),
          ('Robotics', 'robotics', 'Robotics and automation advances'),
          ('Military', 'military', 'Military technology and defense innovations'),
          ('TXMX Boxing', 'txmx-boxing', 'TXMX Boxing news and sports coverage'),
          ('Community', 'community', 'Community events and local business news')
      `)
    } else {
      // Update existing categories to match new naming
      try {
        await client.query(`
          UPDATE blog_categories 
          SET name = 'TXMX Boxing', description = 'TXMX Boxing news and sports coverage'
          WHERE slug = 'boxing'
        `)

        await client.query(`
          UPDATE blog_categories 
          SET name = 'Community', description = 'Community events and local business news'
          WHERE name = 'Local Business' OR slug = 'local-business'
        `)

        // Insert any missing categories
        await client.query(`
          INSERT INTO blog_categories (name, slug, description) VALUES
            ('Technology', 'technology', 'Latest tech trends and innovations'),
            ('Marketing', 'marketing', 'Digital marketing strategies and tips'),
            ('Events', 'events', 'Event planning and networking insights'),
            ('Business', 'business', 'Business growth and entrepreneurship'),
            ('Local', 'local', 'Local community news and partnerships'),
            ('Medical', 'medical', 'Medical innovations and healthcare technology'),
            ('Science', 'science', 'Scientific breakthroughs and research'),
            ('Robotics', 'robotics', 'Robotics and automation advances'),
            ('Military', 'military', 'Military technology and defense innovations'),
            ('TXMX Boxing', 'txmx-boxing', 'TXMX Boxing news and sports coverage'),
            ('Community', 'community', 'Community events and local business news')
          ON CONFLICT (slug) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description
        `)
      } catch (updateError) {
        console.log("Categories already exist, skipping updates")
      }
    }

    dbInitialized = true
    console.log("✅ Blog database initialized successfully with images table")
  } catch (error) {
    console.error("❌ Blog database initialization error:", error)
    // Don't throw error if tables already exist or categories have conflicts
    if (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof (error as any).message === "string"
    ) {
      const errorMessage = (error as any).message
      if (
        errorMessage.includes("already exists") ||
        errorMessage.includes("duplicate key") ||
        errorMessage.includes("unique constraint")
      ) {
        console.log("Database objects already exist, continuing...")
        dbInitialized = true
        return
      }
    }
    throw error
  } finally {
    client.release()
  }
}

export async function ensureDbInitialized() {
  if (!dbInitialized) {
    await initializeBlogDatabase()
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

// Clean filename for better display
function cleanFilename(filename: string): string {
  // Remove file extension
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "")

  // Remove common prefixes and IDs
  const cleaned = nameWithoutExt
    .replace(/^img_\d+_[a-z0-9]+_/i, "") // Remove img_timestamp_randomid_ prefix
    .replace(/^[a-z0-9]{8,}_/i, "") // Remove random ID prefixes
    .replace(/[-_]/g, " ") // Replace dashes and underscores with spaces
    .replace(/\s+/g, " ") // Replace multiple spaces with single space
    .trim()
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize each word
    .join(" ")

  return cleaned || "Uploaded Image"
}

// Format file size for display
function formatFileSize(bytes: number): string {
  if (!bytes || isNaN(bytes)) return "0 B"

  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i]
}

// Blog Images Functions
export async function getBlogImages(): Promise<any[]> {
  const client = await pool.connect()

  try {
    await ensureDbInitialized()

    const query = `
      SELECT * FROM blog_images 
      ORDER BY created_at DESC
    `
    const result = await client.query(query)
    return result.rows.map((row) => ({
      id: row.id,
      filename: cleanFilename(row.original_name), // Use cleaned original name for display
      original_name: row.original_name,
      url: row.url,
      file_size: row.file_size,
      file_size_formatted: formatFileSize(row.file_size),
      mime_type: row.mime_type,
      alt_text: row.alt_text,
      created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
      width: row.width,
      height: row.height,
      uploaded_by: row.uploaded_by,
    }))
  } catch (error) {
    console.error("Error fetching blog images:", error)
    throw new Error("Failed to fetch blog images")
  } finally {
    client.release()
  }
}

export async function createBlogImage(imageData: {
  id: string
  filename: string
  original_name: string
  file_path: string
  url: string
  file_size: number
  mime_type: string
  width?: number
  height?: number
  alt_text?: string
}): Promise<any> {
  const client = await pool.connect()

  try {
    await ensureDbInitialized()

    const query = `
      INSERT INTO blog_images (
        id, filename, original_name, file_path, url, file_size, mime_type, width, height, alt_text, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING *
    `

    const values = [
      imageData.id,
      imageData.filename,
      imageData.original_name,
      imageData.file_path,
      imageData.url,
      imageData.file_size,
      imageData.mime_type,
      imageData.width || null,
      imageData.height || null,
      imageData.alt_text || null,
    ]

    const result = await client.query(query, values)
    const row = result.rows[0]

    return {
      id: row.id,
      filename: cleanFilename(row.original_name), // Return cleaned name for display
      original_name: row.original_name,
      url: row.url,
      file_size: row.file_size,
      file_size_formatted: formatFileSize(row.file_size),
      mime_type: row.mime_type,
      alt_text: row.alt_text,
      created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
      width: row.width,
      height: row.height,
      uploaded_by: row.uploaded_by,
    }
  } catch (error) {
    console.error("Error creating blog image:", error)
    throw new Error("Failed to create blog image")
  } finally {
    client.release()
  }
}

// NEW: Update blog image function
export async function updateBlogImage(imageData: UpdateBlogImageData): Promise<any> {
  const client = await pool.connect()

  try {
    await ensureDbInitialized()

    const query = `
      UPDATE blog_images 
      SET 
        filename = COALESCE($2, filename),
        alt_text = COALESCE($3, alt_text),
        uploaded_by = COALESCE($4, uploaded_by),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `

    const values = [imageData.id, imageData.filename, imageData.alt_text, imageData.uploaded_by]

    const result = await client.query(query, values)

    if (result.rows.length === 0) {
      throw new Error("Image not found")
    }

    const row = result.rows[0]

    return {
      id: row.id,
      filename: row.filename,
      original_name: row.original_name,
      url: row.url,
      file_size: row.file_size,
      file_size_formatted: formatFileSize(row.file_size),
      mime_type: row.mime_type,
      alt_text: row.alt_text,
      created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
      width: row.width,
      height: row.height,
      uploaded_by: row.uploaded_by,
    }
  } catch (error) {
    console.error("Error updating blog image:", error)
    throw new Error("Failed to update blog image")
  } finally {
    client.release()
  }
}

// NEW: Get single blog image function
export async function getBlogImageById(imageId: string): Promise<any> {
  const client = await pool.connect()

  try {
    await ensureDbInitialized()

    const query = `
      SELECT * FROM blog_images 
      WHERE id = $1
    `
    const result = await client.query(query, [imageId])

    if (result.rows.length === 0) {
      return null
    }

    const row = result.rows[0]

    return {
      id: row.id,
      filename: row.filename,
      original_name: row.original_name,
      url: row.url,
      file_size: row.file_size,
      file_size_formatted: formatFileSize(row.file_size),
      mime_type: row.mime_type,
      alt_text: row.alt_text,
      created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
      width: row.width,
      height: row.height,
      uploaded_by: row.uploaded_by,
    }
  } catch (error) {
    console.error("Error fetching blog image:", error)
    throw new Error("Failed to fetch blog image")
  } finally {
    client.release()
  }
}

export async function deleteBlogImages(imageIds: string[]): Promise<void> {
  const client = await pool.connect()

  try {
    await ensureDbInitialized()

    const query = `DELETE FROM blog_images WHERE id = ANY($1)`
    await client.query(query, [imageIds])
  } catch (error) {
    console.error("Error deleting blog images:", error)
    throw new Error("Failed to delete blog images")
  } finally {
    client.release()
  }
}

// Blog Posts Functions
export async function createBlogPost(postData: CreateBlogPostData): Promise<BlogPost> {
  const client = await pool.connect()

  try {
    await ensureDbInitialized()

    // Generate slug if not provided
    const slug = postData.slug || generateSlug(postData.title)
    const readTime = postData.read_time || calculateReadTime(postData.content)
    const publishedAt =
      postData.status === "published" ? (postData.published_at ? new Date(postData.published_at) : new Date()) : null

    const query = `
      INSERT INTO blog_posts (
        title, slug, content, excerpt, featured_image, meta_description,
        category, tags, status, author, published_at, read_time
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `

    const values = [
      postData.title,
      slug,
      postData.content,
      postData.excerpt || null,
      postData.featured_image || null,
      postData.meta_description || null,
      postData.category,
      postData.tags,
      postData.status,
      postData.author,
      publishedAt,
      readTime,
    ]

    const result = await client.query(query, values)
    return mapRowToBlogPost(result.rows[0])
  } catch (error) {
    console.error("Error creating blog post:", error)
    throw new Error("Failed to create blog post")
  } finally {
    client.release()
  }
}

export async function getBlogPosts(filters: BlogFilters = {}): Promise<BlogPost[]> {
  const client = await pool.connect()

  try {
    await ensureDbInitialized()

    let query = `
      SELECT * FROM blog_posts 
      WHERE 1=1
    `
    const values: any[] = []
    let paramCount = 0

    if (filters.status) {
      paramCount++
      query += ` AND status = $${paramCount}`
      values.push(filters.status)
    }

    if (filters.category) {
      paramCount++
      query += ` AND category = $${paramCount}`
      values.push(filters.category)
    }

    if (filters.tag) {
      paramCount++
      query += ` AND $${paramCount} = ANY(tags)`
      values.push(filters.tag)
    }

    if (filters.search) {
      paramCount++
      query += ` AND (title ILIKE $${paramCount} OR content ILIKE $${paramCount})`
      values.push(`%${filters.search}%`)
    }

    query += ` ORDER BY published_at DESC NULLS LAST, created_at DESC`

    if (filters.limit) {
      paramCount++
      query += ` LIMIT $${paramCount}`
      values.push(filters.limit)
    }

    if (filters.offset) {
      paramCount++
      query += ` OFFSET $${paramCount}`
      values.push(filters.offset)
    }

    const result = await client.query(query, values)
    return result.rows.map(mapRowToBlogPost)
  } catch (error) {
    console.error("Error fetching blog posts:", error)
    throw new Error("Failed to fetch blog posts")
  } finally {
    client.release()
  }
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  const client = await pool.connect()

  try {
    await ensureDbInitialized()

    const query = `
      SELECT * FROM blog_posts 
      WHERE slug = $1 AND status = 'published'
    `
    const result = await client.query(query, [slug])

    if (result.rows.length === 0) {
      return null
    }

    // Increment view count
    await client.query(
      `
      UPDATE blog_posts 
      SET view_count = view_count + 1 
      WHERE slug = $1
    `,
      [slug],
    )

    return mapRowToBlogPost(result.rows[0])
  } catch (error) {
    console.error("Error fetching blog post:", error)
    throw new Error("Failed to fetch blog post")
  } finally {
    client.release()
  }
}

export async function updateBlogPost(id: string, updates: UpdateBlogPostData): Promise<BlogPost> {
  const client = await pool.connect()

  try {
    await ensureDbInitialized()

    const readTime = updates.content ? calculateReadTime(updates.content) : undefined
    const publishedAt = updates.status === "published" ? new Date() : undefined

    const query = `
      UPDATE blog_posts 
      SET 
        title = COALESCE($2, title),
        slug = COALESCE($3, slug),
        content = COALESCE($4, content),
        excerpt = COALESCE($5, excerpt),
        featured_image = COALESCE($6, featured_image),
        meta_description = COALESCE($7, meta_description),
        category = COALESCE($8, category),
        tags = COALESCE($9, tags),
        status = COALESCE($10, status),
        author = COALESCE($11, author),
        published_at = COALESCE($12, published_at),
        read_time = COALESCE($13, read_time),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `

    const values = [
      id,
      updates.title,
      updates.slug,
      updates.content,
      updates.excerpt,
      updates.featured_image,
      updates.meta_description,
      updates.category,
      updates.tags,
      updates.status,
      updates.author,
      publishedAt,
      readTime,
    ]

    const result = await client.query(query, values)

    if (result.rows.length === 0) {
      throw new Error("Blog post not found")
    }

    return mapRowToBlogPost(result.rows[0])
  } catch (error) {
    console.error("Error updating blog post:", error)
    throw new Error("Failed to update blog post")
  } finally {
    client.release()
  }
}

export async function deleteBlogPost(id: string): Promise<void> {
  const client = await pool.connect()

  try {
    await ensureDbInitialized()

    const query = `DELETE FROM blog_posts WHERE id = $1`
    const result = await client.query(query, [id])

    if (result.rowCount === 0) {
      throw new Error("Blog post not found")
    }
  } catch (error) {
    console.error("Error deleting blog post:", error)
    throw new Error("Failed to delete blog post")
  } finally {
    client.release()
  }
}

export async function incrementViewCount(slug: string): Promise<void> {
  const client = await pool.connect()

  try {
    await ensureDbInitialized()

    await client.query(
      `
      UPDATE blog_posts 
      SET view_count = view_count + 1 
      WHERE slug = $1
    `,
      [slug],
    )
  } catch (error) {
    console.error("Error incrementing view count:", error)
    throw new Error("Failed to increment view count")
  } finally {
    client.release()
  }
}

// Categories Functions
export async function getBlogCategories(): Promise<BlogCategory[]> {
  const client = await pool.connect()

  try {
    await ensureDbInitialized()

    const query = `
      SELECT 
        c.*,
        COUNT(p.id) as post_count
      FROM blog_categories c
      LEFT JOIN blog_posts p ON c.slug = p.category AND p.status = 'published'
      GROUP BY c.id, c.name, c.slug, c.description, c.created_at
      ORDER BY c.name
    `

    const result = await client.query(query)
    return result.rows.map((row) => ({
      id: row.id.toString(),
      name: row.name,
      slug: row.slug,
      description: row.description,
      post_count: Number.parseInt(row.post_count),
      created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    }))
  } catch (error) {
    console.error("Error fetching blog categories:", error)
    throw new Error("Failed to fetch blog categories")
  } finally {
    client.release()
  }
}

export async function createBlogCategory(
  category: Omit<BlogCategory, "id" | "created_at" | "post_count">,
): Promise<BlogCategory> {
  const client = await pool.connect()

  try {
    await ensureDbInitialized()

    const query = `
      INSERT INTO blog_categories (name, slug, description)
      VALUES ($1, $2, $3)
      RETURNING *
    `

    const values = [category.name, category.slug, category.description]

    const result = await client.query(query, values)
    const row = result.rows[0]
    return {
      id: row.id.toString(),
      name: row.name,
      slug: row.slug,
      description: row.description,
      post_count: 0,
      created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    }
  } catch (error) {
    console.error("Error creating blog category:", error)
    throw new Error("Failed to create blog category")
  } finally {
    client.release()
  }
}

// Helper function to map database row to BlogPost
function mapRowToBlogPost(row: any): BlogPost {
  return {
    id: row.id.toString(),
    title: row.title,
    slug: row.slug,
    content: row.content,
    excerpt: row.excerpt || undefined,
    featured_image: row.featured_image || undefined,
    meta_description: row.meta_description || undefined,
    category: row.category,
    tags: row.tags || [],
    status: row.status,
    author: row.author,
    published_at: row.published_at ? new Date(row.published_at).toISOString() : undefined,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    read_time: row.read_time || undefined,
    view_count: row.view_count || 0,
  }
}
