import { NextRequest, NextResponse } from "next/server"
import { createFeedItem } from "../../lib/airtable-feed"
import { getSession } from "../../lib/auth"

export async function POST(request: NextRequest) {
  try {
    // Check admin authentication using session
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Get table name from query parameters
    const { searchParams } = new URL(request.url)
    const tableName = searchParams.get("table") || undefined

    // Parse request body
    const feedData = await request.json()

    // Validate required fields
    if (!feedData.title || !feedData.summary) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: title and summary are required" },
        { status: 400 }
      )
    }

    // Create feed item in Airtable
    const createdItem = await createFeedItem(feedData, tableName)

    return NextResponse.json({
      success: true,
      message: "Feed item successfully created in Airtable",
      data: createdItem,
    })
  } catch (error) {
    console.error("Error in feed-submit API:", error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to submit feed item",
      },
      { status: 500 }
    )
  }
}

// GET endpoint to retrieve feed items (optional - for viewing existing items)
export async function GET(request: NextRequest) {
  try {
    // Check admin authentication using session
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") || undefined
    const type = searchParams.get("type") || undefined
    const tableName = searchParams.get("table") || undefined

    console.log(`[API] Fetching feed items - table: ${tableName || 'default'}`)

    // Import getFeedItems dynamically to avoid circular dependencies
    const { getFeedItems } = await import("../../lib/airtable-feed")
    
    const items = await getFeedItems({ status, type, tableName })

    // If no items returned, it could be an authorization issue
    if (items.length === 0) {
      console.log(`[API] No items returned for table: ${tableName || 'default'}. This could indicate an authorization issue or empty table.`)
    }

    return NextResponse.json({
      success: true,
      data: items,
      count: items.length,
      table: tableName || 'thefeed',
    })
  } catch (error) {
    console.error("Error fetching feed items:", error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch feed items",
        hint: "Check server logs for detailed Airtable authorization error messages",
      },
      { status: 500 }
    )
  }
}

// PATCH endpoint to update an existing feed item
export async function PATCH(request: NextRequest) {
  try {
    // Check admin authentication using session
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Get table name from query parameters
    const { searchParams } = new URL(request.url)
    const tableName = searchParams.get("table") || undefined

    // Parse request body
    const { id, ...updates } = await request.json()

    // Validate required fields
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing required field: id" },
        { status: 400 }
      )
    }

    // Import updateFeedItem dynamically
    const { updateFeedItem } = await import("../../lib/airtable-feed")
    
    // Update feed item in Airtable
    const updatedItem = await updateFeedItem(id, updates, tableName)

    return NextResponse.json({
      success: true,
      message: "Feed item successfully updated in Airtable",
      data: updatedItem,
    })
  } catch (error) {
    console.error("Error updating feed item:", error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update feed item",
      },
      { status: 500 }
    )
  }
}

// DELETE endpoint to delete a feed item
export async function DELETE(request: NextRequest) {
  try {
    // Check admin authentication using session
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Get ID and table name from query parameters
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    const tableName = searchParams.get("table") || undefined

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing required parameter: id" },
        { status: 400 }
      )
    }

    // Import deleteFeedItem dynamically
    const { deleteFeedItem } = await import("../../lib/airtable-feed")
    
    // Delete feed item from Airtable
    await deleteFeedItem(id, tableName)

    return NextResponse.json({
      success: true,
      message: "Feed item successfully deleted from Airtable",
    })
  } catch (error) {
    console.error("Error deleting feed item:", error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete feed item",
      },
      { status: 500 }
    )
  }
}
