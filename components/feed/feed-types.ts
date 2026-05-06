// Shared types for the feed-form admin surface.

export type FeedType = "video" | "article" | "podcast" | "newsletter"
// "scheduled" is a real status — items in this state have a scheduled_at and
// will be flipped to "published" by /api/cron/feed-publish when their time arrives.
export type FeedStatus = "draft" | "scheduled" | "published" | "archived"

export interface FeedComment {
  id: string
  content: string
  author_name: string
  author_email: string
  author_avatar?: string
  created_at: string
  updated_at?: string
}

export interface FeedItem {
  id?: string
  published_date: string
  title: string
  type: FeedType
  summary: string
  authors: string[]
  topics: string[]
  slug: string
  og_image?: string
  og_title?: string
  og_description?: string
  status: FeedStatus
  created_at?: string
  updated_at?: string
  scheduled_at?: string

  // Newsletter-specific fields
  hero_image_desktop?: string
  hero_image_mobile?: string
  founders_note_text?: string
  founders_note_image?: string
  last_month_gif?: string
  the_drop_gif?: string
  featured_post_title?: string
  featured_post_image?: string
  featured_post_content?: string
  upcoming_event_title?: string
  upcoming_event_description?: string
  upcoming_event_image_desktop?: string
  upcoming_event_image_mobile?: string
  upcoming_event_cta_text?: string
  upcoming_event_cta_link?: string

  spotlight_1_title?: string
  spotlight_1_description?: string
  spotlight_1_image?: string
  spotlight_1_cta_text?: string
  spotlight_1_cta_link?: string

  spotlight_2_title?: string
  spotlight_2_description?: string
  spotlight_2_image?: string
  spotlight_2_cta_text?: string
  spotlight_2_cta_link?: string

  spotlight_3_title?: string
  spotlight_3_description?: string
  spotlight_3_image?: string
  spotlight_3_cta_text?: string
  spotlight_3_cta_link?: string

  comments?: FeedComment[]
}

export interface FeedFormData {
  title: string
  type: FeedType
  summary: string
  authors: string[]
  topics: string[]
  slug: string
  published_date: string
  status: FeedStatus
  scheduled_at?: string
  og_image?: string
  og_title?: string
  og_description?: string

  hero_image_desktop?: string
  hero_image_mobile?: string
  founders_note_text?: string
  founders_note_image?: string
  last_month_gif?: string
  the_drop_gif?: string
  featured_post_title?: string
  featured_post_image?: string
  featured_post_content?: string
  upcoming_event_title?: string
  upcoming_event_description?: string
  upcoming_event_image_desktop?: string
  upcoming_event_image_mobile?: string
  upcoming_event_cta_text?: string
  upcoming_event_cta_link?: string

  spotlight_1_title?: string
  spotlight_1_description?: string
  spotlight_1_image?: string
  spotlight_1_cta_text?: string
  spotlight_1_cta_link?: string

  spotlight_2_title?: string
  spotlight_2_description?: string
  spotlight_2_image?: string
  spotlight_2_cta_text?: string
  spotlight_2_cta_link?: string

  spotlight_3_title?: string
  spotlight_3_description?: string
  spotlight_3_image?: string
  spotlight_3_cta_text?: string
  spotlight_3_cta_link?: string
}
