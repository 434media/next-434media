"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { upload } from "@vercel/blob/client"
import { Upload, X, Link as LinkIcon, Loader2, Image as ImageIcon } from "lucide-react"

interface ImageUploadProps {
  value: string
  onChange: (value: string) => void
  label: string
  accept?: string
  maxSize?: number // in MB
  hideUrl?: boolean // Hide the URL display from the UI
}

export function ImageUpload({ 
  value, 
  onChange, 
  label, 
  accept = "image/*,.gif",
  maxSize = 10,
  hideUrl = false
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  // File-first default — matches the dominant editor flow (drop a Figma export)
  // and the convention used by Notion / Linear / Vercel / Sanity / Contentful.
  // Paste URL stays as the fallback for stock images already hosted elsewhere.
  const [uploadMethod, setUploadMethod] = useState<"url" | "file">("file")
  const [preview, setPreview] = useState<string>(value)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  // Sync preview with value prop when it changes (e.g., when editing an existing item)
  useEffect(() => {
    setPreview(value)
  }, [value])

  // Process and upload a file (shared between click and drag-drop)
  const processFile = useCallback(async (file: File) => {
    // Validate file size
    if (file.size > maxSize * 1024 * 1024) {
      alert(`File size must be less than ${maxSize}MB`)
      return
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file")
      return
    }

    setIsUploading(true)

    try {
      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result as string)
      }
      reader.readAsDataURL(file)

      // Generate unique filename
      const timestamp = Date.now()
      const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
      const filename = `${timestamp}-${originalName}`

      // Upload directly to Vercel Blob (client-side upload)
      const blob = await upload(filename, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
      })

      onChange(blob.url)
      setPreview(blob.url)
    } catch (error) {
      console.error("Upload error:", error)
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      alert(`Failed to upload file: ${errorMessage}`)
      setPreview(value)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }, [maxSize, onChange, value])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await processFile(file)
  }

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
    // Auto-switch to file upload mode when dragging
    setUploadMethod("file")
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Only set isDragging to false if we're leaving the drop zone entirely
    const relatedTarget = e.relatedTarget as Node | null
    if (!dropZoneRef.current?.contains(relatedTarget)) {
      setIsDragging(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      const file = files[0]
      await processFile(file)
    }
  }, [processFile])

  // Helper to validate and sanitize image URLs
  const getSafeImageUrl = (url: string): string | null => {
    if (!url) return null
    try {
      const urlObj = new URL(url.trim())
      // Only allow http, https, data (for base64), and blob (for local uploads) protocols
      if (['http:', 'https:', 'data:', 'blob:'].includes(urlObj.protocol)) {
        return urlObj.href
      }
    } catch {
      // Invalid URL
    }
    return null
  }

  const handleUrlChange = (url: string) => {
    // Validate URL before accepting it
    const safeUrl = getSafeImageUrl(url)
    if (safeUrl || url === '') {
      onChange(safeUrl || '')
      setPreview(safeUrl || '')
    } else {
      // Still set the input value so user can see what they typed
      onChange(url)
      setPreview('') // Don't preview invalid URLs
    }
  }

  const handleClear = () => {
    onChange("")
    setPreview("")
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-2.5">
      <label className="block text-sm font-medium text-neutral-700">{label}</label>

      {/* Method toggle — segmented control matching the rest of admin.
          Upload File leads (primary flow); Paste URL is the fallback. */}
      <div className="inline-flex h-8 rounded-md ring-1 ring-neutral-200 divide-x divide-neutral-200 overflow-hidden bg-white">
        <button
          type="button"
          onClick={() => setUploadMethod("file")}
          className={`inline-flex items-center gap-1.5 px-3 text-xs font-medium whitespace-nowrap transition-colors ${
            uploadMethod === "file"
              ? "bg-neutral-900 text-white"
              : "bg-white text-neutral-700 hover:bg-neutral-50"
          }`}
        >
          <Upload className="h-3.5 w-3.5" />
          Upload File
        </button>
        <button
          type="button"
          onClick={() => setUploadMethod("url")}
          className={`inline-flex items-center gap-1.5 px-3 text-xs font-medium whitespace-nowrap transition-colors ${
            uploadMethod === "url"
              ? "bg-neutral-900 text-white"
              : "bg-white text-neutral-700 hover:bg-neutral-50"
          }`}
        >
          <LinkIcon className="h-3.5 w-3.5" />
          Paste URL
        </button>
      </div>

      {/* URL Input */}
      {uploadMethod === "url" && (
        <div className="flex gap-2">
          {hideUrl && value ? (
            <div className="flex-1 h-10 px-3 ring-1 ring-neutral-200 rounded-md bg-neutral-50 text-neutral-700 text-sm flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" aria-hidden="true" />
              <span>Image URL added</span>
            </div>
          ) : (
            <input
              type="url"
              value={value}
              onChange={(e) => handleUrlChange(e.target.value)}
              className="flex-1 h-10 px-3 ring-1 ring-neutral-200 rounded-md focus:ring-2 focus:ring-neutral-900 focus:outline-none text-sm bg-white font-mono"
              placeholder="https://example.com/image.jpg"
            />
          )}
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center justify-center h-10 w-10 rounded-md ring-1 ring-neutral-200 bg-white text-neutral-500 hover:bg-red-50 hover:text-red-600 hover:ring-red-200 transition-colors"
              aria-label="Clear image"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* File Upload */}
      {uploadMethod === "file" && (
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploading}
          />
          <div
            ref={dropZoneRef}
            onClick={() => !isUploading && fileInputRef.current?.click()}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative flex flex-col items-center justify-center gap-2.5 p-6 ring-1 rounded-md cursor-pointer transition-colors ${
              isDragging
                ? "bg-neutral-50 ring-2 ring-neutral-900"
                : isUploading
                ? "bg-neutral-50 ring-neutral-200"
                : "bg-white ring-neutral-200 hover:ring-neutral-300 hover:bg-neutral-50"
            }`}
          >
            {isDragging ? (
              <>
                <div className="grid h-10 w-10 place-items-center rounded-md bg-neutral-100 text-neutral-700">
                  <Upload className="h-5 w-5" />
                </div>
                <span className="text-sm font-medium text-neutral-900">Drop your image here</span>
              </>
            ) : isUploading ? (
              <>
                <div className="grid h-10 w-10 place-items-center rounded-md bg-neutral-100 text-neutral-700">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
                <span className="text-sm font-medium text-neutral-700">Uploading…</span>
              </>
            ) : (
              <>
                <div className="grid h-10 w-10 place-items-center rounded-md bg-neutral-100 text-neutral-700">
                  <Upload className="h-5 w-5" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-neutral-900 flex items-center justify-center gap-1.5">
                    {value && (
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                    )}
                    {value ? "File uploaded · click or drag to replace" : "Drop image here or click to browse"}
                  </p>
                  <p className="text-[11px] text-neutral-500 mt-1">
                    JPG, PNG, GIF, WebP · max {maxSize}MB
                  </p>
                </div>
              </>
            )}
          </div>
          {value && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleClear(); }}
              disabled={isUploading}
              className="text-[11px] text-neutral-500 hover:text-red-600 font-medium flex items-center gap-1 transition-colors"
            >
              <X className="h-3 w-3" />
              Remove file
            </button>
          )}
        </div>
      )}

      {/* Preview */}
      {preview && getSafeImageUrl(preview) && (
        <div className="relative rounded-md ring-1 ring-neutral-200/70 overflow-hidden bg-neutral-50 p-3">
          <div className="absolute top-3 right-3 z-10">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white ring-1 ring-neutral-200 text-neutral-700 text-[10px] font-medium uppercase tracking-[0.16em]">
              <span className="inline-block h-1 w-1 rounded-full bg-emerald-500" aria-hidden="true" />
              Ready
            </span>
          </div>
          <div className="relative w-full h-48 flex items-center justify-center bg-white rounded-md">
            <img
              src={getSafeImageUrl(preview) || ''}
              alt="Preview"
              className="max-w-full max-h-full object-contain rounded"
              onError={() => setPreview("")}
            />
          </div>
          {value && !hideUrl && (
            <div className="mt-3 p-2 bg-white rounded-md ring-1 ring-neutral-200 text-[11px] text-neutral-600 break-all font-mono">
              {value}
            </div>
          )}
        </div>
      )}

      {/* Empty State — only for URL method when no preview */}
      {!preview && uploadMethod === "url" && (
        <div className="rounded-md ring-1 ring-neutral-200/70 p-6 text-center bg-neutral-50/40">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-neutral-100 text-neutral-700 mx-auto mb-2">
            <ImageIcon className="h-4 w-4" />
          </div>
          <p className="text-sm font-medium text-neutral-700">No image added yet</p>
          <p className="text-[11px] text-neutral-500 mt-0.5">Paste an image URL in the field above</p>
        </div>
      )}
    </div>
  )
}
