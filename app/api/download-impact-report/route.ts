import { NextResponse } from "next/server"

// Try multiple potential PDF URLs
const PDF_URLS = [
  "https://ampd-asset.s3.us-east-2.amazonaws.com/MHMxVelocity_Year2_Impact_Report.pdf",
]
const DOWNLOAD_FILENAME = "MHMxVelocity_Year2_Impact_Report.pdf"

export async function GET() {
  // Try each URL until one works
  for (const pdfUrl of PDF_URLS) {
    try {
      const response = await fetch(pdfUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; NextJS/16.0)",
        },
      })
      
      if (response.ok) {
        const pdfBuffer = await response.arrayBuffer()
        
        return new NextResponse(pdfBuffer, {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${DOWNLOAD_FILENAME}"`,
            "Content-Length": pdfBuffer.byteLength.toString(),
          },
        })
      }
    } catch (error) {
      console.error(`Failed to fetch from ${pdfUrl}:`, error)
      continue
    }
  }

  // If all URLs fail, return an error with instructions
  return NextResponse.json(
    { 
      error: "PDF not available",
      message: "The Impact Report PDF is currently not accessible. Please contact the administrator to upload the file to S3.",
      expectedLocation: PDF_URLS[0]
    },
    { status: 404 }
  )
}
