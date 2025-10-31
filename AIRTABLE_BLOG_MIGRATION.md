# Blog Migration to Airtable

This document outlines the migration of the blog system from PostgreSQL to Airtable, following the same patterns used for events and newsletter integration.

## Airtable Base Setup

### 1. Create Airtable Base

Create a new Airtable base with the name "434 Media Blog" or use an existing base.

### 2. Create Tables

#### Blog Posts Table
Table Name: `Blog Posts`

**Fields:**
- `Title` (Single line text) - Required
- `Slug` (Single line text) - URL-friendly version of title
- `Content` (Long text) - HTML content of the blog post
- `Excerpt` (Long text) - Short description/summary
- `Featured Image` (Attachment) - Main image for the post
- `Featured Image URL` (Single line text) - Fallback URL for featured image
- `Meta Description` (Single line text) - SEO meta description
- `Category` (Single select) - **REQUIRED**: Options: Technology, Marketing, Events, Business, Local, Medical, Science, Robotics, Military, TXMX Boxing, Community
- `Tags` (Single line text) - Comma-separated tags
- `Status` (Single select) - Options: Draft, Published
- `Author` (Single line text) - Default: "434 Media"
- `Published At` (Date & time) - When the post was published
- `Updated At` (Date & time) - Last modification time
- `Read Time` (Number) - Estimated reading time in minutes

#### Categories Setup (Single Select Field)

**IMPORTANT**: Categories are managed as a Single Select field in the Blog Posts table, not as a separate table. This approach is simpler, faster, and requires no API calls for category resolution.

**Category Options to Configure:**
Add these options to the Category single select field:

1. **Technology** - Latest tech trends and innovations
2. **Marketing** - Digital marketing strategies and tips
3. **Events** - Event planning and networking insights
4. **Business** - Business growth and entrepreneurship
5. **Local** - Local community news and partnerships
6. **Medical** - Medical innovations and healthcare technology
7. **Science** - Scientific breakthroughs and research
8. **Robotics** - Robotics and automation advances
9. **Military** - Military technology and defense innovations
10. **TXMX Boxing** - TXMX Boxing news and sports coverage
11. **Community** - Community events and local business news

**Setup Instructions:**
1. In Airtable, click on the Category field in Blog Posts table
2. Select "Single select" field type
3. Add each category option listed above
4. Set a default value (recommended: "Technology")

## Environment Variables

Add the following environment variables to your `.env.local` file:

```bash
# Airtable Blog Configuration
AIRTABLE_BLOG_BASE_ID=your_blog_base_id_here
AIRTABLE_BLOG_API_KEY=your_airtable_api_key_here
```

### Getting Airtable Credentials

1. **Base ID**: 
   - Go to your Airtable base
   - Click "Help" > "API documentation"
   - The Base ID is shown at the top (starts with "app")

2. **API Key**:
   - Go to your Airtable account settings
   - Navigate to "Developer" section
   - Generate a new Personal Access Token with the following scopes:
     - `data.records:read`
     - `data.records:write`
     - `schema.bases:read`

## Migration Process

### What Changed

1. **Data Storage**: Blog posts and categories now stored in Airtable instead of PostgreSQL
2. **Actions**: All blog actions (`app/actions/blog.ts`) updated to use Airtable API
3. **Pages**: Blog pages updated to use new Airtable functions
4. **Images**: Blog images still stored in PostgreSQL (not migrated to maintain existing functionality)

### What Stayed the Same

1. **API Structure**: Public API structure remains unchanged
2. **Components**: Blog components work exactly the same

### Files Modified

1. `app/lib/airtable-blog.ts` - New Airtable integration library
2. `app/actions/blog.ts` - Updated to use Airtable functions
3. `app/blog/page.tsx` - Updated to fetch from Airtable
4. `app/blog/[slug]/page.tsx` - Updated to fetch from Airtable

### Files Not Modified

- Blog components (BlogCard, BlogEditor, etc.) - work with existing data structure

### Files That Can Be Removed

With Airtable serving as both data source and CMS, these components are no longer needed:

- `app/admin/blog/` - Admin blog management pages
- `app/components/blog/BlogEditor.tsx` - Blog post editor component  
- `app/api/blog/upload-image/` - Image upload APIs (use Airtable attachments)
- `app/api/blog/images/` - Image management APIs
- `app/api/blog/delete-images/` - Image deletion APIs
- View count functionality - Simplified content management focus

### Recommended Architecture Simplification

1. **Content Management**: Use Airtable interface directly for:
   - Creating/editing blog posts
   - Managing categories
   - Uploading images via attachment fields
   - Setting publish status and scheduling

2. **Application Focus**: Keep only:
   - Public blog display pages (`/blog`, `/blog/[slug]`)
   - Blog components for rendering (BlogCard, etc.)
   - Airtable integration library

3. **Content Creation Workflow**:
   - Authors create/edit posts directly in Airtable interface
   - Use Airtable's rich text editor and attachment fields
   - Publish by changing status from "Draft" to "Published"
   - No need for custom admin interface

## Data Migration

To migrate existing blog data from PostgreSQL to Airtable:

1. **Export from PostgreSQL**: 
   ```sql
   COPY (SELECT * FROM blog_posts WHERE status = 'published') TO '/path/to/blog_posts.csv' WITH CSV HEADER;
   COPY (SELECT * FROM blog_categories) TO '/path/to/categories.csv' WITH CSV HEADER;
   ```

2. **Import to Airtable**:
   - Import categories first using the CSV import feature
   - Import blog posts, mapping fields appropriately
   - Ensure date formats are correct
   - Convert tags from array format to comma-separated strings

3. **Test the Migration**:
   - Verify all posts display correctly
   - Check that categories work properly
   - Test admin functionality (create, edit, delete)
   - Verify search and filtering

## Advantages of Airtable Migration

1. **Simplified Architecture**: Removes need for custom admin interface and image management
2. **Native CMS**: Airtable serves as both data source and content management system
3. **Collaboration**: Non-technical team members can edit content directly in Airtable
4. **Consistency**: Matches existing events and newsletter integrations
5. **Backup**: Airtable provides automatic backups and version history
6. **API Reliability**: Airtable's robust API with built-in rate limiting
7. **Attachments**: Native handling of images and media files
8. **Workflow**: Can create approval workflows and collaborate on drafts
9. **Reduced Complexity**: Eliminates PostgreSQL dependencies for blog content
10. **Performance**: Single Select categories eliminate API calls for category resolution (4.5s vs 12+s page load)
11. **Simplified Filtering**: Direct category name matching without ID resolution improves reliability

## Rollback Plan

If needed, you can rollback by:

1. Reverting the modified files to use PostgreSQL functions
2. Ensuring PostgreSQL database still has the original data
3. Updating environment variables to remove Airtable credentials

The PostgreSQL database structure remains intact, so rollback is straightforward if needed.