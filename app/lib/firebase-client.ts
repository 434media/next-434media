import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app'
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  browserLocalPersistence,
  indexedDBLocalPersistence,
  setPersistence,
  type User,
  type Auth,
  type UserCredential
} from 'firebase/auth'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  // Use custom domain for auth to avoid third-party cookie issues on mobile
  // Falls back to Firebase's default auth domain
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
let persistenceSet = false

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

// Set persistence to indexedDB first (more reliable on mobile), fall back to local storage
async function ensurePersistence(): Promise<void> {
  if (persistenceSet) return
  try {
    // Try indexedDB first - more reliable on mobile browsers
    await setPersistence(getFirebaseAuth(), indexedDBLocalPersistence)
    persistenceSet = true
  } catch (error) {
    console.warn('IndexedDB persistence failed, trying local storage:', error)
    try {
      await setPersistence(getFirebaseAuth(), browserLocalPersistence)
      persistenceSet = true
    } catch (fallbackError) {
      console.warn('Failed to set any persistence:', fallbackError)
    }
  }
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

// Detect if running on mobile device
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )
}

// Detect if browser blocks popups (Safari on iOS often does in certain contexts)
function isPopupBlocked(): boolean {
  if (typeof window === 'undefined') return false
  // Check if we're in a standalone PWA mode or iframe
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  const isInIframe = window !== window.parent
  return isStandalone || isInIframe
}

// Export getters for lazy access
export { getFirebaseAuth as auth, getGoogleProvider as googleProvider }

// Sign in with Google (workspace domain only)
// Use popup flow for both mobile and desktop - redirect flow has issues with
// third-party cookie blocking on mobile browsers (especially Safari/iOS)
export async function signInWithGoogle(): Promise<User> {
  await ensurePersistence()
  
  // Try popup first - works better on both desktop and most mobile browsers
  try {
    const result = await signInWithPopup(getFirebaseAuth(), getGoogleProvider())
    return result.user
  } catch (popupError: any) {
    // If popup was blocked (e.g., in standalone PWA mode), fall back to redirect
    if (popupError.code === 'auth/popup-blocked' || 
        popupError.code === 'auth/popup-closed-by-user' ||
        popupError.code === 'auth/cancelled-popup-request') {
      
      // Only use redirect as a last resort
      if (popupError.code === 'auth/popup-blocked') {
        console.log('Popup blocked, falling back to redirect flow')
        await signInWithRedirect(getFirebaseAuth(), getGoogleProvider())
        throw new Error('Redirecting...')
      }
    }
    throw popupError
  }
}

// Check for redirect result (call this on page load for mobile auth)
export async function checkRedirectResult(): Promise<UserCredential | null> {
  try {
    await ensurePersistence()
    const result = await getRedirectResult(getFirebaseAuth())
    return result
  } catch (error: any) {
    // Handle specific redirect errors
    if (error.code === 'auth/popup-closed-by-user') {
      return null
    }
    console.error('Redirect result error:', error)
    throw error
  }
}

// Sign in with email/password (for approved non-workspace admins)
export async function signInWithEmail(email: string, password: string): Promise<User> {
  await ensurePersistence()
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
// Can pass a specific user (e.g., from redirect result) or use currentUser
export async function getIdToken(user?: User | null): Promise<string | null> {
  const targetUser = user || getFirebaseAuth().currentUser
  if (!targetUser) return null
  return targetUser.getIdToken()
}
