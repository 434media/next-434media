# Feed Form - Edit & Rich Text Features

## Overview
The Feed Form has been enhanced with edit/delete functionality and rich text support for better content management.

## New Features

### 1. Edit Existing Feed Items
- **Edit Button**: Each feed item in the View tab now has an "Edit" button
- **Auto-populate Form**: Clicking Edit loads all the item's data into the Create form
- **Visual Indicator**: Blue banner shows when you're editing (instead of creating)
- **Update Flow**: Submit button changes to "Update Feed Item" when editing
- **Cancel Edit**: Can cancel editing and return to creating a new item

**How to Edit:**
1. Go to "View Feeds" tab
2. Click the "Edit" button on any feed item
3. Make your changes in the form
4. Click "Update Feed Item" to save

### 2. Delete Feed Items
- **Delete Button**: Each feed item has a red "Delete" button
- **Confirmation**: Asks for confirmation before deleting
- **Permanent**: Deletion is permanent and removes from Airtable

**How to Delete:**
1. Go to "View Feeds" tab
2. Click the "Delete" button on the feed item you want to remove
3. Confirm the deletion in the popup dialog

### 3. Rich Text Editor
A custom Markdown-powered rich text editor has been added to all long-form text fields:

**Supported Fields:**
- Summary
- Founder's Note Text
- Featured Post Content
- Event Description
- Spotlight Descriptions (1, 2, 3)

**Rich Text Features:**
- **Bold**: `**bold text**` or click the Bold button
- **Italic**: `*italic text*` or click the Italic button
- **Links**: `[text](url)` or click the Link button
- **Bullet Lists**: Start with `- ` or click the Bullet List button
- **Numbered Lists**: Start with `1. ` or click the Numbered List button
- **Inline Code**: `` `code` `` or click the Code button
- **Preview Mode**: Toggle between edit and preview to see formatted output
- **Toolbar**: Quick-access buttons for all formatting options

**How It Works with Airtable:**
- Text is stored as Markdown in Airtable
- Markdown format is compatible with Airtable's rich text fields
- You can use the preview to see how it will render
- The editor preserves formatting when editing existing items

### 4. API Endpoints

#### PATCH `/api/feed-submit`
Updates an existing feed item in Airtable.

**Request Body:**
```json
{
  "id": "rec123456",
  "title": "Updated Title",
  "summary": "Updated **rich text** summary",
  // ... other fields to update
}
```

**Response:**
```json
{
  "success": true,
  "message": "Feed item successfully updated in Airtable",
  "data": { /* updated feed item */ }
}
```

#### DELETE `/api/feed-submit?id=<record_id>`
Deletes a feed item from Airtable.

**Query Parameters:**
- `id`: The Airtable record ID to delete

**Response:**
```json
{
  "success": true,
  "message": "Feed item successfully deleted from Airtable"
}
```

### 5. Airtable Library Updates

**New Functions:**
- `updateFeedItem(id: string, updates: Partial<FeedItem>)`: Updates specific fields
- `deleteFeedItem(id: string)`: Deletes a record

Both functions are already integrated in `/app/lib/airtable-feed.ts`

## Usage Examples

### Editing a Feed Item
```typescript
// When user clicks Edit, this happens:
const handleEdit = (item: FeedItem) => {
  setEditingId(item.id || null)
  setFormData({ ...item }) // Load all fields
  setActiveTab("create") // Switch to form
}

// On submit, API knows it's an edit:
const method = editingId ? "PATCH" : "POST"
const body = editingId ? { id: editingId, ...formData } : formData
```

### Using Rich Text
```typescript
// In the form:
<RichTextEditor
  value={formData.summary}
  onChange={(value) => handleInputChange("summary", value)}
  placeholder="Enter a brief summary (supports Markdown)"
  minRows={4}
/>
```

### Deleting an Item
```typescript
const handleDelete = async (id: string) => {
  if (!confirm("Are you sure?")) return
  
  const response = await fetch(`/api/feed-submit?id=${id}`, {
    method: "DELETE",
    headers: { "x-admin-key": adminKey },
  })
  
  // Reloads the feed list after successful deletion
  await loadFeedItems()
}
```

## Component Files

### Updated Files:
1. **`/app/admin/feed-form/page.tsx`**
   - Added edit/delete functionality
   - Integrated RichTextEditor component
   - Added editing state management
   - Updated submit handler for PATCH requests

2. **`/app/components/RichTextEditor.tsx`** (NEW)
   - Custom Markdown editor component
   - Toolbar with formatting buttons
   - Preview mode
   - Works seamlessly with Airtable

3. **`/app/api/feed-submit/route.ts`**
   - Added PATCH endpoint for updates
   - Added DELETE endpoint for deletions
   - All endpoints use admin authentication

4. **`/app/lib/airtable-feed.ts`**
   - `updateFeedItem()` function already existed
   - `deleteFeedItem()` function already existed
   - Both now used by new features

## Security

All edit and delete operations require admin authentication:
```typescript
const adminKey = request.headers.get("x-admin-key")
if (!adminKey || adminKey !== process.env.ADMIN_PASSWORD) {
  return 401 Unauthorized
}
```

## Markdown Rendering

The rich text editor outputs Markdown that can be:
- Stored directly in Airtable text fields
- Rendered on the frontend using `react-markdown` or similar
- Previewed in the editor before submission

## Testing Checklist

- [x] Edit button loads item data correctly
- [x] Update saves changes to Airtable
- [x] Delete removes item from Airtable
- [x] Rich text editor formats text properly
- [x] Preview shows correct formatting
- [x] Cancel edit returns to blank form
- [x] All text fields support rich text
- [x] Markdown is preserved when editing existing items
- [x] API authentication works for PATCH/DELETE
- [x] Error handling for failed updates/deletes

## Next Steps

To use these features:
1. Navigate to `/admin/feed-form`
2. View existing feeds in the "View Feeds" tab
3. Click "Edit" to modify any feed item
4. Use the rich text editor toolbar for formatting
5. Toggle "Preview" to see rendered output
6. Click "Update Feed Item" to save
7. Or click "Delete" to remove permanently

The rich text content will be stored as Markdown in Airtable and can be rendered on your frontend using any Markdown parser.
