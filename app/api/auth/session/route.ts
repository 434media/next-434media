import { NextResponse } from 'next/server'
import { getSession } from '@/app/lib/auth'

export async function GET() {
  const session = await getSession()
  
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
  
  return NextResponse.json({
    authenticated: true,
    user: session,
  })
}
