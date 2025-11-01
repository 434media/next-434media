"use server"

import { revalidatePath } from "next/cache"
import {
  createBlogPostInAirtable,
  updateBlogPostInAirtable,
  deleteBlogPostFromAirtable,
  getBlogPostsFromAirtable,
  getBlogPostBySlugFromAirtable,
  getBlogCategoriesFromAirtable,
  testAirtableBlogConnection,
} from "../lib/airtable-blog"
import type { CreateBlogPostData, UpdateBlogPostData, BlogFilters } from "../types/blog-types"

// Airtable connection verification
async function ensureAirtableConnected() {
  const isConnected = await testAirtableBlogConnection()
  if (!isConnected) {
    throw new Error("Airtable blog connection failed")
  }
}

// Simple admin verification - only admin password
function verifyAdminPassword(password: string): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD

  if (!adminPassword || password.length !== adminPassword.length) {
    return false
  }

  // Timing-safe comparison to prevent timing attacks
  let result = 0
  for (let i = 0; i < password.length; i++) {
    result |= password.charCodeAt(i) ^ adminPassword.charCodeAt(i)
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
  try {
    await ensureAirtableConnected()

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

    const post = await createBlogPostInAirtable(postData)

    revalidatePath("/blog")
    revalidatePath("/admin/blog")

    return { success: true, post }
  } catch (error) {
    console.error("Error creating blog post:", error)
    return { success: false, error: "Failed to create blog post" }
  }
}

export async function updateBlogPostAction(formData: FormData) {
  try {
    await ensureAirtableConnected()

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

    const post = await updateBlogPostInAirtable(id, updates)

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
  try {
    await ensureAirtableConnected()

    // Verify admin password
    if (!verifyAdminPassword(adminPassword)) {
      return { success: false, error: "Invalid admin password" }
    }

    await deleteBlogPostFromAirtable(id)

    revalidatePath("/blog")
    revalidatePath("/admin/blog")

    return { success: true }
  } catch (error) {
    console.error("Error deleting blog post:", error)
    return { success: false, error: "Failed to delete blog post" }
  }
}

export async function getBlogPostsAction(filters: BlogFilters = {}) {
  try {
    await ensureAirtableConnected()

    const posts = await getBlogPostsFromAirtable(filters)
    return { success: true, posts }
  } catch (error) {
    console.error("Error fetching blog posts:", error)
    return { success: false, error: "Failed to fetch blog posts" }
  }
}

export async function getBlogPostBySlugAction(slug: string) {
  try {
    await ensureAirtableConnected()

    const post = await getBlogPostBySlugFromAirtable(slug)
    return { success: true, post }
  } catch (error) {
    console.error("Error fetching blog post:", error)
    return { success: false, error: "Failed to fetch blog post" }
  }
}

export async function getBlogCategoriesAction() {
  try {
    await ensureAirtableConnected()

    const categories = await getBlogCategoriesFromAirtable()
    return { success: true, categories }
  } catch (error) {
    console.error("Error fetching blog categories:", error)
    return { success: false, error: "Failed to fetch blog categories" }
  }
}
