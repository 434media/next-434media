import Airtable from "airtable"

// Initialize Airtable base for The Feed
const thefeedsBaseId = process.env.THEFEEDS_BASE_ID
const thefeedsApiKey = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_EVENTS_API_KEY
const thefeedsTableName = process.env.THEFEEDS_TABLE_NAME || "thefeed"

if (!thefeedsBaseId || !thefeedsApiKey) {
  console.warn("The Feed Airtable configuration is missing. Please set THEFEEDS_BASE_ID and AIRTABLE_API_KEY")
}

// Initialize Airtable base (only if credentials are available)
let feedBase: Airtable.Base | null = null
if (thefeedsBaseId && thefeedsApiKey) {
  feedBase = new Airtable({ apiKey: thefeedsApiKey }).base(thefeedsBaseId)
}

// Types for The Feed items
export interface FeedItem {
  id?: string
  published_date: string
  title: string
  type: "video" | "article" | "podcast" | "newsletter"
  summary: string
  authors: string[]
  topics: string[]
  slug: string
  og_image?: string
  status: "draft" | "published" | "archived"
  
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
  
  // Spotlight fields (inline - 1, 2, 3)
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

// Map Airtable record to FeedItem interface
function mapAirtableToFeedItem(record: any): FeedItem {
  const fields = record.fields

  // Helper function to extract image URL from Airtable attachment
  const getImageUrl = (fieldName: string): string | undefined => {
    const field = fields[fieldName]
    if (!field) return undefined
    if (typeof field === "string") return field
    if (Array.isArray(field) && field.length > 0) {
      return field[0].url || field[0].thumbnails?.large?.url || field[0].thumbnails?.small?.url
    }
    return undefined
  }

  return {
    id: record.id,
    published_date: fields.published_date || fields.Published_Date || new Date().toISOString(),
    title: fields.title || fields.Title || "",
    type: (fields.type || fields.Type || "newsletter").toLowerCase() as FeedItem["type"],
    summary: fields.summary || fields.Summary || "",
    authors: fields.authors || fields.Authors || [],
    topics: fields.topics || fields.Topics || [],
    slug: fields.slug || fields.Slug || "",
    og_image: getImageUrl("og_image") || getImageUrl("OG_Image"),
    status: (fields.status || fields.Status || "draft").toLowerCase() as FeedItem["status"],
    
    // Newsletter-specific fields
    hero_image_desktop: getImageUrl("hero_image_desktop") || getImageUrl("Hero_Image_Desktop"),
    hero_image_mobile: getImageUrl("hero_image_mobile") || getImageUrl("Hero_Image_Mobile"),
    founders_note_text: fields.founders_note_text || fields.Founders_Note_Text,
    founders_note_image: getImageUrl("founders_note_image") || getImageUrl("Founders_Note_Image"),
    last_month_gif: getImageUrl("last_month_gif") || getImageUrl("Last_Month_GIF"),
    the_drop_gif: getImageUrl("the_drop_gif") || getImageUrl("The_Drop_GIF"),
    featured_post_title: fields.featured_post_title || fields.Featured_Post_Title,
    featured_post_image: getImageUrl("featured_post_image") || getImageUrl("Featured_Post_Image"),
    featured_post_content: fields.featured_post_content || fields.Featured_Post_Content,
    upcoming_event_title: fields.upcoming_event_title || fields.Upcoming_Event_Title,
    upcoming_event_description: fields.upcoming_event_description || fields.Upcoming_Event_Description,
    upcoming_event_image_desktop: getImageUrl("upcoming_event_image_desktop") || getImageUrl("Upcoming_Event_Image_Desktop"),
    upcoming_event_image_mobile: getImageUrl("upcoming_event_image_mobile") || getImageUrl("Upcoming_Event_Image_Mobile"),
    upcoming_event_cta_text: fields.upcoming_event_cta_text || fields.Upcoming_Event_CTA_Text,
    upcoming_event_cta_link: fields.upcoming_event_cta_link || fields.Upcoming_Event_CTA_Link,
    
    // Spotlight fields (inline)
    spotlight_1_title: fields.spotlight_1_title || fields.Spotlight_1_Title,
    spotlight_1_description: fields.spotlight_1_description || fields.Spotlight_1_Description,
    spotlight_1_image: getImageUrl("spotlight_1_image") || getImageUrl("Spotlight_1_Image"),
    spotlight_1_cta_text: fields.spotlight_1_cta_text || fields.Spotlight_1_CTA_Text,
    spotlight_1_cta_link: fields.spotlight_1_cta_link || fields.Spotlight_1_CTA_Link,
    
    spotlight_2_title: fields.spotlight_2_title || fields.Spotlight_2_Title,
    spotlight_2_description: fields.spotlight_2_description || fields.Spotlight_2_Description,
    spotlight_2_image: getImageUrl("spotlight_2_image") || getImageUrl("Spotlight_2_Image"),
    spotlight_2_cta_text: fields.spotlight_2_cta_text || fields.Spotlight_2_CTA_Text,
    spotlight_2_cta_link: fields.spotlight_2_cta_link || fields.Spotlight_2_CTA_Link,
    
    spotlight_3_title: fields.spotlight_3_title || fields.Spotlight_3_Title,
    spotlight_3_description: fields.spotlight_3_description || fields.Spotlight_3_Description,
    spotlight_3_image: getImageUrl("spotlight_3_image") || getImageUrl("Spotlight_3_Image"),
    spotlight_3_cta_text: fields.spotlight_3_cta_text || fields.Spotlight_3_CTA_Text,
    spotlight_3_cta_link: fields.spotlight_3_cta_link || fields.Spotlight_3_CTA_Link,
  }
}

// Map FeedItem to Airtable fields
function mapFeedItemToAirtable(item: Partial<FeedItem>): any {
  const airtableData: any = {}

  // Helper function to convert URL string to Airtable attachment format
  const formatAttachment = (url: string | undefined): any[] | undefined => {
    if (!url || url.trim() === "") return undefined
    return [{ url: url.trim() }]
  }

  // Basic fields - map to snake_case as per your Airtable schema
  if (item.published_date !== undefined) airtableData.published_date = item.published_date
  if (item.title !== undefined) airtableData.title = item.title
  if (item.type !== undefined) airtableData.type = item.type
  if (item.summary !== undefined) airtableData.summary = item.summary
  
  // Ensure authors is always an array of clean strings (not stringified, no extra quotes)
  if (item.authors !== undefined) {
    let authorsArray = item.authors
    
    // Handle stringified array
    if (typeof item.authors === 'string') {
      try {
        authorsArray = JSON.parse(item.authors)
      } catch {
        authorsArray = [item.authors]
      }
    }
    
    // Ensure array and clean each string (remove extra quotes, trim whitespace)
    if (Array.isArray(authorsArray)) {
      airtableData.authors = authorsArray.map(author => {
        // Remove surrounding quotes if present and trim
        let cleanAuthor = String(author).trim()
        // Remove leading/trailing quotes
        cleanAuthor = cleanAuthor.replace(/^["']|["']$/g, '')
        return cleanAuthor
      }).filter(Boolean) // Remove empty strings
    } else {
      airtableData.authors = []
    }
  }
  
  // Ensure topics is always an array of clean strings (not stringified, no extra quotes)
  if (item.topics !== undefined) {
    let topicsArray = item.topics
    
    // Handle stringified array
    if (typeof item.topics === 'string') {
      try {
        topicsArray = JSON.parse(item.topics)
      } catch {
        topicsArray = [item.topics]
      }
    }
    
    // Ensure array and clean each string (remove extra quotes, trim whitespace)
    if (Array.isArray(topicsArray)) {
      airtableData.topics = topicsArray.map(topic => {
        // Remove surrounding quotes if present and trim
        let cleanTopic = String(topic).trim()
        // Remove leading/trailing quotes
        cleanTopic = cleanTopic.replace(/^["']|["']$/g, '')
        return cleanTopic
      }).filter(Boolean) // Remove empty strings
    } else {
      airtableData.topics = []
    }
  }
  
  if (item.slug !== undefined) airtableData.slug = item.slug
  if (item.og_image !== undefined) airtableData.og_image = formatAttachment(item.og_image)
  if (item.status !== undefined) airtableData.status = item.status

  // Newsletter-specific fields (images as attachments)
  if (item.hero_image_desktop !== undefined) airtableData.hero_image_desktop = formatAttachment(item.hero_image_desktop)
  if (item.hero_image_mobile !== undefined) airtableData.hero_image_mobile = formatAttachment(item.hero_image_mobile)
  if (item.founders_note_text !== undefined) airtableData.founders_note_text = item.founders_note_text
  if (item.founders_note_image !== undefined) airtableData.founders_note_image = formatAttachment(item.founders_note_image)
  if (item.last_month_gif !== undefined) airtableData.last_month_gif = formatAttachment(item.last_month_gif)
  if (item.the_drop_gif !== undefined) airtableData.the_drop_gif = formatAttachment(item.the_drop_gif)
  if (item.featured_post_title !== undefined) airtableData.featured_post_title = item.featured_post_title
  if (item.featured_post_image !== undefined) airtableData.featured_post_image = formatAttachment(item.featured_post_image)
  if (item.featured_post_content !== undefined) airtableData.featured_post_content = item.featured_post_content
  if (item.upcoming_event_title !== undefined) airtableData.upcoming_event_title = item.upcoming_event_title
  if (item.upcoming_event_description !== undefined) airtableData.upcoming_event_description = item.upcoming_event_description
  if (item.upcoming_event_image_desktop !== undefined) airtableData.upcoming_event_image_desktop = formatAttachment(item.upcoming_event_image_desktop)
  if (item.upcoming_event_image_mobile !== undefined) airtableData.upcoming_event_image_mobile = formatAttachment(item.upcoming_event_image_mobile)
  if (item.upcoming_event_cta_text !== undefined) airtableData.upcoming_event_cta_text = item.upcoming_event_cta_text
  if (item.upcoming_event_cta_link !== undefined) airtableData.upcoming_event_cta_link = item.upcoming_event_cta_link

  // Spotlight fields (inline - images as attachments)
  if (item.spotlight_1_title !== undefined) airtableData.spotlight_1_title = item.spotlight_1_title
  if (item.spotlight_1_description !== undefined) airtableData.spotlight_1_description = item.spotlight_1_description
  if (item.spotlight_1_image !== undefined) airtableData.spotlight_1_image = formatAttachment(item.spotlight_1_image)
  if (item.spotlight_1_cta_text !== undefined) airtableData.spotlight_1_cta_text = item.spotlight_1_cta_text
  if (item.spotlight_1_cta_link !== undefined) airtableData.spotlight_1_cta_link = item.spotlight_1_cta_link

  if (item.spotlight_2_title !== undefined) airtableData.spotlight_2_title = item.spotlight_2_title
  if (item.spotlight_2_description !== undefined) airtableData.spotlight_2_description = item.spotlight_2_description
  if (item.spotlight_2_image !== undefined) airtableData.spotlight_2_image = formatAttachment(item.spotlight_2_image)
  if (item.spotlight_2_cta_text !== undefined) airtableData.spotlight_2_cta_text = item.spotlight_2_cta_text
  if (item.spotlight_2_cta_link !== undefined) airtableData.spotlight_2_cta_link = item.spotlight_2_cta_link

  if (item.spotlight_3_title !== undefined) airtableData.spotlight_3_title = item.spotlight_3_title
  if (item.spotlight_3_description !== undefined) airtableData.spotlight_3_description = item.spotlight_3_description
  if (item.spotlight_3_image !== undefined) airtableData.spotlight_3_image = formatAttachment(item.spotlight_3_image)
  if (item.spotlight_3_cta_text !== undefined) airtableData.spotlight_3_cta_text = item.spotlight_3_cta_text
  if (item.spotlight_3_cta_link !== undefined) airtableData.spotlight_3_cta_link = item.spotlight_3_cta_link

  return airtableData
}

// Get all feed items from Airtable
export async function getFeedItems(filters?: { status?: string; type?: string; tableName?: string }): Promise<FeedItem[]> {
  if (!feedBase) {
    console.warn("Airtable not configured for The Feed")
    return []
  }

  try {
    const tableName = filters?.tableName || thefeedsTableName
    let filterFormula = ""
    const conditions: string[] = []

    if (filters?.status) {
      conditions.push(`{status} = "${filters.status}"`)
    }

    if (filters?.type) {
      conditions.push(`{type} = "${filters.type}"`)
    }

    if (conditions.length > 0) {
      filterFormula = conditions.length === 1 ? conditions[0] : `AND(${conditions.join(", ")})`
    }

    const selectOptions: any = {
      sort: [{ field: "published_date", direction: "desc" }],
    }

    if (filterFormula) {
      selectOptions.filterByFormula = filterFormula
    }

    const records = await feedBase(tableName)
      .select(selectOptions)
      .all()

    return records.map(mapAirtableToFeedItem)
  } catch (error) {
    console.error("Error fetching feed items from Airtable:", error)
    return []
  }
}

// Get a specific feed item by slug
export async function getFeedItemBySlug(slug: string): Promise<FeedItem | null> {
  if (!feedBase) {
    console.warn("Airtable not configured for The Feed")
    return null
  }

  try {
    const records = await feedBase(thefeedsTableName)
      .select({
        filterByFormula: `{slug} = "${slug}"`,
        maxRecords: 1,
      })
      .all()

    if (records.length === 0) {
      return null
    }

    return mapAirtableToFeedItem(records[0])
  } catch (error) {
    console.error("Error fetching feed item by slug from Airtable:", error)
    return null
  }
}

// Create a new feed item in Airtable
export async function createFeedItem(item: Partial<FeedItem>): Promise<FeedItem> {
  if (!feedBase) {
    throw new Error("Airtable not configured for The Feed. Please set THEFEEDS_BASE_ID and AIRTABLE_API_KEY")
  }

  try {
    const airtableData = mapFeedItemToAirtable(item)

    const records = await feedBase(thefeedsTableName).create([
      {
        fields: airtableData,
      },
    ])

    if (records.length === 0) {
      throw new Error("No records created in Airtable")
    }

    return mapAirtableToFeedItem(records[0])
  } catch (error) {
    console.error("Error creating feed item in Airtable:", error)
    throw new Error(`Failed to create feed item in Airtable: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

// Update a feed item in Airtable
export async function updateFeedItem(id: string, updates: Partial<FeedItem>): Promise<FeedItem> {
  if (!feedBase) {
    throw new Error("Airtable not configured for The Feed")
  }

  try {
    const airtableUpdates = mapFeedItemToAirtable(updates)

    const records = await feedBase(thefeedsTableName).update([
      {
        id,
        fields: airtableUpdates,
      },
    ])

    if (records.length === 0) {
      throw new Error("No records updated in Airtable")
    }

    return mapAirtableToFeedItem(records[0])
  } catch (error) {
    console.error("Error updating feed item in Airtable:", error)
    throw new Error("Failed to update feed item in Airtable")
  }
}

// Delete a feed item from Airtable
export async function deleteFeedItem(id: string): Promise<void> {
  if (!feedBase) {
    throw new Error("Airtable not configured for The Feed")
  }

  try {
    await feedBase(thefeedsTableName).destroy([id])
  } catch (error) {
    console.error("Error deleting feed item from Airtable:", error)
    throw new Error("Failed to delete feed item from Airtable")
  }
}

// Test Airtable connection for The Feed
export async function testFeedAirtableConnection(): Promise<boolean> {
  if (!feedBase) {
    console.error("❌ The Feed Airtable not configured")
    return false
  }

  try {
    console.log("Testing The Feed Airtable connection...")
    console.log("Base ID:", thefeedsBaseId)
    console.log("Table Name:", thefeedsTableName)
    
    await feedBase(thefeedsTableName)
      .select({ maxRecords: 1 })
      .firstPage()
    
    console.log("✅ The Feed Airtable connection successful")
    return true
  } catch (error) {
    console.error("❌ The Feed Airtable connection test failed:", error)
    
    if (error instanceof Error) {
      console.error("Connection error details:", {
        message: error.message,
        name: error.name,
      })
    }
    
    return false
  }
}
