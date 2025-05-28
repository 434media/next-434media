"use server"

import { revalidatePath } from "next/cache"
import {
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
  getBlogPosts,
  getBlogPostBySlug,
  getBlogCategories,
  initializeBlogDatabase,
} from "../lib/blog-db"
import type { CreateBlogPostData, UpdateBlogPostData, BlogFilters } from "../types/blog-types"

// Initialize database on first load
let dbInitialized = false

async function ensureDbInitialized() {
  if (!dbInitialized) {
    try {
      await initializeBlogDatabase()
      dbInitialized = true
    } catch (error) {
      console.error("Database initialization warning:", error)
      dbInitialized = true
    }
  }
}

// Simple admin verification
function verifyAdminPassword(password: string): boolean {
  // Timing-safe comparison to prevent timing attacks
  if (!process.env.ADMIN_PASSWORD || password.length !== process.env.ADMIN_PASSWORD.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < password.length; i++) {
    result |= password.charCodeAt(i) ^ process.env.ADMIN_PASSWORD.charCodeAt(i)
  }

  return result === 0
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

export async function createBlogPostAction(formData: FormData) {
  await ensureDbInitialized()

  try {
    const adminPassword = formData.get("adminPassword") as string

    // Verify admin password
    if (!verifyAdminPassword(adminPassword)) {
      return { success: false, error: "Invalid admin password" }
    }

    const title = formData.get("title") as string
    const content = formData.get("content") as string

    const postData: CreateBlogPostData = {
      title,
      slug: generateSlug(title),
      content,
      excerpt: (formData.get("excerpt") as string) || undefined,
      featured_image: (formData.get("featured_image") as string) || undefined,
      meta_description: (formData.get("meta_description") as string) || undefined,
      category: formData.get("category") as string,
      tags: JSON.parse((formData.get("tags") as string) || "[]"),
      status: formData.get("status") as "draft" | "published",
      author: (formData.get("author") as string) || "434 Media",
      read_time: calculateReadTime(content),
    }

    const post = await createBlogPost(postData)

    revalidatePath("/blog")
    revalidatePath("/admin/blog")

    return { success: true, post }
  } catch (error) {
    console.error("Error creating blog post:", error)
    return { success: false, error: "Failed to create blog post" }
  }
}

export async function updateBlogPostAction(formData: FormData) {
  await ensureDbInitialized()

  try {
    const id = formData.get("id") as string
    const title = formData.get("title") as string
    const content = formData.get("content") as string

    const updates: UpdateBlogPostData = {
      id,
      title,
      slug: title ? generateSlug(title) : undefined,
      content,
      excerpt: (formData.get("excerpt") as string) || undefined,
      featured_image: (formData.get("featured_image") as string) || undefined,
      meta_description: (formData.get("meta_description") as string) || undefined,
      category: formData.get("category") as string,
      tags: JSON.parse((formData.get("tags") as string) || "[]"),
      status: formData.get("status") as "draft" | "published",
      author: formData.get("author") as string,
      read_time: content ? calculateReadTime(content) : undefined,
    }

    const post = await updateBlogPost(id, updates)

    revalidatePath("/blog")
    revalidatePath("/admin/blog")
    revalidatePath(`/blog/${post.slug}`)

    return { success: true, post }
  } catch (error) {
    console.error("Error updating blog post:", error)
    return { success: false, error: "Failed to update blog post" }
  }
}

export async function deleteBlogPostAction(id: string, adminPassword: string) {
  await ensureDbInitialized()

  // Verify admin password (same as events)
  if (!verifyAdminPassword(adminPassword)) {
    return { success: false, error: "Invalid admin password" }
  }

  try {
    await deleteBlogPost(id)

    revalidatePath("/blog")
    revalidatePath("/admin/blog")

    return { success: true }
  } catch (error) {
    console.error("Error deleting blog post:", error)
    return { success: false, error: "Failed to delete blog post" }
  }
}

export async function getBlogPostsAction(filters: BlogFilters = {}) {
  await ensureDbInitialized()

  try {
    const posts = await getBlogPosts(filters)
    return { success: true, posts }
  } catch (error) {
    console.error("Error fetching blog posts:", error)
    return { success: false, error: "Failed to fetch blog posts" }
  }
}

export async function getBlogPostBySlugAction(slug: string) {
  await ensureDbInitialized()

  try {
    const post = await getBlogPostBySlug(slug)
    return { success: true, post }
  } catch (error) {
    console.error("Error fetching blog post:", error)
    return { success: false, error: "Failed to fetch blog post" }
  }
}

export async function getBlogCategoriesAction() {
  await ensureDbInitialized()

  try {
    const categories = await getBlogCategories()
    return { success: true, categories }
  } catch (error) {
    console.error("Error fetching blog categories:", error)
    return { success: false, error: "Failed to fetch blog categories" }
  }
}
