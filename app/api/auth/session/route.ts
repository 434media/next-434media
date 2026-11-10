import { NextResponse } from 'next/server'
import { canRunContent, getSession } from '@/lib/auth'
import { founderDecision, founderEmails } from '@/lib/founder-guard'

export async function GET() {
  const session = await getSession()
  
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
  
  return NextResponse.json({
    authenticated: true,
    // `founder` is the founder-only guard's answer (lib/founder-guard.ts), for the sidebar's Finance link only.
    user: { ...session, founder: founderDecision(session, founderEmails()).allowed },
    // Whether the content permission is held (lib/auth.ts canRunContent): the board shows Create and review actions.
    contentRunner: await canRunContent(session.email),
  })
}
