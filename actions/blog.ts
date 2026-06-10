"use server"

import {
  getBlogPostsFromFirestore,
  getBlogPostBySlugFromFirestore,
  testFirestoreBlogConnection,
} from "../lib/firestore-blog"
import type { BlogFilters } from "../types/blog-types"

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

    const posts = await getBlogPostsFromFirestore(filters)
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
