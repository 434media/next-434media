# External Email Signup Integration Guide

This document explains how to integrate email signup functionality from other 434 Media owned websites to save emails to the centralized Firestore database while maintaining Mailchimp integration and tagging.

## Overview

The 434 Media platform provides a public API endpoint that allows external websites (Digital Canvas, AMPD, Salute, etc.) to submit email signups. All emails are stored in Firestore for centralized tracking and can optionally be synced with Mailchimp.

## Architecture

```
┌─────────────────────┐     ┌─────────────────────────────────────────┐
│  Digital Canvas     │     │         434 Media API                   │
│  (or other site)    │────▶│  POST /api/public/email-signup          │
│                     │     │                                         │
│  - Newsletter Form  │     │  ┌─────────────┐   ┌─────────────────┐  │
│  - Popup Modal      │     │  │  Firestore  │   │   Mailchimp     │  │
└─────────────────────┘     │  │  Database   │   │   (optional)    │  │
                            │  └─────────────┘   └─────────────────┘  │
                            └─────────────────────────────────────────┘
```

---

## MXR RSVP Migration (DigitalCanvas)

If you have existing emails in the MXR Airtable base (`app5L5dkWVWJ3Ecd1`) in the `rsvp` table, you can migrate them to Firestore:

### Environment Variable

Add the MXR Airtable base ID to your `.env`:

```env
MXR_AIRTABLE_BASE_ID=app5L5dkWVWJ3Ecd1
```

### Migration Process

1. Go to the **Admin Dashboard** → **Email Lists** (`/admin/email-lists`)
2. Click the **MXR** button (orange) to migrate emails from the MXR RSVP table
3. Only emails with "Join The Feed" = Yes will be migrated
4. All migrated emails will have source set to `DigitalCanvas`
5. Tags applied: `["web-digitalcanvas", "rsvp-join-feed"]`

### MXR RSVP Table Structure

| Column | Description |
|--------|-------------|
| `Email` | The subscriber's email address |
| `Join The Feed` | Yes/No - Only "Yes" entries are migrated |

---

## TXMX Iconic Series RSVP Migration (TXMX)

If you have existing emails in the TXMX Iconic Series Airtable base (`appuFb5OfHlJdJ29b`) in the `RSVP` table, you can migrate them to Firestore:

### Environment Variable

Add the TXMX Iconic Series Airtable base ID to your `.env`:

```env
AIRTABLE_ICONIC_SERIES_BASE_ID=appuFb5OfHlJdJ29b
```

### Migration Process

1. Go to the **Admin Dashboard** → **Email Lists** (`/admin/email-lists`)
2. Click the **TXMX** button (purple) to migrate emails from the TXMX Iconic Series RSVP table
3. Only emails with "Subscribe to 8 Count" = Yes will be migrated
4. All migrated emails will have source set to `TXMX`
5. Tags applied: `["web-txmx", "rsvp-8count-subscribe"]`

### TXMX RSVP Table Structure

| Column | Description |
|--------|-------------|
| `Email` | The subscriber's email address |
| `Subscribe to 8 Count` | Yes/No - Only "Yes" entries are migrated |

---

## API Endpoints for Migration

| Action | Endpoint | Body | Description |
|--------|----------|------|-------------|
| Standard Airtable | `POST /api/admin/email-lists-firestore` | `{ "action": "migrate" }` | Migrate from main Airtable |
| MXR RSVP | `POST /api/admin/email-lists-firestore` | `{ "action": "migrate-mxr" }` | DigitalCanvas emails |
| TXMX RSVP | `POST /api/admin/email-lists-firestore` | `{ "action": "migrate-txmx" }` | TXMX emails |
| All Sources | `POST /api/admin/email-lists-firestore` | `{ "action": "migrate-all" }` | All Airtable sources |

---

## API Endpoint

### `POST /api/public/email-signup`

**Base URL:** `https://434media.com/api/public/email-signup`

### Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Content-Type` | Yes | Must be `application/json` |
| `x-api-key` | Yes* | Your API key for authentication |

*Required if `EMAIL_SIGNUP_API_KEY` is configured on the server.

### Request Body

```json
{
  "email": "user@example.com",
  "source": "DigitalCanvas",
  "tags": ["web-digitalcanvas", "newsletter-signup"],
  "pageUrl": "https://digitalcanvas.com/contact"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | The subscriber's email address |
| `source` | string | Yes | Identifier for the source website (see valid sources below) |
| `tags` | string[] | No | Mailchimp tags for segmentation |
| `pageUrl` | string | No | The URL where the signup occurred |

### Valid Sources

The following sources are pre-configured and accepted:

- `434Media`
- `AIM`
- `SDOH`
- `TXMX`
- `VemosVamos`
- `DigitalCanvas`
- `AMPD`
- `Salute`
- `MilCity`

> **Note:** To add a new source, update the `VALID_SOURCES` array in `/app/api/public/email-signup/route.ts`

### Response

#### Success (200)

```json
{
  "success": true,
  "message": "Email signup saved successfully",
  "id": "firestore-document-id"
}
```

#### Error Responses

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `Email is required` | Missing email field |
| 400 | `Invalid email format` | Email validation failed |
| 400 | `Source is required` | Missing source field |
| 400 | `Invalid source` | Source not in valid sources list |
| 401 | `Invalid API key` | API key authentication failed |
| 500 | `Failed to save email` | Firestore save error |

---

## Implementation Guide for External Websites

### Step 1: Get Your API Key

Contact the 434 Media admin to get your `EMAIL_SIGNUP_API_KEY` or set it in your environment variables if you have access.

### Step 2: Update Your Newsletter API Route

Here's how to update the Digital Canvas newsletter API route to use the centralized 434 Media endpoint while keeping Mailchimp integration:

#### Option A: Direct Integration (Recommended)

Replace your newsletter API route with a call to the 434 Media public API, plus your own Mailchimp integration:

```typescript
// app/api/newsletter/route.ts
import { NextResponse } from "next/server"
import axios from "axios"
import crypto from "crypto"
import { checkBotId } from "botid/server"

const isDevelopment = process.env.NODE_ENV === "development"

// 434 Media API Configuration
const MEDIA_434_API_URL = "https://434media.com/api/public/email-signup"
const MEDIA_434_API_KEY = process.env.EMAIL_SIGNUP_API_KEY

// Mailchimp Configuration
const mailchimpApiKey = process.env.MAILCHIMP_API_KEY
const mailchimpListId = process.env.MAILCHIMP_AUDIENCE_ID
const mailchimpDatacenter = mailchimpApiKey ? mailchimpApiKey.split("-").pop() : null

// Website identifier - change this for each site
const SITE_SOURCE = "DigitalCanvas"
const SITE_TAGS = ["web-digitalcanvas", "newsletter-signup"]

export async function POST(request: Request) {
  try {
    // Bot protection
    if (!isDevelopment) {
      const verification = await checkBotId()
      if (verification.isBot) {
        return NextResponse.json({ error: "Bot detected. Access denied." }, { status: 403 })
      }
    }

    const { email } = await request.json()

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
    }

    const mailchimpEnabled = mailchimpApiKey && mailchimpListId
    const promises: Promise<any>[] = []
    const errors: string[] = []

    // 1. Save to 434 Media Firestore (centralized)
    const firestorePromise = axios.post(
      MEDIA_434_API_URL,
      {
        email: email.toLowerCase().trim(),
        source: SITE_SOURCE,
        tags: SITE_TAGS,
        pageUrl: request.headers.get("referer") || undefined,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": MEDIA_434_API_KEY || "",
        },
        validateStatus: (status) => status < 500,
      }
    )
    promises.push(firestorePromise)

    // 2. Add to Mailchimp (with tagging)
    if (mailchimpEnabled) {
      const mailchimpPromise = axios.post(
        `https://${mailchimpDatacenter}.api.mailchimp.com/3.0/lists/${mailchimpListId}/members`,
        {
          email_address: email,
          status: "subscribed",
          tags: SITE_TAGS,
        },
        {
          auth: {
            username: "apikey",
            password: mailchimpApiKey,
          },
          headers: {
            "Content-Type": "application/json",
          },
          validateStatus: (status) => status < 500,
        }
      )
      promises.push(mailchimpPromise)
    }

    const results = await Promise.allSettled(promises)

    // Handle Firestore result
    const firestoreResult = results[0]
    if (firestoreResult.status === "rejected") {
      console.error("434 Media API error:", firestoreResult.reason)
      errors.push("Centralized storage failed")
    } else if (firestoreResult.status === "fulfilled") {
      const response = firestoreResult.value
      if (response.status >= 400) {
        console.error("434 Media API error:", response.data)
        errors.push(response.data?.error || "Centralized storage failed")
      }
    }

    // Handle Mailchimp result
    if (mailchimpEnabled) {
      const mailchimpResult = results[1]
      if (mailchimpResult.status === "rejected") {
        console.error("Mailchimp error:", mailchimpResult.reason)
        await handleMailchimpError(mailchimpResult.reason, email, errors)
      } else if (mailchimpResult.status === "fulfilled") {
        const response = mailchimpResult.value
        if (response.status >= 400 && response.data?.title === "Member Exists") {
          // Update existing member with tags
          await updateMailchimpMemberTags(email)
        } else if (response.status >= 400) {
          console.error("Mailchimp error:", response.data)
          errors.push("Mailchimp subscription failed")
        }
      }
    }

    // Return success if at least one service succeeded
    const totalServices = mailchimpEnabled ? 2 : 1
    if (errors.length < totalServices) {
      return NextResponse.json(
        {
          message: "Newsletter subscription successful",
          warnings: errors.length > 0 ? errors : undefined,
        },
        { status: 200 }
      )
    } else {
      return NextResponse.json(
        {
          error: "All services failed",
          details: errors,
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("Error subscribing to newsletter:", error)
    return NextResponse.json(
      { error: "An error occurred while subscribing to the newsletter" },
      { status: 500 }
    )
  }
}

async function handleMailchimpError(error: any, email: string, errors: string[]) {
  if (error?.response?.data) {
    const responseData = error.response.data
    if (typeof responseData === "string" && responseData.includes("<!DOCTYPE")) {
      console.error("Mailchimp returned HTML error page - likely authentication issue")
      errors.push("Mailchimp authentication failed")
    } else if (responseData?.title === "Member Exists") {
      console.log("Email already exists in Mailchimp, updating tags")
      await updateMailchimpMemberTags(email)
    } else {
      errors.push("Mailchimp subscription failed")
    }
  } else {
    errors.push("Mailchimp subscription failed")
  }
}

async function updateMailchimpMemberTags(email: string) {
  try {
    const emailHash = crypto.createHash("md5").update(email.toLowerCase()).digest("hex")
    await axios.post(
      `https://${mailchimpDatacenter}.api.mailchimp.com/3.0/lists/${mailchimpListId}/members/${emailHash}/tags`,
      {
        tags: SITE_TAGS.map(tag => ({ name: tag, status: "active" })),
      },
      {
        auth: {
          username: "apikey",
          password: mailchimpApiKey!,
        },
        headers: {
          "Content-Type": "application/json",
        },
      }
    )
  } catch (updateError) {
    console.error("Failed to update existing Mailchimp member tags:", updateError)
  }
}
```

### Step 3: Environment Variables

Add these environment variables to your external website:

```env
# 434 Media Integration
EMAIL_SIGNUP_API_KEY=your-api-key-from-434media

# Mailchimp (optional but recommended)
MAILCHIMP_API_KEY=your-mailchimp-api-key
MAILCHIMP_AUDIENCE_ID=your-mailchimp-list-id
```

### Step 4: Frontend Newsletter Component

Your frontend component doesn't need to change! It still calls your local `/api/newsletter` endpoint, which handles the integration behind the scenes.

```tsx
// Example: Newsletter Component (no changes needed)
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  setIsSubmitting(true)

  try {
    const response = await fetch("/api/newsletter", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    })

    const data = await response.json()

    if (response.ok) {
      setEmail("")
      setIsSuccess(true)
    } else {
      throw new Error(data.error || "Subscription failed")
    }
  } catch (error) {
    setError(error instanceof Error ? error.message : "An error occurred")
  } finally {
    setIsSubmitting(false)
  }
}
```

---

## Mailchimp Tagging Strategy

Use consistent tags to segment your audience across all 434 Media properties:

### Recommended Tags

| Tag Pattern | Example | Purpose |
|-------------|---------|---------|
| `web-{sitename}` | `web-digitalcanvas` | Identifies the source website |
| `newsletter-signup` | `newsletter-signup` | Indicates newsletter subscription |
| `event-{eventname}` | `event-aims-2025` | Event-specific signups |
| `campaign-{campaign}` | `campaign-spring-2025` | Campaign tracking |

### Example Tag Configurations by Site

```typescript
// Digital Canvas
const SITE_TAGS = ["web-digitalcanvas", "newsletter-signup"]

// AMPD
const SITE_TAGS = ["web-ampd", "newsletter-signup"]

// Salute
const SITE_TAGS = ["web-salute", "newsletter-signup"]

// MilCity
const SITE_TAGS = ["web-milcity", "newsletter-signup"]
```

---

## CORS Configuration

The 434 Media API supports CORS for cross-origin requests from your external websites. The following headers are set:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, x-api-key
```

---

## Testing

### Test with cURL

```bash
# Test the public email signup endpoint
curl -X POST https://434media.com/api/public/email-signup \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "email": "test@example.com",
    "source": "DigitalCanvas",
    "tags": ["web-digitalcanvas", "newsletter-signup"],
    "pageUrl": "https://digitalcanvas.com"
  }'
```

### Expected Response

```json
{
  "success": true,
  "message": "Email signup saved successfully",
  "id": "abc123xyz"
}
```

---

## Data Storage

### Firestore Collection Structure

All email signups are stored in the `email_signups` collection:

```typescript
interface FirestoreEmailSignup {
  id: string              // Auto-generated document ID
  email: string           // Subscriber email (lowercase)
  source: string          // Source website identifier
  created_at: string      // ISO timestamp
  mailchimp_synced?: boolean
  mailchimp_tags?: string[]
  ip_address?: string     // For analytics
  user_agent?: string     // For analytics
  page_url?: string       // Page where signup occurred
}
```

### Admin Dashboard

View all collected emails in the 434 Media admin dashboard:
- **URL:** `/admin/email-lists`
- **Features:** Filter by source, export to CSV, view by date range

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | Invalid or missing API key | Verify `x-api-key` header matches `EMAIL_SIGNUP_API_KEY` |
| 400 Invalid source | Source not in allowed list | Add source to `VALID_SOURCES` array |
| CORS error | Missing preflight handling | Ensure OPTIONS request is handled |
| Duplicate emails | Email already exists | API returns success with existing ID |

### Debug Logging

Enable verbose logging in development:

```typescript
if (process.env.NODE_ENV === "development") {
  console.log("[Email Signup] Request:", { email, source, tags })
  console.log("[Email Signup] API Key:", apiKey ? "Present" : "Missing")
}
```

---

## Adding a New Source Website

1. **Update Valid Sources**
   
   Edit `/app/api/public/email-signup/route.ts`:
   ```typescript
   const VALID_SOURCES = [
     // ... existing sources
     "NewSite",  // Add your new site
   ]
   ```

2. **Implement on External Site**
   
   Follow the implementation guide above with your site's:
   - `SITE_SOURCE`: Your site identifier (e.g., `"NewSite"`)
   - `SITE_TAGS`: Your Mailchimp tags (e.g., `["web-newsite", "newsletter-signup"]`)

3. **Get API Key**
   
   Use the same `EMAIL_SIGNUP_API_KEY` shared across all 434 Media properties.

4. **Test Integration**
   
   Use the cURL command above to verify the integration works.

---

## Security Considerations

1. **API Key Protection**: Never expose the API key in client-side code
2. **Bot Protection**: Use bot detection (like BotID) on your frontend
3. **Rate Limiting**: Consider implementing rate limiting on your external site
4. **Email Validation**: Always validate emails before submission
5. **HTTPS**: Only use HTTPS for API requests

---

## Support

For questions or issues with the integration:
- Check the 434 Media admin dashboard for error logs
- Contact the 434 Media development team
- Review this documentation for updates
