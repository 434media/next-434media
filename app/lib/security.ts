import { headers } from "next/headers"
import crypto from "crypto"

/**
 * Security utilities optimized for admin-only dashboard
 *
 * Even though this dashboard is only accessed by one team member,
 * we maintain security best practices to protect against potential attacks.
 */

// Get client IP address
export async function getClientIP(): Promise<string> {
  const headersList = await headers()

  // Check various headers for the real IP
  const forwarded = headersList.get("x-forwarded-for")
  const realIP = headersList.get("x-real-ip")
  const cfConnectingIP = headersList.get("cf-connecting-ip")

  if (forwarded) {
    return forwarded.split(",")[0].trim()
  }

  if (realIP) {
    return realIP
  }

  if (cfConnectingIP) {
    return cfConnectingIP
  }

  return "unknown"
}

// Validate admin password from environment variable
export function validateAdminPassword(password: string): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD

  if (!adminPassword || !password) {
    return false
  }

  // Use constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(Buffer.from(password), Buffer.from(adminPassword))
  } catch (error) {
    console.error("Error validating admin password:", error)
    return false
  }
}

// Generate a session token for the admin
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex")
}

// Hash a value with SHA-256
export function hashValue(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex")
}

// Log security events (can be extended to write to database)
export function logSecurityEvent(event: string, ip: string, success: boolean): void {
  console.log(`[SECURITY] ${new Date().toISOString()} - ${event} - IP: ${ip} - Success: ${success}`)

  // In production, consider logging to a database or security monitoring service
}
