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
  const [uploadMethod, setUploadMethod] = useState<"url" | "file">("url")
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
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-neutral-800 tracking-tight leading-none">{label}</label>
      
      {/* Method Toggle - Enhanced Visual Feedback */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setUploadMethod("url")}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border-2 transition-all duration-200 ${
            uploadMethod === "url" 
              ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200" 
              : "bg-white border-neutral-200 text-neutral-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
          }`}
        >
          <LinkIcon className="h-4 w-4" />
          <span>Paste URL</span>
          {uploadMethod === "url" && (
            <span className="hidden sm:inline-flex w-2 h-2 bg-white rounded-full animate-pulse" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setUploadMethod("file")}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border-2 transition-all duration-200 ${
            uploadMethod === "file" 
              ? "bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-200" 
              : "bg-white border-neutral-200 text-neutral-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600"
          }`}
        >
          <Upload className="h-4 w-4" />
          <span>Upload File</span>
          {uploadMethod === "file" && (
            <span className="hidden sm:inline-flex w-2 h-2 bg-white rounded-full animate-pulse" />
          )}
        </button>
      </div>
      
      {/* Method Description Helper */}
      <p className="text-xs text-neutral-500 leading-relaxed">
        {uploadMethod === "url" 
          ? "Paste an image URL from the web (e.g., from Unsplash, Google Drive, or any public image link)"
          : "Upload an image from your device (JPG, PNG, GIF, WebP • Max 10MB)"}
      </p>

      {/* URL Input */}
      {uploadMethod === "url" && (
        <div className="flex gap-2">
          {hideUrl && value ? (
            <div className="flex-1 px-4 py-3 border-2 border-green-200 rounded-lg bg-green-50 text-green-700 text-sm font-medium flex items-center gap-2">
              <LinkIcon className="h-4 w-4 text-green-500" />
              <span>Image URL added</span>
            </div>
          ) : (
            <input
              type="url"
              value={value}
              onChange={(e) => handleUrlChange(e.target.value)}
              className="flex-1 px-4 py-3 border-2 border-neutral-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-400 text-sm font-medium placeholder:text-neutral-400 transition-all"
              placeholder="https://example.com/image.jpg"
            />
          )}
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="px-3 py-2 border-2 border-neutral-200 rounded-lg text-neutral-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-all"
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
            className={`relative flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 ${
              isDragging
                ? "bg-sky-50 border-sky-400 ring-4 ring-sky-100 scale-[1.02]"
                : isUploading 
                  ? "bg-emerald-50 border-emerald-300" 
                  : value 
                    ? "bg-green-50 border-green-300 hover:bg-green-100"
                    : "bg-neutral-50 border-neutral-300 hover:border-emerald-400 hover:bg-emerald-50"
            }`}
          >
            {isDragging ? (
              <>
                <div className="w-12 h-12 rounded-full bg-sky-100 flex items-center justify-center animate-bounce">
                  <Upload className="h-6 w-6 text-sky-600" />
                </div>
                <span className="text-sm font-semibold text-sky-700">Drop your image here!</span>
              </>
            ) : isUploading ? (
              <>
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Loader2 className="h-5 w-5 text-emerald-600 animate-spin" />
                </div>
                <span className="text-sm font-medium text-emerald-700">Uploading your file...</span>
              </>
            ) : (
              <>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  value ? "bg-green-100" : "bg-neutral-200"
                }`}>
                  <Upload className={`h-5 w-5 ${value ? "text-green-600" : "text-neutral-500"}`} />
                </div>
                <div className="text-center">
                  <span className={`text-sm font-semibold ${
                    value ? "text-green-700" : "text-neutral-700"
                  }`}>
                    {value ? "File uploaded! Click or drag to replace" : "Drop image here or click to browse"}
                  </span>
                  <p className="text-xs text-neutral-500 mt-1">
                    JPG, PNG, GIF, WebP • Max {maxSize}MB
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
              className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1"
            >
              <X className="h-3 w-3" />
              Remove file
            </button>
          )}
        </div>
      )}

      {/* Preview */}
      {preview && getSafeImageUrl(preview) && (
        <div className="relative border-2 border-neutral-200 rounded-xl overflow-hidden bg-neutral-50 p-3">
          <div className="absolute top-3 right-3 z-10">
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
              Image ready
            </span>
          </div>
          <div className="relative w-full h-48 flex items-center justify-center bg-white rounded-lg">
            <img
              src={getSafeImageUrl(preview) || ''}
              alt="Preview"
              className="max-w-full max-h-full object-contain rounded"
              onError={() => setPreview("")}
            />
          </div>
          {value && !hideUrl && (
            <div className="mt-3 p-2 bg-white rounded-lg border border-neutral-200 text-xs text-neutral-600 break-all font-mono">
              {value}
            </div>
          )}
        </div>
      )}

      {/* Empty State - Only show for URL method when no preview */}
      {!preview && uploadMethod === "url" && (
        <div className="border-2 border-dashed border-neutral-200 rounded-xl p-8 text-center bg-neutral-50/50">
          <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-3">
            <ImageIcon className="h-6 w-6 text-neutral-400" />
          </div>
          <p className="text-sm font-medium text-neutral-600">
            No image added yet
          </p>
          <p className="text-xs text-neutral-400 mt-1">
            Paste an image URL in the field above
          </p>
        </div>
      )}
    </div>
  )
}
