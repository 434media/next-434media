import { NextResponse } from 'next/server'
import { canRunContent, getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
  
  return NextResponse.json({
    authenticated: true,
    user: session,
    // Whether the content permission is held (lib/auth.ts canRunContent): the board shows Create and review actions.
    contentRunner: await canRunContent(session.email),
  })
}
