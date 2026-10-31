"use server"

import {
  getBlogPostsFromFirestore,
  getBlogPostBySlugFromFirestore,
  testFirestoreBlogConnection,
} from "../lib/firestore-blog"
import type { BlogFilters } from "../types/blog-types"
import { getSession, isAuthorizedAdmin } from "../lib/auth"
import { blogFiltersFor } from "../lib/blog-access"

// Firestore connection verification
async function ensureFirestoreConnected() {
  const isConnected = await testFirestoreBlogConnection()
  if (!isConnected) {
    throw new Error("Firestore blog connection failed")
  }
}

export async function getBlogPostsAction(filters: BlogFilters = {}) {
  try {
    await ensureFirestoreConnected()

    // Drafts need an admin session; everyone else reads published posts only (security log ADM-7).
    const session = await getSession()
    const isAdmin = !!session && isAuthorizedAdmin(session.email)
    const posts = await getBlogPostsFromFirestore(blogFiltersFor(filters, isAdmin))
    return { success: true, posts }
  } catch (error) {
    console.error("Error fetching blog posts:", error)
    return { success: false, error: "Failed to fetch blog posts" }
  }
}

export async function getBlogPostBySlugAction(slug: string) {
  try {
    await ensureFirestoreConnected()

    const post = await getBlogPostBySlugFromFirestore(slug)
    return { success: true, post }
  } catch (error) {
    console.error("Error fetching blog post:", error)
    return { success: false, error: "Failed to fetch blog post" }
  }
}
