"use client"

import { useState, useEffect, useCallback } from "react"
import { ArrowLeft, Upload, Trash2, Search, ImageIcon, Check, Loader2, Plus, RefreshCw, Edit2, X } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import ImageEditor from "../../../components/blog/ImageEditor"
import type { BlogImage } from "../../../types/blog-types"

export default function MediaLibraryPage() {
  const [images, setImages] = useState<BlogImage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedImages, setSelectedImages] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState(Date.now())
  const [editingImage, setEditingImage] = useState<BlogImage | null>(null)

  // Allowed file types for upload
  const ALLOWED_FILE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]
  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

  const loadImages = useCallback(async () => {
    const adminPassword = sessionStorage.getItem("adminKey") || localStorage.getItem("adminKey")
    if (!adminPassword) return

    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/blog/images?t=${Date.now()}`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()

      if (data.success) {
        setImages(data.images || [])
      } else {
        throw new Error(data.error || "Failed to load images")
      }
    } catch (error) {
      console.error("Error loading images:", error)
      setError("Failed to load images from server.")
      setImages([])
    } finally {
      setIsLoading(false)
    }
  }, [lastRefresh])

  useEffect(() => {
    loadImages()
  }, [loadImages])

  // Clear success message after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  const handleFileSelect = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/jpeg,image/jpg,image/png,image/gif,image/webp"
    input.multiple = true
    input.onchange = (event) => {
      const files = (event.target as HTMLInputElement).files
      if (!files || files.length === 0) return

      // Validate files
      const invalidFiles = Array.from(files).filter(
        (file) => !ALLOWED_FILE_TYPES.includes(file.type) || file.size > MAX_FILE_SIZE || file.size === 0,
      )

      if (invalidFiles.length > 0) {
        const fileErrors = invalidFiles.map((file) => {
          if (!ALLOWED_FILE_TYPES.includes(file.type)) {
            return `"${file.name}" has invalid type: ${file.type}`
          }
          if (file.size > MAX_FILE_SIZE) {
            return `"${file.name}" exceeds maximum size of 10MB`
          }
          if (file.size === 0) {
            return `"${file.name}" is empty`
          }
          return `"${file.name}" is invalid`
        })
        setError(`Cannot upload: ${fileErrors.join(", ")}`)
        return
      }

      handleFileUpload(files)
    }
    input.click()
  }

  const handleFileUpload = async (files: FileList) => {
    if (!files || files.length === 0) return

    const adminPassword = sessionStorage.getItem("adminKey") || localStorage.getItem("adminKey")
    if (!adminPassword) return

    setIsUploading(true)
    setUploadProgress(0)
    setError(null)
    setSuccessMessage(null)

    const formData = new FormData()
    Array.from(files).forEach((file) => {
      formData.append("images", file)
    })

    // Add admin password to form data
    formData.append("adminPassword", adminPassword)

    try {
      // Simulate upload progress
      const interval = setInterval(() => {
        setUploadProgress((prev) => {
          const newProgress = prev + 5
          if (newProgress >= 95) {
            clearInterval(interval)
            return 95
          }
          return newProgress
        })
      }, 100)

      const response = await fetch("/api/blog/upload-image", {
        method: "POST",
        body: formData,
      })

      clearInterval(interval)
      setUploadProgress(100)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Upload failed with status: ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        setSuccessMessage(`Successfully uploaded ${result.images?.length || files.length} image(s)!`)

        // Add uploaded images to current state immediately for instant feedback
        if (result.images) {
          setImages((prev) => [...result.images, ...prev])
        }

        // Force refresh after a short delay
        setTimeout(() => {
          setIsUploading(false)
          setUploadProgress(0)
          setLastRefresh(Date.now())
        }, 1000)
      } else {
        throw new Error(result.error || "Upload failed")
      }
    } catch (error) {
      console.error("Error uploading images:", error)
      setError(error instanceof Error ? error.message : "Upload failed. Please try again.")
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  const toggleImageSelection = (id: string) => {
    setSelectedImages((prev) => (prev.includes(id) ? prev.filter((imageId) => imageId !== id) : [...prev, id]))
  }

  const handleDeleteSelected = async () => {
    if (selectedImages.length === 0) return

    const adminPassword = sessionStorage.getItem("adminKey") || localStorage.getItem("adminKey")
    if (!adminPassword) return

    try {
      setError(null)

      const response = await fetch("/api/blog/delete-images", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageIds: selectedImages,
          adminPassword: adminPassword,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Delete failed with status: ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        // Remove deleted images from state immediately
        setImages((prev) => prev.filter((image) => !selectedImages.includes(image.id)))
        setSelectedImages([])
        setSuccessMessage(`Successfully deleted ${selectedImages.length} image(s)!`)
      } else {
        throw new Error(result.error || "Delete failed")
      }
    } catch (error) {
      console.error("Error deleting images:", error)
      setError(error instanceof Error ? error.message : "Failed to delete images. Please try again.")
    }
  }

  const handleRefresh = () => {
    setLastRefresh(Date.now())
  }

  const handleImageUpdate = (updatedImage: BlogImage) => {
    setImages((prev) => prev.map((img) => (img.id === updatedImage.id ? updatedImage : img)))
    setEditingImage(null)
    setSuccessMessage("Image updated successfully!")
  }

  const filteredImages = images.filter(
    (image) =>
      image.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (image.alt_text && image.alt_text.toLowerCase().includes(searchTerm.toLowerCase())),
  )

  const formatFileSize = (bytes: number) => {
    if (!bytes || isNaN(bytes)) return "Unknown size"
    if (bytes < 1024) return bytes + " B"
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB"
    else return (bytes / 1048576).toFixed(1) + " MB"
  }

  const formatDate = (dateString: string) => {
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/30 pt-24 sm:pt-28 lg:pt-32">
      {/* Floating Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-gradient-to-r from-purple-400/10 to-blue-400/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-3/4 right-1/4 w-96 h-96 bg-gradient-to-r from-blue-400/10 to-purple-400/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-3">
            <Link href="/admin/blog" className="p-2 bg-white/80 rounded-lg hover:bg-white transition-all duration-200">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-900 via-purple-800 to-blue-800 bg-clip-text text-transparent">
                Media Library
              </h1>
              <p className="text-gray-600 text-sm sm:text-base">Manage images for your blog posts and articles</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleFileSelect}
              disabled={isUploading}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all duration-300"
            >
              <Upload className="w-5 h-5" />
              <span className="font-medium">Upload Images</span>
            </button>

            {selectedImages.length > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all duration-300"
              >
                <Trash2 className="w-5 h-5" />
                <span>Delete Selected ({selectedImages.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-green-400 rounded-full flex items-center justify-center">
                <Check className="w-3 h-3 text-green-800" />
              </div>
              <p className="text-green-800 font-medium">{successMessage}</p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-red-400 rounded-full flex items-center justify-center">
                <span className="text-red-800 text-xs font-bold">!</span>
              </div>
              <p className="text-red-800 font-medium">{error}</p>
            </div>
          </div>
        )}

        {/* Upload Progress */}
        {isUploading && (
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 mb-6 border border-white/20 shadow-lg">
            <div className="flex items-center gap-3 mb-2">
              <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />
              <p className="font-medium text-gray-800">Uploading images...</p>
              <span className="text-sm text-gray-600">{uploadProgress}%</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-600 to-blue-600 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            {uploadProgress === 100 && (
              <p className="text-sm text-green-600 mt-2 font-medium">Upload complete! Refreshing library...</p>
            )}
          </div>
        )}

        {/* Search and Filters */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 p-4 sm:p-6 mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search images by filename or alt text..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 bg-white/50"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                title="Refresh images"
              >
                <RefreshCw className={`w-5 h-5 text-gray-600 ${isLoading ? "animate-spin" : ""}`} />
                <span className="text-sm font-medium text-gray-600">Refresh</span>
              </button>
              <span className="text-sm text-gray-600 whitespace-nowrap">
                {filteredImages.length} {filteredImages.length === 1 ? "image" : "images"}
              </span>
            </div>
          </div>
        </div>

        {/* Allowed File Types Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <h3 className="text-sm font-medium text-blue-800 mb-2">Allowed File Types:</h3>
          <div className="flex flex-wrap gap-2">
            {ALLOWED_FILE_TYPES.map((type) => (
              <span key={type} className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs">
                {type.replace("image/", "").toUpperCase()}
              </span>
            ))}
          </div>
          <p className="text-xs text-blue-600 mt-2">Maximum file size: 10MB per image</p>
        </div>

        {/* Images Grid */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 p-4 sm:p-6">
          {isLoading ? (
            <div className="p-12 text-center">
              <div className="relative mx-auto w-12 h-12 mb-4">
                <div className="absolute inset-0 rounded-full border-4 border-purple-200"></div>
                <div className="absolute inset-0 rounded-full border-4 border-purple-600 border-t-transparent animate-spin"></div>
              </div>
              <p className="text-gray-600 font-medium">Loading your images...</p>
            </div>
          ) : filteredImages.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-purple-100 to-blue-100 rounded-full flex items-center justify-center">
                <ImageIcon className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No images found</h3>
              <p className="text-gray-600 mb-6">
                {searchTerm ? "Try a different search term" : "Upload images to get started"}
              </p>
              {!searchTerm && (
                <button
                  onClick={handleFileSelect}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-300 cursor-pointer"
                >
                  <Upload className="w-5 h-5" />
                  <span>Upload Your First Image</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {filteredImages.map((image) => (
                <div
                  key={image.id}
                  className={`relative group rounded-xl overflow-hidden border-2 transition-all duration-200 ${
                    selectedImages.includes(image.id)
                      ? "border-purple-500 shadow-lg shadow-purple-500/20"
                      : "border-transparent hover:border-purple-300"
                  }`}
                >
                  <div className="aspect-square bg-gray-100 relative overflow-hidden">
                    <Image
                      src={image.url || "/placeholder.svg"}
                      alt={image.alt_text || image.filename}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      onError={(e) => {
                        // @ts-ignore
                        e.currentTarget.src = "https://placehold.co/400x400/f5f5f5/333333?text=Image+Not+Found"
                      }}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300"></div>

                    {/* Selection Checkbox */}
                    <button
                      onClick={() => toggleImageSelection(image.id)}
                      className={`absolute top-2 left-2 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
                        selectedImages.includes(image.id)
                          ? "bg-purple-600 text-white"
                          : "bg-white/80 text-gray-600 opacity-0 group-hover:opacity-100"
                      }`}
                    >
                      {selectedImages.includes(image.id) ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                    </button>

                    {/* Edit Button */}
                    <button
                      onClick={() => setEditingImage(image)}
                      className="absolute top-2 right-2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center hover:bg-white transition-all opacity-0 group-hover:opacity-100"
                      title="Edit image details"
                    >
                      <Edit2 className="w-4 h-4 text-gray-700" />
                    </button>
                  </div>

                  <div className="p-3 bg-white">
                    <p className="font-medium text-gray-900 truncate" title={image.filename}>
                      {image.filename}
                    </p>
                    <div className="flex items-center justify-between mt-1 text-xs text-gray-500">
                      <span>{formatFileSize(image.file_size)}</span>
                      <span>{formatDate(image.created_at)}</span>
                    </div>
                    {image.alt_text && (
                      <p className="text-xs text-gray-400 mt-1 truncate" title={image.alt_text}>
                        {image.alt_text}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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
  )
}
