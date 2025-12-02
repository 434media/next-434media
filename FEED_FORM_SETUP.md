# The Feed Form - Quick Setup Guide

## Step 1: Environment Variables

Add these to your `.env.local` file:

```bash
# The Feed - Airtable Configuration
THEFEEDS_BASE_ID=appXXXXXXXXXXXXXX
THEFEEDS_TABLE_NAME=thefeed
AIRTABLE_API_KEY=keyXXXXXXXXXXXXXXXX
ADMIN_PASSWORD=your_secure_password
```

To get your Airtable credentials:
1. Go to https://airtable.com/create/base
2. Create a new base called "thefeeds"
3. Create a table called "thefeed"
4. Copy the base ID from the URL (starts with `app`)
5. Generate an API key at https://airtable.com/create/tokens

## Step 2: Create Airtable Table

Create a table named `thefeed` with these fields (copy/paste into Airtable):

### Required Fields (Minimum to Start)
1. `title` - Single line text
2. `type` - Single select (options: video, article, podcast, newsletter)
3. `summary` - Long text
4. `slug` - Single line text
5. `published_date` - Date
6. `status` - Single select (options: draft, published, archived)
7. `authors` - Multiple select
8. `topics` - Multiple select
9. `og_image` - URL

### Newsletter Fields (Optional - Add as Needed)
10. `hero_image_desktop` - URL
11. `hero_image_mobile` - URL
12. `founders_note_text` - Long text
13. `founders_note_image` - URL
14. `last_month_gif` - URL
15. `the_drop_gif` - URL
16. `featured_post_title` - Single line text
17. `featured_post_image` - URL
18. `featured_post_content` - Long text
19. `upcoming_event_title` - Single line text
20. `upcoming_event_description` - Long text
21. `upcoming_event_image` - URL
22. `upcoming_event_cta_text` - Single line text
23. `upcoming_event_cta_link` - URL

### Spotlight Fields (Optional - Add as Needed)
For each spotlight (1, 2, 3), add:
- `spotlight_N_title` - Single line text
- `spotlight_N_description` - Long text
- `spotlight_N_image` - URL
- `spotlight_N_cta_text` - Single line text
- `spotlight_N_cta_link` - URL

**Note:** Replace `N` with 1, 2, or 3

## Step 3: Install Dependencies

The required packages should already be installed. If not:

```bash
npm install airtable
```

## Step 4: Restart Development Server

After adding environment variables:

```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

## Step 5: Access the Form

1. Navigate to: `http://localhost:3000/admin`
2. Enter your admin password (set in `ADMIN_PASSWORD`)
3. Click on "THE FEED FORM" tile
4. Fill out the form and submit

## Step 6: Verify Submission

1. Go to your Airtable base
2. Check the `thefeed` table
3. Verify the new record appears with all fields populated

## Step 7: Set Up Airtable Automations (Optional)

To forward data to other sites:

1. In Airtable, go to Automations
2. Click "+ Create automation"
3. **Trigger**: "When record matches conditions"
   - Table: `thefeed`
   - Conditions: `status = published`
4. **Action**: "Send a request to a URL"
   - Method: POST
   - URL: Your site's API endpoint
   - Body: Map fields from the record

Repeat for each site you want to sync to.

## Troubleshooting

### Form won't submit
- Check browser console for errors
- Verify `ADMIN_PASSWORD` is set
- Ensure you're logged into admin dashboard

### "Airtable not configured" error
- Verify `THEFEEDS_BASE_ID` is correct (starts with `app`)
- Verify `AIRTABLE_API_KEY` is correct (starts with `key`)
- Restart dev server after adding env variables

### Data not appearing in Airtable
- Check field names match exactly (lowercase, underscores)
- Verify API key has write permissions
- Check Airtable base ID is correct
- Look at browser network tab for API errors

### Images not showing
- Verify image URLs are publicly accessible
- Check for CORS issues
- Ensure URLs use `https://` not `http://`

## Testing

### Test the Connection
Create a test file `test-feed-connection.ts`:

```typescript
import { testFeedAirtableConnection } from "./app/lib/airtable-feed"

testFeedAirtableConnection()
  .then((success) => {
    console.log("Connection test:", success ? "✅ Success" : "❌ Failed")
  })
  .catch((error) => {
    console.error("Test error:", error)
  })
```

Run: `npx tsx test-feed-connection.ts`

### Test Form Submission
1. Go to `/admin/feed-form`
2. Fill in:
   - Title: "Test Item"
   - Summary: "This is a test"
3. Click "Submit to Airtable"
4. Check Airtable for new record

## Next Steps

1. ✅ Set up environment variables
2. ✅ Create Airtable table with required fields
3. ✅ Test the form submission
4. ✅ Verify data in Airtable
5. 🔄 Set up Airtable automations to forward to other sites
6. 🔄 Train team on using the form
7. 🔄 Add additional fields as needed

## Support Resources

- Full documentation: `FEED_FORM_DOCUMENTATION.md`
- Airtable API docs: https://airtable.com/developers/web/api/introduction
- Airtable automations: https://support.airtable.com/docs/getting-started-with-airtable-automations

---

**Quick Reference**

- Admin dashboard: `/admin`
- Feed form: `/admin/feed-form`
- API endpoint: `/api/feed-submit`
- Airtable library: `/app/lib/airtable-feed.ts`
