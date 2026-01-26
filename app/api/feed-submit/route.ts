import { NextRequest, NextResponse } from "next/server"
import { 
  createFeedItem, 
  getFeedItems, 
  updateFeedItem, 
  deleteFeedItem 
} from "../../lib/firestore-feed"
import { getSession } from "../../lib/auth"

// Force dynamic rendering - this route uses auth and Firestore
export const dynamic = 'force-dynamic'

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

    // Create feed item in Firestore
    const createdItem = await createFeedItem(feedData, tableName)

    return NextResponse.json({
      success: true,
      message: "Feed item successfully created",
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

// GET endpoint to retrieve feed items
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

    console.log(`[API] Fetching feed items from Firestore - table: ${tableName || 'default'}`)

    const items = await getFeedItems({ status, type, tableName })

    return NextResponse.json({
      success: true,
      data: items,
      count: items.length,
      table: tableName || 'thefeed',
      source: 'firestore',
    })
  } catch (error) {
    console.error("Error fetching feed items:", error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch feed items",
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

    // Update feed item in Firestore
    const updatedItem = await updateFeedItem(id, updates, tableName)

    return NextResponse.json({
      success: true,
      message: "Feed item successfully updated",
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

    // Delete feed item from Firestore
    await deleteFeedItem(id, tableName)

    return NextResponse.json({
      success: true,
      message: "Feed item successfully deleted",
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
