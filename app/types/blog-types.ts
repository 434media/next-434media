export interface BlogPost {
  id: string
  title: string
  slug: string
  content: string
  excerpt?: string
  featured_image?: string
  meta_description?: string
  category: string
  tags: string[]
  status: "draft" | "published"
  author: string
  published_at?: string
  created_at: string
  updated_at: string
  read_time?: number
  view_count?: number
}

export interface BlogCategory {
  id: string
  name: string
  slug: string
  description?: string
  post_count: number
  created_at: string
}

export interface CreateBlogPostData {
  title: string
  slug: string
  content: string
  excerpt?: string
  featured_image?: string
  meta_description?: string
  category: string
  tags: string[]
  status: "draft" | "published"
  author: string
  published_at?: string
  read_time?: number
}

export interface UpdateBlogPostData extends Partial<CreateBlogPostData> {
  id: string
}

export interface BlogFilters {
  category?: string
  tag?: string
  status?: "draft" | "published"
  search?: string
  limit?: number
  offset?: number
}
