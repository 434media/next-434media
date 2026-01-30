import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyFirebaseToken, getDb } from '@/app/lib/firebase-admin'
import { setSession, getRoleForProvider } from '@/app/lib/auth'

const TEAM_MEMBERS_COLLECTION = "crm_team_members"

// Ensure user exists in team members collection (auto-register on first login)
async function ensureTeamMember(email: string, name: string) {
  try {
    const db = getDb()
    const normalizedEmail = email.toLowerCase()
    
    // Check if team member already exists by email
    const existing = await db
      .collection(TEAM_MEMBERS_COLLECTION)
      .where("email", "==", normalizedEmail)
      .limit(1)
      .get()
    
    if (!existing.empty) {
      // User exists, return their stored name (might be customized)
      const memberData = existing.docs[0].data()
      return memberData.name || name
    }
    
    // User doesn't exist, create new team member
    const now = new Date().toISOString()
    await db.collection(TEAM_MEMBERS_COLLECTION).add({
      name: name,
      email: normalizedEmail,
      isActive: true,
      created_at: now,
      updated_at: now,
    })
    
    console.log(`[Team Members] Auto-registered new member: ${email} as "${name}"`)
    return name
  } catch (error) {
    console.error("[Team Members] Error ensuring team member:", error)
    return name // Fallback to provided name on error
  }
}

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json()

    if (!idToken) {
      return NextResponse.json(
        { error: 'ID token is required' },
        { status: 400 }
      )
    }

    // Verify the Firebase ID token
    // If the token is valid, the user is in Firebase Auth and is authorized
    // Firebase Console is the source of truth for who can access admin
    const decodedToken = await verifyFirebaseToken(idToken)
    
    const email = decodedToken.email
    const tokenName = decodedToken.name || decodedToken.email?.split('@')[0] || 'User'
    const picture = decodedToken.picture

    if (!email) {
      return NextResponse.json(
        { error: 'Email not found in token' },
        { status: 400 }
      )
    }

    // Auto-register user to team members and get their display name
    // This allows Firebase users to be tagged in comments and assigned to tasks
    const displayName = await ensureTeamMember(email, tokenName)

    // Create session with CRM-only role for Firebase email/password users
    await setSession({
      email,
      name: displayName,
      picture,
      authProvider: 'firebase',
      role: getRoleForProvider('firebase'),
    })

    return NextResponse.json({
      success: true,
      user: { 
        email, 
        name: displayName, 
        picture,
        authProvider: 'firebase',
        role: getRoleForProvider('firebase'),
      },
    })
  } catch (error) {
    console.error('Firebase auth error:', error)
    
    // Handle specific Firebase errors
    if (error instanceof Error) {
      if (error.message.includes('Firebase ID token has expired')) {
        return NextResponse.json(
          { error: 'token_expired', message: 'Session expired. Please sign in again.' },
          { status: 401 }
        )
      }
      if (error.message.includes('Firebase Admin credentials')) {
        return NextResponse.json(
          { error: 'config_error', message: 'Firebase is not properly configured' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json(
      { error: 'authentication_failed', message: 'Authentication failed. Please try again.' },
      { status: 401 }
    )
  }
}
