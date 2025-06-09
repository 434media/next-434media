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
  embedded_media?: EmbeddedMedia[] // New: Track embedded media
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
  file_path?: string // Make optional
  url: string
  file_size: number
  mime_type: string
  width?: number
  height?: number
  alt_text?: string
  uploaded_by: string
  created_at: string
  updated_at: string
  is_binary?: boolean // Add binary flag
}

// New: Embedded Media Types
export interface EmbeddedMedia {
  id: string
  type: "image" | "video" | "audio"
  url: string
  title?: string
  description?: string
  thumbnail?: string
  duration?: number // For videos/audio
  file_size?: number
  mime_type?: string
  embedded_at: string
}

export interface VideoEmbed {
  type: "youtube" | "vimeo" | "direct"
  video_id?: string
  url: string
  title?: string
  thumbnail?: string
  duration?: number
  embed_code: string
}

export interface MediaUploadContext {
  context: "editor" | "featured" | "gallery"
  post_id?: string
  user_id?: string
  session_id?: string
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
  embedded_media?: EmbeddedMedia[] // New: Track embedded media
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
  has_media?: boolean // New: Filter by media presence
  media_type?: "image" | "video" | "audio" // New: Filter by media type
}

export interface CreateBlogImageData {
  id: string
  filename: string
  original_name: string
  file_path?: string // Make optional since we're using binary storage
  url?: string // Make optional since we're using binary storage
  file_size: number
  mime_type: string
  width?: number
  height?: number
  alt_text?: string
  uploaded_by?: string
  image_data?: Buffer // Add binary data support
  context?: MediaUploadContext // New: Upload context
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

// New: Video Embed Response
export interface VideoEmbedResponse {
  success: boolean
  video?: VideoEmbed
  error?: string
  message?: string
}

// New: Media Analysis Response
export interface MediaAnalysisResponse {
  success: boolean
  media_count: number
  total_size: number
  by_type: {
    images: number
    videos: number
    audio: number
  }
  recent_uploads: BlogImage[]
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

// New: Video Embed Form Types
export interface VideoEmbedFormData {
  url: string
  title?: string
  description?: string
}

export interface VideoEmbedValidationErrors {
  url?: string
  title?: string
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

// New: Rich Text Editor Types
export interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  uploadContext?: MediaUploadContext
  onMediaInsert?: (media: EmbeddedMedia) => void
}

export interface EditorToolbarAction {
  id: string
  label: string
  icon: string
  command?: string
  value?: string
  action?: () => void
  isActive?: boolean
  group: "format" | "insert" | "align" | "special"
}

// New: Content Analysis Types
export interface ContentAnalysis {
  word_count: number
  character_count: number
  reading_time: number
  media_count: number
  link_count: number
  heading_structure: {
    h1: number
    h2: number
    h3: number
    h4: number
  }
  seo_score: number
  readability_score: number
}
