import { NextResponse, type NextRequest } from "next/server"
import { clearTravelSession } from "@/lib/travel/auth"

export async function POST(request: NextRequest) {
  await clearTravelSession()
  return NextResponse.redirect(new URL("/travel/sign-in", request.nextUrl.origin), 303)
}
