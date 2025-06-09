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

export interface BlogImage {
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
  uploaded_by: string
  created_at: string
  updated_at: string
}

export interface CreateBlogPostData {
  title: string
  slug?: string
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

export interface CreateBlogImageData {
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
  uploaded_by?: string
}

// Image editing types
export interface UpdateBlogImageData {
  id: string
  filename?: string
  alt_text?: string
  uploaded_by?: string
}

export interface ImageEditResponse {
  success: boolean
  image?: BlogImage
  error?: string
  message?: string
}

export interface ImageUploadResponse {
  success: boolean
  images?: BlogImage[]
  error?: string
  message?: string
}

export interface BlogImagesResponse {
  success: boolean
  images: BlogImage[]
  error?: string
  total?: number
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Form validation types
export interface BlogPostFormData {
  title: string
  slug: string
  content: string
  excerpt: string
  featured_image: string
  meta_description: string
  category: string
  tags: string[]
  status: "draft" | "published"
  author: string
}

export interface BlogPostValidationErrors {
  title?: string
  slug?: string
  content?: string
  category?: string
  featured_image?: string
  meta_description?: string
}

// Image editing form types
export interface ImageEditFormData {
  filename: string
  alt_text: string
}

export interface ImageEditValidationErrors {
  filename?: string
  alt_text?: string
}

// Helper type for image upload without id (before generation)
export interface ImageUploadData {
  filename: string
  original_name: string
  file_path: string
  url: string
  file_size: number
  mime_type: string
  width?: number
  height?: number
  alt_text?: string
  uploaded_by?: string
}
