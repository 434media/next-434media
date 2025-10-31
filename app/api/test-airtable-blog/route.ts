import { NextResponse } from "next/server"
import { testAirtableBlogConnection } from "../../lib/airtable-blog"
import Airtable from "airtable"

export async function GET() {
  try {
    console.log("🔍 Testing Airtable Blog Connection...")
    
    // Check environment variables
    const baseId = process.env.AIRTABLE_BLOG_BASE_ID
    const apiKey = process.env.AIRTABLE_BLOG_API_KEY
    
    console.log("Environment check:")
    console.log("- AIRTABLE_BLOG_BASE_ID:", baseId ? `${baseId.substring(0, 6)}...` : "NOT SET")
    console.log("- AIRTABLE_BLOG_API_KEY:", apiKey ? `${apiKey.substring(0, 10)}...` : "NOT SET")
    
    if (!baseId || !apiKey) {
      return NextResponse.json({
        success: false,
        error: "Missing Airtable environment variables",
        details: {
          hasBaseId: !!baseId,
          hasApiKey: !!apiKey
        }
      }, { status: 500 })
    }
    
    // Test connection and get table info
    const isConnected = await testAirtableBlogConnection()
    
    let tableInfo = {}
    
    if (isConnected) {
      try {
        const base = new Airtable({ apiKey }).base(baseId)
        
        // Try to get a sample from Blog Posts table
        const blogPostsTable = await base("Blog Posts").select({ maxRecords: 1 }).firstPage()
        
        // Try to get Categories table info
        let categoriesTable: any[] = []
        let categoriesExists = false
        try {
          const categoriesResult = await base("Categories").select({ maxRecords: 1 }).firstPage()
          categoriesTable = [...categoriesResult]
          categoriesExists = true
        } catch (e) {
          console.log("Categories table not found or accessible")
        }
        
        tableInfo = {
          blogPostsExists: true,
          blogPostsCount: blogPostsTable.length,
          categoriesExists,
          sampleFields: blogPostsTable.length > 0 ? Object.keys(blogPostsTable[0].fields) : []
        }
      } catch (tableError) {
        console.error("Error checking table structure:", tableError)
        tableInfo = {
          error: tableError instanceof Error ? tableError.message : "Unknown table error"
        }
      }
    }
    
    return NextResponse.json({
      success: isConnected,
      message: isConnected ? "Airtable blog connection successful" : "Airtable blog connection failed",
      config: {
        baseId: baseId.substring(0, 6) + "...",
        apiKeyPrefix: apiKey.substring(0, 10) + "..."
      },
      tableInfo
    })
    
  } catch (error) {
    console.error("Test API error:", error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      details: error instanceof Error ? {
        name: error.name,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      } : undefined
    }, { status: 500 })
  }
}