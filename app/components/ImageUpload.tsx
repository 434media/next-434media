"use client"

import { useState, useRef } from "react"
import { upload } from "@vercel/blob/client"
import { Upload, X, Link as LinkIcon, Loader2, Image as ImageIcon } from "lucide-react"
import { Button } from "./analytics/Button"

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
  const [uploadMethod, setUploadMethod] = useState<"url" | "file">("url")
  const [preview, setPreview] = useState<string>(value)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

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
  }

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
    <div className="space-y-3">
      <label className="block text-sm font-medium">{label}</label>
      
      {/* Method Toggle */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant={uploadMethod === "url" ? "default" : "outline"}
          size="sm"
          onClick={() => setUploadMethod("url")}
          className="flex items-center gap-2"
        >
          <LinkIcon className="h-4 w-4" />
          URL
        </Button>
        <Button
          type="button"
          variant={uploadMethod === "file" ? "default" : "outline"}
          size="sm"
          onClick={() => setUploadMethod("file")}
          className="flex items-center gap-2"
        >
          <Upload className="h-4 w-4" />
          Upload
        </Button>
      </div>

      {/* URL Input */}
      {uploadMethod === "url" && (
        <div className="flex gap-2">
          {hideUrl && value ? (
            <div className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 text-sm flex items-center gap-2">
              <LinkIcon className="h-4 w-4 text-green-500" />
              <span>Image URL added</span>
            </div>
          ) : (
            <input
              type="url"
              value={value}
              onChange={(e) => handleUrlChange(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="https://example.com/image.jpg"
            />
          )}
          {value && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClear}
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" />
            </Button>
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
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-2 flex-1"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Choose File
                </>
              )}
            </Button>
            {value && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClear}
                disabled={isUploading}
                className="flex items-center gap-2"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-xs text-gray-500">
            Max size: {maxSize}MB • Formats: JPG, PNG, GIF, WebP
          </p>
        </div>
      )}

      {/* Preview */}
      {preview && getSafeImageUrl(preview) && (
        <div className="relative border border-gray-300 rounded-lg overflow-hidden bg-gray-50 p-2">
          <div className="relative w-full h-48 flex items-center justify-center">
            <img
              src={getSafeImageUrl(preview) || ''}
              alt="Preview"
              className="max-w-full max-h-full object-contain rounded"
              onError={() => setPreview("")}
            />
          </div>
          {value && !hideUrl && (
            <div className="mt-2 p-2 bg-white rounded text-xs text-gray-600 break-all">
              {value}
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!preview && (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500">
            {uploadMethod === "url" ? "Enter image URL above" : "Click 'Choose File' to upload"}
          </p>
        </div>
      )}
    </div>
  )
}
