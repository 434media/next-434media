import { NextRequest, NextResponse } from "next/server"
import { listLeads, createLead, exportLeadsCsv, initLeadTable } from "@/app/lib/lead-db"

export async function GET(req: NextRequest) {
  await initLeadTable().catch(()=>{})
  const { searchParams } = new URL(req.url)
  const search = searchParams.get("search") || undefined
  const status = searchParams.get("status") || undefined
  const exportFlag = searchParams.get("export")
  if (exportFlag === "csv") {
    const csv = await exportLeadsCsv()
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv;charset=utf-8",
        "Content-Disposition": `attachment; filename=leads-${Date.now()}.csv`,
      },
    })
  }
  const leads = await listLeads({ search, status: status as any })
  return NextResponse.json({ leads })
}

export async function POST(req: NextRequest) {
  await initLeadTable().catch(()=>{})
  const body = await req.json()
  if (!body.company_name) {
    return NextResponse.json({ error: "company_name required" }, { status: 400 })
  }
  const lead = await createLead({ ...body, status: body.status || "new" })
  return NextResponse.json({ lead })
}
