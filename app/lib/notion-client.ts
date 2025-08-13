import { Client } from "@notionhq/client"
import { storeInKnowledgeBase } from "./knowledge-base"

// Initialize Notion client
const notion = new Client({
  auth: process.env.NOTION_TOKEN,
})

export interface NotionPage {
  id: string
  title: string
  content: string
  url: string
  lastEdited: string
}

export async function ingestNotionData() {
  try {
    // Get database ID from environment variable
    const databaseId = process.env.NOTION_DATABASE_ID
    if (!databaseId) {
      throw new Error("NOTION_DATABASE_ID environment variable is required")
    }

    // Query the database
    const response = await notion.databases.query({
      database_id: databaseId,
      page_size: 100,
    })

    const pages: NotionPage[] = []

    for (const page of response.results) {
      // Type guard to ensure we have a full page object
      if ("properties" in page && "url" in page && "last_edited_time" in page) {
        try {
          // Extract page content
          const pageContent = await getPageContent(page.id)
          const title = extractTitle(page.properties)

          const notionPage: NotionPage = {
            id: page.id,
            title,
            content: pageContent,
            url: page.url,
            lastEdited: page.last_edited_time,
          }

          pages.push(notionPage)

          // Store in knowledge base
          await storeInKnowledgeBase(notionPage)
        } catch (error) {
          console.error(`Error processing page ${page.id}:`, error)
        }
      } else {
        console.warn(`Skipping incomplete page object: ${page.id}`)
      }
    }

    return { count: pages.length, pages }
  } catch (error) {
    console.error("Error ingesting Notion data:", error)
    throw error
  }
}

async function getPageContent(pageId: string): Promise<string> {
  try {
    const blocks = await notion.blocks.children.list({
      block_id: pageId,
      page_size: 100,
    })

    let content = ""

    for (const block of blocks.results) {
      if ("type" in block) {
        content += extractBlockText(block) + "\n"
      }
    }

    return content.trim()
  } catch (error) {
    console.error(`Error getting content for page ${pageId}:`, error)
    return ""
  }
}

function extractTitle(properties: any): string {
  // Try to find title property
  for (const [key, value] of Object.entries(properties)) {
    if (value && typeof value === "object" && "title" in value) {
      const titleArray = (value as any).title
      if (Array.isArray(titleArray) && titleArray.length > 0) {
        return titleArray[0].plain_text || "Untitled"
      }
    }
  }
  return "Untitled"
}

function extractBlockText(block: any): string {
  const { type } = block

  switch (type) {
    case "paragraph":
      return extractRichText(block.paragraph?.rich_text || [])
    case "heading_1":
      return "# " + extractRichText(block.heading_1?.rich_text || [])
    case "heading_2":
      return "## " + extractRichText(block.heading_2?.rich_text || [])
    case "heading_3":
      return "### " + extractRichText(block.heading_3?.rich_text || [])
    case "bulleted_list_item":
      return "• " + extractRichText(block.bulleted_list_item?.rich_text || [])
    case "numbered_list_item":
      return "1. " + extractRichText(block.numbered_list_item?.rich_text || [])
    case "code":
      return "```\n" + extractRichText(block.code?.rich_text || []) + "\n```"
    case "quote":
      return "> " + extractRichText(block.quote?.rich_text || [])
    default:
      return ""
  }
}

function extractRichText(richText: any[]): string {
  return richText.map((text) => text.plain_text || "").join("")
}
