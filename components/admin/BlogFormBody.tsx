"use client"

import React from "react"
import { RichTextEditor } from "@/components/RichTextEditor"
import { ImageUpload } from "@/components/ImageUpload"
import { TaxonomyChipInput } from "@/components/feed/TaxonomyChipInput"

const CATEGORIES = [
  "Technology",
  "Design",
  "Marketing",
  "Business",
  "Culture",
  "Events",
  "News",
  "Tutorial",
  "Case Study",
  "Other",
]

interface MinimalPost {
  id: string
  title: string
  slug: string
}

export interface BlogFormDataShape {
  title: string
  slug: string
  content: string
  excerpt: string
  featured_image: string
  meta_description: string
  category: string
  tags: string[]
  status: "draft" | "published"
  author: string
}

interface BlogFormBodyProps {
  formData: BlogFormDataShape
  setFormData: React.Dispatch<React.SetStateAction<BlogFormDataShape>>

  // Computed dependencies
  slugCollision: MinimalPost | null
  tagSuggestions: string[]
  authorSuggestions: string[]

  // Layout variant — drawer stacks the sidebar below the main column since
  // drawer width is too narrow for side-by-side comfortably
  variant?: "page" | "drawer"
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
}

export function BlogFormBody({
  formData,
  setFormData,
  slugCollision,
  tagSuggestions,
  authorSuggestions,
  variant = "page",
}: BlogFormBodyProps) {
  const inDrawer = variant === "drawer"
  const gridCols = inDrawer ? "grid grid-cols-1 gap-5" : "grid grid-cols-1 lg:grid-cols-3 gap-5"
  const mainSpan = inDrawer ? "" : "lg:col-span-2"

  return (
    <div className={gridCols}>
      {/* Main column */}
      <div className={`${mainSpan} space-y-5`}>
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => {
              const next = e.target.value
              setFormData((prev) => ({
                ...prev,
                title: next,
                slug: prev.slug ? prev.slug : generateSlug(next),
              }))
            }}
            placeholder="Enter post title"
            className="w-full h-10 px-3 ring-1 ring-neutral-200 rounded-md bg-white text-base text-neutral-900 placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-900 focus:outline-none"
          />
        </div>

        {/* Slug */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Slug
            <span className="ml-1.5 text-[11px] font-normal text-neutral-400">· auto-generated from title</span>
          </label>
          <input
            type="text"
            value={formData.slug}
            onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
            placeholder="auto-generated-from-title"
            className={`w-full h-10 px-3 ring-1 rounded-md focus:ring-2 focus:outline-none font-mono text-sm bg-white ${
              slugCollision
                ? "ring-amber-300 focus:ring-amber-500"
                : "ring-neutral-200 focus:ring-neutral-900"
            }`}
          />
          {formData.slug.trim() && (
            <p
              className={`mt-1.5 text-[11px] flex items-center gap-1.5 ${
                slugCollision ? "text-amber-700" : "text-emerald-700"
              }`}
            >
              <span
                className={`inline-block h-1 w-1 rounded-full ${
                  slugCollision ? "bg-amber-500" : "bg-emerald-500"
                }`}
                aria-hidden="true"
              />
              {slugCollision ? (
                <>
                  Used by{" "}
                  <span className="font-medium text-neutral-700">"{slugCollision.title}"</span>{" "}
                  — pick a different slug
                </>
              ) : (
                <>
                  <span className="font-medium">Available</span>
                  <span className="text-neutral-400">· /blog/{formData.slug}</span>
                </>
              )}
            </p>
          )}
        </div>

        {/* Content */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Content <span className="text-red-500">*</span>
          </label>
          <RichTextEditor
            value={formData.content}
            onChange={(value) => setFormData((prev) => ({ ...prev, content: value }))}
            placeholder="Write your blog post content here..."
            minRows={inDrawer ? 8 : 12}
          />
        </div>

        {/* Excerpt */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Excerpt
            <span className="ml-1.5 text-[11px] font-normal text-neutral-400">· brief summary used in previews</span>
          </label>
          <textarea
            value={formData.excerpt}
            onChange={(e) => setFormData((prev) => ({ ...prev, excerpt: e.target.value }))}
            placeholder="A brief summary of the post"
            rows={3}
            maxLength={300}
            className="w-full px-3 py-2 ring-1 ring-neutral-200 rounded-md bg-white text-sm text-neutral-900 placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-900 focus:outline-none resize-y"
          />
          <p className="text-[11px] text-neutral-400 mt-1 text-right tabular-nums">
            {formData.excerpt.length}/300 · target ~150
          </p>
        </div>
      </div>

      {/* Sidebar — stacks below main column in drawer-mode */}
      <div className="space-y-4">
        {/* Status */}
        <div className="bg-white rounded-md ring-1 ring-neutral-200/70 p-4">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-2">
            <span
              className={`inline-block h-1 w-1 rounded-full ${
                formData.status === "published" ? "bg-emerald-500" : "bg-amber-500"
              }`}
              aria-hidden="true"
            />
            Status
          </p>
          <div className="inline-flex h-8 w-full rounded-md ring-1 ring-neutral-200 divide-x divide-neutral-200 overflow-hidden bg-white">
            <button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, status: "draft" }))}
              className={`flex-1 inline-flex items-center justify-center px-3 text-xs font-medium transition-colors ${
                formData.status === "draft"
                  ? "bg-neutral-900 text-white"
                  : "bg-white text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              Draft
            </button>
            <button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, status: "published" }))}
              className={`flex-1 inline-flex items-center justify-center px-3 text-xs font-medium transition-colors ${
                formData.status === "published"
                  ? "bg-neutral-900 text-white"
                  : "bg-white text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              Published
            </button>
          </div>
        </div>

        {/* Featured Image */}
        <div className="bg-white rounded-md ring-1 ring-neutral-200/70 p-4">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-2">
            <span className="inline-block h-1 w-1 rounded-full bg-neutral-400" aria-hidden="true" />
            Featured image
          </p>
          <ImageUpload
            value={formData.featured_image}
            onChange={(url) => setFormData((prev) => ({ ...prev, featured_image: url }))}
            label="Cover image"
          />
        </div>

        {/* Category */}
        <div className="bg-white rounded-md ring-1 ring-neutral-200/70 p-4">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-2">
            <span className="inline-block h-1 w-1 rounded-full bg-neutral-400" aria-hidden="true" />
            Category
          </p>
          <select
            value={formData.category}
            onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
            className="w-full h-9 px-3 ring-1 ring-neutral-200 rounded-md bg-white text-sm text-neutral-900 focus:ring-2 focus:ring-neutral-900 focus:outline-none"
            aria-label="Category"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Tags */}
        <div className="bg-white rounded-md ring-1 ring-neutral-200/70 p-4">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-2">
            <span className="inline-block h-1 w-1 rounded-full bg-neutral-400" aria-hidden="true" />
            Tags
            {tagSuggestions.length > 0 && (
              <span className="text-[11px] font-normal text-neutral-400 normal-case tracking-normal tabular-nums">
                · {tagSuggestions.length} known
              </span>
            )}
          </p>
          <TaxonomyChipInput
            values={formData.tags}
            onChange={(next) => setFormData((prev) => ({ ...prev, tags: next }))}
            suggestions={tagSuggestions}
            placeholder="Type to search or add"
            ariaLabel="Tags"
          />
        </div>

        {/* Author */}
        <div className="bg-white rounded-md ring-1 ring-neutral-200/70 p-4">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-2">
            <span className="inline-block h-1 w-1 rounded-full bg-neutral-400" aria-hidden="true" />
            Author
            {authorSuggestions.length > 0 && (
              <span className="text-[11px] font-normal text-neutral-400 normal-case tracking-normal tabular-nums">
                · {authorSuggestions.length} known
              </span>
            )}
          </p>
          <input
            type="text"
            value={formData.author}
            onChange={(e) => setFormData((prev) => ({ ...prev, author: e.target.value }))}
            placeholder="Author name"
            list="blog-author-suggestions"
            className="w-full h-9 px-3 ring-1 ring-neutral-200 rounded-md bg-white text-sm text-neutral-900 placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-900 focus:outline-none"
          />
          <datalist id="blog-author-suggestions">
            {authorSuggestions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>

        {/* Meta Description */}
        <div className="bg-white rounded-md ring-1 ring-neutral-200/70 p-4">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-2">
            <span className="inline-block h-1 w-1 rounded-full bg-neutral-400" aria-hidden="true" />
            SEO description
          </p>
          <textarea
            value={formData.meta_description}
            onChange={(e) => setFormData((prev) => ({ ...prev, meta_description: e.target.value }))}
            placeholder="Description for search engines"
            rows={3}
            maxLength={160}
            className="w-full px-3 py-2 ring-1 ring-neutral-200 rounded-md bg-white text-sm text-neutral-900 placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-900 focus:outline-none resize-y"
          />
          <div className="mt-1 flex items-center justify-between gap-2 text-[11px]">
            {formData.meta_description.length === 0 ? (
              <span className="text-neutral-500">Empty — Google will auto-generate.</span>
            ) : (
              <span />
            )}
            <span className="text-neutral-400 tabular-nums">{formData.meta_description.length}/160</span>
          </div>
        </div>
      </div>
    </div>
  )
}
