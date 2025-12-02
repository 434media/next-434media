# The Feed - Admin Form & Airtable Integration

## Overview
A web-based admin form that allows your team to easily submit feed items which are then sent to Airtable. The Airtable base then forwards this data to specific sites linked via the Airtable API.

## Files Created

### 1. Admin Form Page
**Location:** `/app/admin/feed-form/page.tsx`

A comprehensive form interface for submitting feed items with:
- Basic information (title, type, summary, status)
- Metadata (authors, topics, images)
- Newsletter-specific fields (hero images, founder's note, featured posts, events)
- Three spotlight sections for featured content
- Real-time slug generation from title
- Form validation
- Success/error notifications

### 2. Airtable Integration Library
**Location:** `/app/lib/airtable-feed.ts`

Core utilities for Airtable operations:
- `createFeedItem()` - Create new feed items
- `getFeedItems()` - Retrieve feed items with optional filtering
- `getFeedItemBySlug()` - Get specific item by slug
- `updateFeedItem()` - Update existing items
- `deleteFeedItem()` - Delete items
- `testFeedAirtableConnection()` - Test connection

### 3. API Route
**Location:** `/app/api/feed-submit/route.ts`

Server-side endpoint handling:
- POST: Submit new feed items to Airtable
- GET: Retrieve feed items (with filtering by status/type)
- Admin authentication via `x-admin-key` header
- Request validation
- Error handling with detailed messages

### 4. Admin Dashboard Update
**Location:** `/app/admin/page.tsx`

Added "The Feed Form" section to the admin dashboard with:
- Quick access tile linking to `/admin/feed-form`
- Custom FileText icon
- Responsive design matching existing admin sections

## Environment Variables

Add these to your `.env.local` file:

```env
# The Feed Airtable Configuration
THEFEEDS_BASE_ID=your_thefeeds_base_id_here
THEFEEDS_TABLE_NAME=thefeed

# Shared Airtable API Key (reuses existing key)
AIRTABLE_API_KEY=your_airtable_api_key_here

# Admin authentication
ADMIN_PASSWORD=your_admin_password_here
```

## Airtable Schema

Your `thefeed` table should have these fields (all lowercase with underscores):

### Core Fields
| Field Name | Type | Description |
|------------|------|-------------|
| `published_date` | Date | Publication date |
| `title` | Single line text | Feed item title |
| `type` | Single select | Options: video, article, podcast, newsletter |
| `summary` | Long text | Brief summary |
| `authors` | Multiple select | List of authors |
| `topics` | Multiple select | Content topics/tags |
| `slug` | Single line text | URL-friendly identifier |
| `og_image` | URL or Attachment | Social media image |
| `status` | Single select | Options: draft, published, archived |

### Newsletter-Specific Fields
| Field Name | Type | Description |
|------------|------|-------------|
| `hero_image_desktop` | URL or Attachment | Desktop hero image |
| `hero_image_mobile` | URL or Attachment | Mobile hero image |
| `founders_note_text` | Rich text | Founder's message |
| `founders_note_image` | URL or Attachment | Founder's image |
| `last_month_gif` | URL or Attachment | Last month section GIF |
| `the_drop_gif` | URL or Attachment | The Drop section GIF |
| `featured_post_title` | Single line text | Featured post title |
| `featured_post_image` | URL or Attachment | Featured post image |
| `featured_post_content` | Rich text | Featured post content |
| `upcoming_event_title` | Single line text | Event title |
| `upcoming_event_description` | Long text | Event description |
| `upcoming_event_image` | URL or Attachment | Event image |
| `upcoming_event_cta_text` | Single line text | Call-to-action text |
| `upcoming_event_cta_link` | URL | Call-to-action link |

### Spotlight Fields (1-3)
For each spotlight (replace `N` with 1, 2, or 3):
| Field Name | Type | Description |
|------------|------|-------------|
| `spotlight_N_title` | Single line text | Spotlight title |
| `spotlight_N_description` | Rich text | Spotlight description |
| `spotlight_N_image` | URL or Attachment | Spotlight image |
| `spotlight_N_cta_text` | Single line text | CTA button text |
| `spotlight_N_cta_link` | URL | CTA link |

## Usage

### Accessing the Form
1. Navigate to `/admin` (requires admin password)
2. Click on "THE FEED FORM" tile
3. Fill out the form with feed item details
4. Click "Submit to Airtable"

### Form Features

#### Auto-Generated Slug
The slug is automatically generated from the title:
- Converts to lowercase
- Replaces spaces with hyphens
- Removes special characters
- Example: "New Product Launch 2024!" → "new-product-launch-2024"

#### Array Inputs
Authors and topics accept comma-separated values:
- Input: `John Doe, Jane Smith`
- Stored as: `["John Doe", "Jane Smith"]`

#### Conditional Fields
Newsletter-specific fields only appear when `type = "newsletter"` is selected, keeping the form clean for other content types.

### API Usage

#### Submit Feed Item (POST)
```typescript
const response = await fetch("/api/feed-submit", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-admin-key": "your_admin_password",
  },
  body: JSON.stringify({
    title: "My Feed Item",
    type: "newsletter",
    summary: "This is a summary",
    authors: ["Author Name"],
    topics: ["Technology"],
    slug: "my-feed-item",
    published_date: "2024-12-02",
    status: "draft"
    // ... additional fields
  })
})
```

#### Retrieve Feed Items (GET)
```typescript
// Get all items
const response = await fetch("/api/feed-submit", {
  headers: {
    "x-admin-key": "your_admin_password",
  }
})

// Filter by status
const response = await fetch("/api/feed-submit?status=published", {
  headers: {
    "x-admin-key": "your_admin_password",
  }
})

// Filter by type
const response = await fetch("/api/feed-submit?type=newsletter", {
  headers: {
    "x-admin-key": "your_admin_password",
  }
})
```

## Data Flow

1. **Form Submission** → User fills out the form at `/admin/feed-form`
2. **Client Validation** → Required fields checked (title, summary)
3. **API Request** → POST to `/api/feed-submit` with admin authentication
4. **Server Validation** → Verify admin key and required fields
5. **Airtable Creation** → Data sent to Airtable via `createFeedItem()`
6. **Airtable Processing** → Airtable base receives data and can trigger automations
7. **Site Distribution** → Airtable forwards to linked sites via API/webhooks
8. **Success Response** → User receives confirmation notification

## Airtable Automations (Next Steps)

To complete the workflow, set up Airtable automations:

1. **Trigger**: When a record is created in `thefeed` table
2. **Condition**: Check `status` field (e.g., only process "published" items)
3. **Action**: Use webhooks or API calls to send data to specific sites

Example automation actions:
- Send POST request to Site A's API endpoint
- Send POST request to Site B's API endpoint
- Update external databases
- Trigger Slack/email notifications

## Security

- Admin authentication required via `ADMIN_PASSWORD` environment variable
- Password stored in session/local storage after initial login
- All API requests validated with `x-admin-key` header
- Unauthorized requests return 401 status

## Error Handling

The system includes comprehensive error handling:

### Form-Level Errors
- Missing required fields (title, summary)
- Invalid data types
- Network errors
- Display via toast notifications

### API-Level Errors
- Authentication failures
- Airtable connection issues
- Missing environment variables
- Detailed error messages in response

### Airtable-Level Errors
- Base/table not found
- Invalid field names
- Permission issues
- Connection timeouts

## Testing

### Test Airtable Connection
```typescript
import { testFeedAirtableConnection } from "./app/lib/airtable-feed"

const isConnected = await testFeedAirtableConnection()
console.log("Connection status:", isConnected)
```

### Test Form Submission
1. Navigate to `/admin/feed-form`
2. Fill in minimum required fields (title, summary)
3. Submit the form
4. Check Airtable base for new record
5. Verify all fields mapped correctly

## Troubleshooting

### "Airtable not configured" Error
- Verify `THEFEEDS_BASE_ID` is set in `.env.local`
- Verify `AIRTABLE_API_KEY` is set
- Ensure environment variables are loaded (restart dev server)

### "Unauthorized" Error
- Check `ADMIN_PASSWORD` matches in `.env.local`
- Verify admin authentication in session/local storage
- Re-login to admin dashboard

### "Failed to create feed item" Error
- Check Airtable base ID is correct
- Verify API key has write permissions
- Ensure table name matches exactly (`thefeed`)
- Check all field names match schema (lowercase with underscores)

### Images Not Showing in Airtable
- If using URL fields, ensure URLs are valid and accessible
- If using Attachment fields, you may need to manually upload images
- The library supports both URL strings and Airtable attachment objects

## Future Enhancements

Potential improvements:
- Image upload directly to cloud storage (S3, Cloudinary)
- Rich text editor for content fields
- Preview mode before submission
- Draft saving functionality
- Bulk import from CSV
- Edit/update existing feed items
- Duplicate item functionality
- Version history tracking

## Support

For issues or questions:
1. Check environment variables are correctly set
2. Review Airtable schema matches documentation
3. Check browser console for detailed error messages
4. Verify admin authentication is active
5. Test Airtable connection using utility function

---

**Created:** December 2, 2024
**Version:** 1.0.0
