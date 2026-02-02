import { NextResponse } from "next/server"

const PDF_URL = "https://ampd-asset.s3.us-east-2.amazonaws.com/MHMxVelocity_Impact.pdf"
const DOWNLOAD_FILENAME = "MHMxVelocity_Year2_Impact_Report.pdf"

export async function GET() {
  try {
    const response = await fetch(PDF_URL)
    
    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch PDF" },
        { status: response.status }
      )
    }

    const pdfBuffer = await response.arrayBuffer()

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${DOWNLOAD_FILENAME}"`,
        "Content-Length": pdfBuffer.byteLength.toString(),
      },
    })
  } catch (error) {
    console.error("Error downloading PDF:", error)
    return NextResponse.json(
      { error: "Failed to download PDF" },
      { status: 500 }
    )
  }
}
