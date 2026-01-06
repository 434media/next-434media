# Digital Canvas Feed Integration Guide

This document explains how to integrate the 434 Media Feed API with the Digital Canvas website (`digitalcanvas.community`).

## � Security Configuration

The API supports optional security protections. Contact 434 Media to get your API key.

### Environment Variables (434 Media side)

| Variable | Description | Example |
|----------|-------------|---------|
| `FEED_API_REQUIRE_KEY` | Require API key for all requests | `true` or `false` |
| `FEED_API_SECRET` | The API key to validate | `2JPper...` |
| `FEED_API_ALLOWED_ORIGINS` | Comma-separated allowed origins | `https://digitalcanvas.community` |

### Environment Variables (Digital Canvas side)

Add this to your `.env.local`:

```bash
# 434 Media Feed API
FEED_API_URL=https://434media.com/api/public/feed
FEED_API_KEY=your-api-key-here  # Get this from 434 Media team
```

---

## �🔗 API Endpoints

The 434 Media application provides a **public API** for accessing feed data. No authentication is required for reading published content.

### Base URL
```
https://434media.com/api/public/feed
```

### Available Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/public/feed` | GET | Get all published feed items |
| `/api/public/feed?slug=your-post-slug` | GET | Get a single feed item by slug |
| `/api/public/feed?table=THEFEED` | GET | Get items from a specific brand table |
| `/api/public/feed?limit=10` | GET | Limit number of results |

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `table` | string | `THEFEED` | Brand collection: `THEFEED`, `CULTUREDECK`, or `8COUNT` |
| `slug` | string | - | Fetch single item by URL slug |
| `status` | string | `published` | Filter by status (use `all` for everything) |
| `limit` | number | - | Maximum number of items to return |

---

## 📦 Response Structure

### List Response
```json
{
  "success": true,
  "data": [
    {
      "id": "abc123",
      "title": "Newsletter Title",
      "slug": "newsletter-title",
      "type": "newsletter",
      "summary": "Brief summary of the content...",
      "published_date": "2026-01-05",
      "status": "published",
      "authors": ["Digital Canvas Team"],
      "topics": ["Design", "Community"],
      "og_image": "https://example.com/image.jpg",
      "og_title": "Custom Social Title",
      "og_description": "Custom social description...",
      "hero_image_desktop": "https://...",
      "hero_image_mobile": "https://...",
      "founders_note_text": "<p>HTML content...</p>",
      "founders_note_image": "https://...",
      "last_month_gif": "https://...",
      "the_drop_gif": "https://...",
      "featured_post_title": "...",
      "featured_post_image": "https://...",
      "featured_post_content": "<p>HTML content...</p>",
      "upcoming_event_title": "...",
      "upcoming_event_description": "<p>HTML content...</p>",
      "upcoming_event_image_desktop": "https://...",
      "upcoming_event_image_mobile": "https://...",
      "upcoming_event_cta_text": "Register Now",
      "upcoming_event_cta_link": "https://...",
      "spotlight_1_title": "...",
      "spotlight_1_description": "<p>HTML content...</p>",
      "spotlight_1_image": "https://...",
      "spotlight_1_cta_text": "Learn More",
      "spotlight_1_cta_link": "https://...",
      "spotlight_2_title": "...",
      "spotlight_2_description": "...",
      "spotlight_2_image": "...",
      "spotlight_2_cta_text": "...",
      "spotlight_2_cta_link": "...",
      "spotlight_3_title": "...",
      "spotlight_3_description": "...",
      "spotlight_3_image": "...",
      "spotlight_3_cta_text": "...",
      "spotlight_3_cta_link": "..."
    }
  ],
  "count": 10,
  "total": 25,
  "table": "THEFEED"
}
```

### Single Item Response
```json
{
  "success": true,
  "data": {
    "id": "abc123",
    "title": "Newsletter Title",
    "slug": "newsletter-title",
    // ... all fields as above
  }
}
```

---

## 🛠️ Integration Steps

### Step 1: Create a Data Fetching Function

Create a file `lib/api-feed.ts` in your Digital Canvas project:

```typescript
// lib/api-feed.ts

const API_BASE_URL = 'https://434media.com/api/public/feed'

export interface FeedItem {
  id: string
  title: string
  slug: string
  type: 'video' | 'article' | 'podcast' | 'newsletter'
  summary: string
  published_date: string
  status: string
  authors: string[]
  topics: string[]
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

export interface NewsletterContent {
  heroImage: {
    desktop: string
    mobile: string
  }
  foundersNote: {
    text: string
    image: string
  }
  lastMonthGif: string
  theDropGif: string
  featuredPost: {
    title: string
    image: string
    content: string
  }
  spotlights: Array<{
    title: string
    description: string
    image: string
    ctaText: string
    ctaLink: string
  }>
  upcomingEvent: {
    title: string
    description: string
    image: {
      desktop: string
      mobile: string
    }
    ctaText: string
    ctaLink: string
  }
}

// Transform API response to match your NewsletterContent interface
export function transformToNewsletterContent(item: FeedItem): NewsletterContent {
  return {
    heroImage: {
      desktop: item.hero_image_desktop || '',
      mobile: item.hero_image_mobile || '',
    },
    foundersNote: {
      text: item.founders_note_text || '',
      image: item.founders_note_image || '',
    },
    lastMonthGif: item.last_month_gif || '',
    theDropGif: item.the_drop_gif || '',
    featuredPost: {
      title: item.featured_post_title || '',
      image: item.featured_post_image || '',
      content: item.featured_post_content || '',
    },
    spotlights: [
      {
        title: item.spotlight_1_title || '',
        description: item.spotlight_1_description || '',
        image: item.spotlight_1_image || '',
        ctaText: item.spotlight_1_cta_text || '',
        ctaLink: item.spotlight_1_cta_link || '',
      },
      {
        title: item.spotlight_2_title || '',
        description: item.spotlight_2_description || '',
        image: item.spotlight_2_image || '',
        ctaText: item.spotlight_2_cta_text || '',
        ctaLink: item.spotlight_2_cta_link || '',
      },
      {
        title: item.spotlight_3_title || '',
        description: item.spotlight_3_description || '',
        image: item.spotlight_3_image || '',
        ctaText: item.spotlight_3_cta_text || '',
        ctaLink: item.spotlight_3_cta_link || '',
      },
    ].filter(s => s.title), // Only include spotlights with titles
    upcomingEvent: {
      title: item.upcoming_event_title || '',
      description: item.upcoming_event_description || '',
      image: {
        desktop: item.upcoming_event_image_desktop || '',
        mobile: item.upcoming_event_image_mobile || '',
      },
      ctaText: item.upcoming_event_cta_text || '',
      ctaLink: item.upcoming_event_cta_link || '',
    },
  }
}

// Fetch all feed items
export async function getFeedItems(): Promise<FeedItem[]> {
  try {
    const response = await fetch(`${API_BASE_URL}?table=THEFEED`, {
      next: { revalidate: 300 }, // Cache for 5 minutes
      headers: {
        'X-API-Key': process.env.FEED_API_KEY || '',
      },
    })
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }
    
    const result = await response.json()
    return result.success ? result.data : []
  } catch (error) {
    console.error('Error fetching feed items:', error)
    return []
  }
}

// Fetch a single feed item by slug
export async function getFeedItemBySlug(slug: string): Promise<FeedItem | null> {
  try {
    const response = await fetch(`${API_BASE_URL}?table=THEFEED&slug=${slug}`, {
      next: { revalidate: 300 }, // Cache for 5 minutes
      headers: {
        'X-API-Key': process.env.FEED_API_KEY || '',
      },
    })
    
    if (!response.ok) {
      if (response.status === 404) return null
      throw new Error(`API error: ${response.status}`)
    }
    
    const result = await response.json()
    return result.success ? result.data : null
  } catch (error) {
    console.error('Error fetching feed item:', error)
    return null
  }
}
```

---

### Step 2: Update Your Feed Page

Replace your current `/thefeed/page.tsx` to use the API:

```typescript
// app/thefeed/page.tsx
import { getFeedItems } from '@/lib/api-feed'
import TheFeedClient from './client-page'

export const dynamic = 'force-dynamic' // Or use revalidate for ISR

export default async function TheFeedPage() {
  const feedItems = await getFeedItems()
  
  return <TheFeedClient initialItems={feedItems} />
}
```

---

### Step 3: Update Your Feed Detail Page

Update `/thefeed/[slug]/page.tsx` for individual feed items:

```typescript
// app/thefeed/[slug]/page.tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getFeedItemBySlug, transformToNewsletterContent } from '@/lib/api-feed'
import FeedDetailClientPage from './client-page'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const item = await getFeedItemBySlug(slug)
  
  if (!item) {
    return { title: 'Not Found' }
  }
  
  // Use og_title/og_description if available, otherwise fallback to title/summary
  const ogTitle = item.og_title || item.title
  const ogDescription = item.og_description || item.summary
  const ogImage = item.og_image || item.hero_image_desktop
  
  return {
    title: `${item.title} | The Feed - Digital Canvas`,
    description: item.summary,
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      images: ogImage ? [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: ogTitle,
        }
      ] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description: ogDescription,
      images: ogImage ? [ogImage] : [],
    },
  }
}

export default async function FeedDetailPage({ params }: Props) {
  const { slug } = await params
  const item = await getFeedItemBySlug(slug)
  
  if (!item) {
    notFound()
  }
  
  // Transform data for the newsletter template
  const transformedItem = {
    ...item,
    date: new Date(item.published_date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }),
    ogImage: item.og_image || '',
    newsletterContent: item.type === 'newsletter' 
      ? transformToNewsletterContent(item) 
      : undefined,
  }
  
  return <FeedDetailClientPage item={transformedItem} />
}
```

---

### Step 4: Update Your FeedItem Type (if needed)

Make sure your `data/feed-data.ts` types match:

```typescript
// data/feed-data.ts

export interface FeedItem {
  id: string
  title: string
  slug: string
  type: 'video' | 'article' | 'podcast' | 'newsletter'
  summary: string
  date: string  // Formatted date string for display
  published_date: string  // ISO date from API
  authors: string[]
  topics: string[]
  ogImage: string  // For backward compatibility
  og_image?: string
  og_title?: string
  og_description?: string
  newsletterContent?: NewsletterContent
}
```

---

## 🖼️ Open Graph (OG) Image Integration

The API provides three OG-related fields for social media previews:

| Field | Description | Recommended Size |
|-------|-------------|------------------|
| `og_image` | Main social share image | **1200×630px** (1.91:1 ratio) |
| `og_title` | Custom title for social shares (optional) | 60-70 characters |
| `og_description` | Custom description for social shares (optional) | 150-160 characters |

### Implementation Priority

1. Use `og_title` if provided, otherwise use `title`
2. Use `og_description` if provided, otherwise use `summary`
3. Use `og_image` for the preview image

```typescript
// In generateMetadata:
const ogTitle = item.og_title || item.title
const ogDescription = item.og_description || item.summary
const ogImage = item.og_image
```

---

## 🔄 Caching Strategy

The 434 Media API includes caching headers:

```
Cache-Control: public, s-maxage=300, stale-while-revalidate=600
```

This means:
- Content is cached for **5 minutes** (300 seconds)
- Stale content can be served for up to **10 minutes** while revalidating

### Recommended Next.js Configuration

```typescript
// For ISR (Incremental Static Regeneration)
export const revalidate = 300 // 5 minutes

// Or for fully dynamic
export const dynamic = 'force-dynamic'
```

---

## 🌐 CORS Support

The public feed API supports CORS with:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, OPTIONS`

This means you can also fetch data client-side if needed:

```typescript
// Client-side fetch example
useEffect(() => {
  fetch('https://434media.com/api/public/feed?table=THEFEED')
    .then(res => res.json())
    .then(data => setFeedItems(data.data))
}, [])
```

---

## 📋 Field Mapping Reference

| 434 Media API Field | Digital Canvas Field | Notes |
|---------------------|---------------------|-------|
| `title` | `title` | Direct mapping |
| `slug` | `slug` | URL-friendly identifier |
| `published_date` | `date` | Format for display |
| `summary` | `summary` | Brief description |
| `type` | `type` | video, article, podcast, newsletter |
| `authors` | `authors` | Array of author names |
| `topics` | `topics` | Array of topic tags |
| `og_image` | `ogImage` | Social share image (1200×630) |
| `og_title` | - | Custom social title |
| `og_description` | - | Custom social description |
| `hero_image_desktop` | `heroImage.desktop` | Wide hero (1920×1080) |
| `hero_image_mobile` | `heroImage.mobile` | Tall hero (1080×1350) |
| `founders_note_text` | `foundersNote.text` | HTML content |
| `founders_note_image` | `foundersNote.image` | Founder photo |
| `last_month_gif` | `lastMonthGif` | Animated GIF |
| `the_drop_gif` | `theDropGif` | Animated GIF |
| `featured_post_title` | `featuredPost.title` | |
| `featured_post_image` | `featuredPost.image` | |
| `featured_post_content` | `featuredPost.content` | HTML content |
| `upcoming_event_*` | `upcomingEvent.*` | Event section |
| `spotlight_1_*` | `spotlights[0].*` | First spotlight |
| `spotlight_2_*` | `spotlights[1].*` | Second spotlight |
| `spotlight_3_*` | `spotlights[2].*` | Third spotlight |

---

## 🚀 Quick Start Checklist

- [ ] Create `lib/api-feed.ts` with fetch functions
- [ ] Update `/thefeed/page.tsx` to fetch from API
- [ ] Update `/thefeed/[slug]/page.tsx` with proper metadata
- [ ] Add `transformToNewsletterContent` helper function
- [ ] Update types in `data/feed-data.ts`
- [ ] Test OG image previews with [Meta Debugger](https://developers.facebook.com/tools/debug/)
- [ ] Test Twitter cards with [Card Validator](https://cards-dev.twitter.com/validator)

---

## 🔧 Troubleshooting

### CORS Issues
If you encounter CORS errors, make sure you're calling the `/api/public/feed` endpoint (not `/api/feed-submit`).

### Stale Data
Clear your Next.js cache: `rm -rf .next && npm run build`

### 404 Errors
Ensure the feed item has `status: "published"` in the 434 Media admin panel.

### Missing Images
Check that all image URLs are absolute URLs (starting with `https://`).

---

## 📞 Support

For API issues or questions, contact the 434 Media development team.
