"use client"

import type React from "react"

import { useState } from "react"
import { Edit2, Check, AlertCircle, Loader2 } from "lucide-react"
import type { BlogImage } from "../../types/blog-types"

interface ImageEditorProps {
  image: BlogImage
  onUpdate: (updatedImage: BlogImage) => void
}

export default function ImageEditor({ image, onUpdate }: ImageEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [displayName, setDisplayName] = useState(image.filename || "")
  const [altText, setAltText] = useState(image.alt_text || "")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/blog/edit-image", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: image.id,
          filename: displayName,
          alt_text: altText,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Error: ${response.status}`)
      }

      const data = await response.json()

      if (data.success) {
        onUpdate(data.image)
        setIsEditing(false)
      } else {
        throw new Error(data.error || "Failed to update image")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update image")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    setDisplayName(image.filename || "")
    setAltText(image.alt_text || "")
    setIsEditing(false)
    setError(null)
  }

  // Format file size properly
  const formatFileSize = (bytes: number): string => {
    if (!bytes || isNaN(bytes)) return "Unknown size"
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1048576).toFixed(1)} MB`
  }

  const formatDate = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    } catch (e) {
      return "Unknown date"
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
      {isEditing ? (
        <form onSubmit={handleSubmit} className="p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-md text-red-700 text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
                Display Name
              </label>
              <input
                type="text"
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                disabled={isLoading}
                required
              />
            </div>

            <div>
              <label htmlFor="altText" className="block text-sm font-medium text-gray-700 mb-1">
                Alt Text
              </label>
              <input
                type="text"
                id="altText"
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                disabled={isLoading}
              />
              <p className="mt-1 text-xs text-gray-500">Describe the image for accessibility and SEO</p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleCancel}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-2 bg-purple-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 flex items-center gap-1"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Save</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="p-4">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-medium text-gray-900">{image.filename}</h3>
              <p className="text-sm text-gray-500 mt-1">{formatFileSize(image.file_size)}</p>
              <p className="text-xs text-gray-400 mt-1">Uploaded: {formatDate(image.created_at)}</p>
              <p className="text-xs text-gray-400">Updated: {formatDate(image.updated_at)}</p>
              <p className="text-xs text-gray-400">By: {image.uploaded_by}</p>
            </div>
            <button
              onClick={() => setIsEditing(true)}
              className="p-1.5 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              title="Edit image details"
            >
              <Edit2 className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          {image.alt_text && (
            <div className="mt-2">
              <p className="text-xs text-gray-500 font-medium">Alt Text:</p>
              <p className="text-sm text-gray-700">{image.alt_text}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
