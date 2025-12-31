import { type NextRequest, NextResponse } from "next/server"
import { getSession, isWorkspaceEmail } from "@/app/lib/auth"
import { getMasterList } from "@/app/lib/firestore-crm"

// Check admin access
async function requireAdmin() {
  const session = await getSession()

  if (!session) {
    return { error: "Unauthorized", status: 401 }
  }

  if (!isWorkspaceEmail(session.email)) {
    return { error: "Forbidden: Workspace email required", status: 403 }
  }

  return { session }
}

// GET - Debug view of master list data structure
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const masterList = await getMasterList()
    
    // Filter to just task items and show their full structure
    const taskItems = masterList.filter(item => item.type === "task")
    
    // Get a sample of all field names used
    const allFieldNames = new Set<string>()
    taskItems.forEach(item => {
      Object.keys(item).forEach(key => allFieldNames.add(key))
    })

    return NextResponse.json({ 
      success: true, 
      totalMasterListItems: masterList.length,
      taskItemCount: taskItems.length,
      allFieldsFound: Array.from(allFieldNames).sort(),
      // Show first 5 task items as samples
      sampleTaskItems: taskItems.slice(0, 5).map(item => ({
        ...item,
        _rawKeys: Object.keys(item)
      }))
    })
  } catch (error) {
    console.error("Error fetching master list debug:", error)
    return NextResponse.json(
      { error: "Failed to fetch master list debug data" },
      { status: 500 }
    )
  }
}
