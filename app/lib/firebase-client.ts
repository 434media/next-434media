import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app'
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
  type Auth
} from 'firebase/auth'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// Lazy initialization - only initialize when actually needed (client-side)
let app: FirebaseApp | null = null
let auth: Auth | null = null
let googleProvider: GoogleAuthProvider | null = null

function getFirebaseApp(): FirebaseApp {
  if (app) return app
  
  // Check if we have required config (prevents build-time errors)
  if (!firebaseConfig.apiKey) {
    throw new Error('Firebase API key is not configured. Please set NEXT_PUBLIC_FIREBASE_API_KEY environment variable.')
  }
  
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
  return app
}

function getFirebaseAuth(): Auth {
  if (auth) return auth
  auth = getAuth(getFirebaseApp())
  return auth
}

function getGoogleProvider(): GoogleAuthProvider {
  if (googleProvider) return googleProvider
  googleProvider = new GoogleAuthProvider()
  googleProvider.setCustomParameters({
    hd: process.env.NEXT_PUBLIC_WORKSPACE_DOMAIN || '434media.com',
    prompt: 'select_account',
  })
  return googleProvider
}

// Export getters for lazy access
export { getFirebaseAuth as auth, getGoogleProvider as googleProvider }

// Sign in with Google (workspace domain only)
export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(getFirebaseAuth(), getGoogleProvider())
  return result.user
}

// Sign in with email/password (for approved non-workspace admins)
export async function signInWithEmail(email: string, password: string): Promise<User> {
  const result = await signInWithEmailAndPassword(getFirebaseAuth(), email, password)
  return result.user
}

// Sign out
export async function signOut(): Promise<void> {
  await firebaseSignOut(getFirebaseAuth())
}

// Get current user
export function getCurrentUser(): User | null {
  return getFirebaseAuth().currentUser
}

// Subscribe to auth state changes
export function onAuthStateChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(getFirebaseAuth(), callback)
}

// Check if email is from workspace domain
export function isWorkspaceDomainEmail(email: string): boolean {
  const workspaceDomain = process.env.NEXT_PUBLIC_WORKSPACE_DOMAIN || '434media.com'
  return email.endsWith(`@${workspaceDomain}`)
}

// Get ID token for server-side verification
export async function getIdToken(): Promise<string | null> {
  const user = getFirebaseAuth().currentUser
  if (!user) return null
  return user.getIdToken()
}
