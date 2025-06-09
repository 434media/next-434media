"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { Upload, ImageIcon, LinkIcon, X, Check, Search, Loader2, RefreshCw, AlertCircle, Edit2 } from "lucide-react"
import Image from "next/image"
import type { BlogImage, BlogImagesResponse, ImageUploadResponse } from "../../types/blog-types"
import ImageEditor from "./ImageEditor"

interface ImageSelectorProps {
  selectedImage: string
  onImageSelect: (url: string) => void
  onImageClear: () => void
  isInEditor?: boolean
}

export default function ImageSelector({
  selectedImage,
  onImageSelect,
  onImageClear,
  isInEditor = true,
}: ImageSelectorProps) {
  const [activeTab, setActiveTab] = useState<"upload" | "library" | "url">("upload")
  const [images, setImages] = useState<BlogImage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [urlInput, setUrlInput] = useState(selectedImage || "")
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState(Date.now())
  const [editingImage, setEditingImage] = useState<BlogImage | null>(null)

  const loadImages = useCallback(async () => {
    if (activeTab !== "library") return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/blog/images?t=${Date.now()}`)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data: BlogImagesResponse = await response.json()

      if (data.success) {
        setImages(data.images)
      } else {
        throw new Error(data.error || "Failed to load images")
      }
    } catch (error) {
      console.error("Error loading images:", error)
      setError(error instanceof Error ? error.message : "Failed to load images")
      setImages([]) // Clear images on error
    } finally {
      setIsLoading(false)
    }
  }, [activeTab, lastRefresh])

  useEffect(() => {
    loadImages()
  }, [loadImages])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    setUploadProgress(0)
    setError(null)

    const formData = new FormData()
    Array.from(files).forEach((file) => {
      formData.append("images", file)
    })

    // Add isInEditor flag to indicate we're already authenticated
    if (isInEditor) {
      formData.append("isInEditor", "true")
    }

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          const newProgress = prev + 10
          if (newProgress >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return newProgress
        })
      }, 200)

      const response = await fetch("/api/blog/upload-image", {
        method: "POST",
        body: formData,
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Upload failed with status: ${response.status}`)
      }

      const result: ImageUploadResponse = await response.json()

      if (result.success && result.images && result.images.length > 0) {
        // Auto-select the first uploaded image
        const uploadedImage = result.images[0]
        onImageSelect(uploadedImage.url)

        // Add uploaded images to current state immediately
        setImages((prev) => [...result.images!, ...prev])

        // Force refresh and switch to library
        setTimeout(() => {
          setIsUploading(false)
          setUploadProgress(0)
          setActiveTab("library")
          setLastRefresh(Date.now())
        }, 1000)
      } else {
        throw new Error(result.error || "Upload failed - no images returned")
      }
    } catch (error) {
      console.error("Error uploading image:", error)
      setError(error instanceof Error ? error.message : "Upload failed")
      setIsUploading(false)
      setUploadProgress(0)
    }

    // Reset file input
    event.target.value = ""
  }

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      onImageSelect(urlInput.trim())
    }
  }

  const handleRefresh = () => {
    setLastRefresh(Date.now())
  }

  const handleImageUpdate = (updatedImage: BlogImage) => {
    setImages((prev) => prev.map((img) => (img.id === updatedImage.id ? updatedImage : img)))
    setEditingImage(null)
  }

  const filteredImages = images.filter(
    (image) =>
      image.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (image.alt_text && image.alt_text.toLowerCase().includes(searchTerm.toLowerCase())),
  )

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
    <div className="space-y-4">
      {/* Current Image Preview */}
      {selectedImage && (
        <div className="relative">
          <Image
            src={selectedImage || "/placeholder.svg"}
            alt="Selected featured image"
            width={600}
            height={200}
            className="w-full h-32 object-cover rounded-xl shadow-lg border border-gray-200"
            onError={(e) => {
              e.currentTarget.src = "https://placehold.co/600x200/f5f5f5/333333?text=Image+Not+Found"
            }}
          />
          <button
            onClick={onImageClear}
            className="absolute top-2 right-2 w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center hover:bg-red-700 transition-colors"
            aria-label="Remove selected image"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab("upload")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "upload"
              ? "border-purple-500 text-purple-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <Upload className="w-4 h-4 inline mr-2" />
          Upload
        </button>
        <button
          onClick={() => setActiveTab("library")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "library"
              ? "border-purple-500 text-purple-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <ImageIcon className="w-4 h-4 inline mr-2" />
          Library ({images.length})
        </button>
        <button
          onClick={() => setActiveTab("url")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "url"
              ? "border-purple-500 text-purple-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <LinkIcon className="w-4 h-4 inline mr-2" />
          URL
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-800 text-sm font-medium">Error</p>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Tab Content */}
      <div className="min-h-[200px]">
        {/* Upload Tab */}
        {activeTab === "upload" && (
          <div className="space-y-4">
            {isUploading ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 text-purple-600 animate-spin mx-auto mb-4" />
                <p className="text-gray-600 mb-2">Uploading image...</p>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden max-w-xs mx-auto">
                  <div
                    className="h-full bg-gradient-to-r from-purple-600 to-blue-600 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-sm text-gray-500 mt-2">{uploadProgress}%</p>
                {uploadProgress === 100 && (
                  <p className="text-sm text-green-600 mt-2 font-medium">Upload complete! Switching to library...</p>
                )}
              </div>
            ) : (
              <label className="block">
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-purple-400 transition-colors cursor-pointer">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 font-medium mb-2">Click to upload or drag and drop</p>
                  <p className="text-sm text-gray-500">PNG, JPG, GIF, WebP up to 10MB</p>
                  <p className="text-xs text-gray-400 mt-1">Maximum 10 files at once</p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                />
              </label>
            )}
          </div>
        )}

        {/* Library Tab */}
        {activeTab === "library" && (
          <div className="space-y-4">
            {/* Search and Refresh */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search images..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                />
              </div>
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                title="Refresh images"
              >
                <RefreshCw className={`w-4 h-4 text-gray-600 ${isLoading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {/* Images Grid */}
            {isLoading ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 text-purple-600 animate-spin mx-auto mb-4" />
                <p className="text-gray-600">Loading images...</p>
              </div>
            ) : filteredImages.length === 0 ? (
              <div className="text-center py-8">
                <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">
                  {searchTerm ? "No images found" : images.length === 0 ? "No images in library" : "No matching images"}
                </p>
                <p className="text-sm text-gray-500">
                  {searchTerm ? "Try a different search term" : "Upload some images to get started"}
                </p>
                {!searchTerm && images.length === 0 && (
                  <button
                    onClick={() => setActiveTab("upload")}
                    className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
                  >
                    Upload Images
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                {filteredImages.map((image) => (
                  <div
                    key={image.id}
                    className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                      selectedImage === image.url
                        ? "border-purple-500 shadow-lg"
                        : "border-transparent hover:border-purple-300"
                    }`}
                  >
                    <div className="aspect-square bg-gray-100 relative" onClick={() => onImageSelect(image.url)}>
                      <Image
                        src={image.url || "/placeholder.svg"}
                        alt={image.alt_text || image.filename}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 50vw, 33vw"
                        onError={(e) => {
                          // @ts-ignore - TypeScript doesn't know about currentTarget.src
                          e.currentTarget.src = "https://placehold.co/400x400/f5f5f5/333333?text=Image+Not+Found"
                        }}
                      />
                      {selectedImage === image.url && (
                        <div className="absolute inset-0 bg-purple-600/20 flex items-center justify-center">
                          <Check className="w-6 h-6 text-white bg-purple-600 rounded-full p-1" />
                        </div>
                      )}

                      {/* Edit button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingImage(image)
                        }}
                        className="absolute top-2 right-2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center hover:bg-white transition-all opacity-0 group-hover:opacity-100"
                        title="Edit image details"
                      >
                        <Edit2 className="w-4 h-4 text-gray-700" />
                      </button>
                    </div>
                    <div className="p-2 bg-white">
                      <p className="text-xs font-medium text-gray-900 truncate" title={image.original_name}>
                        {image.original_name}
                      </p>
                      <div className="flex justify-between items-center mt-1">
                        <p className="text-xs text-gray-500">{formatFileSize(image.file_size)}</p>
                        <p className="text-xs text-gray-400">{formatDate(image.created_at)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Image Editor Modal */}
            {editingImage && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                  <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="text-lg font-medium text-gray-900">Edit Image</h3>
                    <button onClick={() => setEditingImage(null)} className="p-1 rounded-full hover:bg-gray-100">
                      <X className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>

                  <div className="p-4">
                    <div className="mb-4 aspect-square relative bg-gray-100 rounded-lg overflow-hidden">
                      <Image
                        src={editingImage.url || "/placeholder.svg"}
                        alt={editingImage.alt_text || editingImage.filename}
                        fill
                        className="object-contain"
                        onError={(e) => {
                          // @ts-ignore
                          e.currentTarget.src = "https://placehold.co/400x400/f5f5f5/333333?text=Image+Not+Found"
                        }}
                      />
                    </div>

                    <ImageEditor image={editingImage} onUpdate={handleImageUpdate} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* URL Tab */}
        {activeTab === "url" && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Image URL</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                />
                <button
                  onClick={handleUrlSubmit}
                  disabled={!urlInput.trim()}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                >
                  Use URL
                </button>
              </div>
            </div>

            {urlInput && (
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Preview:</p>
                <img
                  src={urlInput || "/placeholder.svg"}
                  alt="URL preview"
                  className="w-full h-32 object-cover rounded-lg border border-gray-200"
                  onError={(e) => {
                    e.currentTarget.src = "https://placehold.co/600x200/f5f5f5/333333?text=Invalid+URL"
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
