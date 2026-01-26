import { NextResponse, NextRequest } from 'next/server'
import { clearSession } from '@/app/lib/auth'

export async function POST() {
  await clearSession()
  return NextResponse.json({ success: true })
}

export async function GET(request: NextRequest) {
  await clearSession()
  return NextResponse.redirect(new URL('/admin', request.nextUrl.origin))
}
