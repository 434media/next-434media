"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  LinkIcon,
  ImageIcon,
  Video,
  Quote,
  Code,
  Minus,
  Undo,
  Redo,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Eye,
  EyeOff,
  Upload,
  Check,
} from "lucide-react"

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export default function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [showImageUpload, setShowImageUpload] = useState(false)
  const [showVideoEmbed, setShowVideoEmbed] = useState(false)
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [linkUrl, setLinkUrl] = useState("")
  const [linkText, setLinkText] = useState("")
  const [videoUrl, setVideoUrl] = useState("")
  const [selectedText, setSelectedText] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const savedRangeRef = useRef<Range | null>(null)

  // Initialize editor content
  useEffect(() => {
    if (editorRef.current && !isPreviewMode) {
      // Only update if content is different to avoid cursor jumping
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value || ""
      }
    }
  }, [value, isPreviewMode])

  // Handle content changes
  const handleContentChange = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML
      onChange(html)
    }
  }

  // Save current selection/range
  const saveSelection = () => {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      savedRangeRef.current = selection.getRangeAt(0).cloneRange()
    }
  }

  // Restore saved selection/range
  const restoreSelection = () => {
    if (savedRangeRef.current && editorRef.current) {
      editorRef.current.focus()
      const selection = window.getSelection()
      if (selection) {
        selection.removeAllRanges()
        selection.addRange(savedRangeRef.current)
      }
    }
  }

  // Execute formatting commands with proper focus
  const execCommand = (command: string, value?: string) => {
    if (editorRef.current) {
      editorRef.current.focus()
      document.execCommand(command, false, value)
      handleContentChange()
    }
  }

  // Handle text selection for links
  const handleTextSelection = () => {
    const selection = window.getSelection()
    if (selection && selection.toString()) {
      setSelectedText(selection.toString())
    }
  }

  // Insert HTML at saved cursor position
  const insertHTMLAtCursor = (html: string) => {
    if (savedRangeRef.current) {
      // Restore the selection first
      restoreSelection()

      // Use execCommand for better compatibility
      if (document.queryCommandSupported("insertHTML")) {
        document.execCommand("insertHTML", false, html)
      } else {
        // Fallback method
        const selection = window.getSelection()
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0)
          range.deleteContents()

          const div = document.createElement("div")
          div.innerHTML = html
          const fragment = document.createDocumentFragment()

          while (div.firstChild) {
            fragment.appendChild(div.firstChild)
          }

          range.insertNode(fragment)
          range.collapse(false)
          selection.removeAllRanges()
          selection.addRange(range)
        }
      }

      handleContentChange()
      savedRangeRef.current = null
    } else {
      // If no saved range, append to end
      if (editorRef.current) {
        editorRef.current.focus()
        const selection = window.getSelection()
        if (selection) {
          // Move cursor to end
          const range = document.createRange()
          range.selectNodeContents(editorRef.current)
          range.collapse(false)
          selection.removeAllRanges()
          selection.addRange(range)

          // Insert HTML
          if (document.queryCommandSupported("insertHTML")) {
            document.execCommand("insertHTML", false, html)
          } else {
            editorRef.current.innerHTML += html
          }

          handleContentChange()
        }
      }
    }
  }

  // Wrap selected text or insert new content
  const wrapOrInsert = (wrapStart: string, wrapEnd: string, defaultContent: string) => {
    if (editorRef.current) {
      editorRef.current.focus()

      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const selectedText = selection.toString()

        if (selectedText) {
          // Wrap the selected text
          const html = `${wrapStart}${selectedText}${wrapEnd}`
          document.execCommand("insertHTML", false, html)
        } else {
          // Insert default content
          const html = `${wrapStart}${defaultContent}${wrapEnd}`
          document.execCommand("insertHTML", false, html)
        }
      } else {
        // No selection, insert at end
        const html = `${wrapStart}${defaultContent}${wrapEnd}`
        editorRef.current.innerHTML += html
      }

      handleContentChange()
    }
  }

  // Handle quote insertion
  const handleQuote = () => {
    wrapOrInsert(
      '<blockquote class="border-l-4 border-purple-500 pl-4 italic text-gray-700 my-4">',
      "</blockquote>",
      "Quote text here",
    )
  }

  // Handle code block insertion
  const handleCodeBlock = () => {
    wrapOrInsert('<pre class="bg-gray-100 p-4 rounded-lg overflow-x-auto my-4"><code>', "</code></pre>", "Code here")
  }

  // Handle link insertion
  const handleInsertLink = () => {
    if (linkUrl) {
      const text = linkText || selectedText || linkUrl
      const html = `<a href="${linkUrl}" class="text-purple-600 hover:text-purple-800 underline transition-colors" target="_blank" rel="noopener noreferrer">${text}</a>`

      insertHTMLAtCursor(html)

      // Reset and close dialog
      setShowLinkDialog(false)
      setLinkUrl("")
      setLinkText("")
      setSelectedText("")
    }
  }

  // Handle video embed
  const handleInsertVideo = () => {
    if (videoUrl) {
      let embedHtml = ""

      // YouTube
      if (videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be")) {
        const videoId = videoUrl.includes("youtu.be")
          ? videoUrl.split("/").pop()?.split("?")[0]
          : videoUrl.split("v=")[1]?.split("&")[0]

        if (videoId) {
          embedHtml = `
            <div class="my-6 relative w-full aspect-video">
              <iframe 
                src="https://www.youtube.com/embed/${videoId}" 
                class="absolute inset-0 w-full h-full rounded-xl shadow-lg"
                frameborder="0" 
                allowfullscreen>
              </iframe>
            </div>
          `
        }
      }
      // Vimeo
      else if (videoUrl.includes("vimeo.com")) {
        const videoId = videoUrl.split("/").pop()
        if (videoId) {
          embedHtml = `
            <div class="my-6 relative w-full aspect-video">
              <iframe 
                src="https://player.vimeo.com/video/${videoId}" 
                class="absolute inset-0 w-full h-full rounded-xl shadow-lg"
                frameborder="0" 
                allowfullscreen>
              </iframe>
            </div>
          `
        }
      }
      // Direct video URL
      else {
        embedHtml = `
          <div class="my-6">
            <video controls class="w-full rounded-xl shadow-lg">
              <source src="${videoUrl}" type="video/mp4">
              Your browser does not support the video tag.
            </video>
          </div>
        `
      }

      if (embedHtml) {
        insertHTMLAtCursor(embedHtml)
        setShowVideoEmbed(false)
        setVideoUrl("")
      }
    }
  }

  // Handle image upload
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    const file = files[0]
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file")
      return
    }

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append("images", file)
      formData.append("isInEditor", "true")
      formData.append("context", "editor")

      const response = await fetch("/api/blog/upload-image", {
        method: "POST",
        body: formData,
      })

      const result = await response.json()

      if (result.success && result.images && result.images.length > 0) {
        const image = result.images[0]
        const imageHtml = `
          <div class="my-6">
            <img 
              src="/api/blog/images/${image.id}" 
              alt="${image.alt_text || "Uploaded image"}" 
              class="w-full rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300"
              style="max-width: 100%; height: auto;"
            />
            ${image.alt_text ? `<p class="text-center text-gray-600 text-sm mt-2 italic">${image.alt_text}</p>` : ""}
          </div>
        `
        insertHTMLAtCursor(imageHtml)
        setShowImageUpload(false)
      } else {
        alert(`Failed to upload image: ${result.error || "Unknown error"}`)
      }
    } catch (error) {
      console.error("Error uploading image:", error)
      alert("Failed to upload image. Please try again.")
    } finally {
      setIsUploading(false)
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  // Handle paste events to clean up content
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const text = e.clipboardData.getData("text/plain")
    document.execCommand("insertText", false, text)
  }

  // Open link dialog and save selection
  const openLinkDialog = () => {
    handleTextSelection()
    saveSelection()
    setShowLinkDialog(true)
  }

  // Open image upload and save selection
  const openImageUpload = () => {
    saveSelection()
    setShowImageUpload(true)
  }

  // Open video embed and save selection
  const openVideoEmbed = () => {
    saveSelection()
    setShowVideoEmbed(true)
  }

  // Toolbar button component
  const ToolbarButton = ({
    onClick,
    icon: Icon,
    title,
    isActive = false,
    variant = "default",
    className: buttonClassName = "",
  }: {
    onClick: () => void
    icon: any
    title: string
    isActive?: boolean
    variant?: "default" | "primary" | "success" | "warning"
    className?: string
  }) => {
    const baseClasses = "p-2 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
    const variantClasses = {
      default: isActive
        ? "bg-purple-100 text-purple-700 shadow-md"
        : "bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-800 shadow-sm",
      primary:
        "bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 shadow-lg",
      success:
        "bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 shadow-lg",
      warning:
        "bg-gradient-to-r from-orange-600 to-red-600 text-white hover:from-orange-700 hover:to-red-700 shadow-lg",
    }

    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        className={`${baseClasses} ${variantClasses[variant]} ${buttonClassName}`}
      >
        <Icon className="w-4 h-4" />
      </button>
    )
  }

  return (
    <div
      className={`bg-white rounded-2xl shadow-xl border border-white/20 backdrop-blur-sm overflow-hidden ${className}`}
    >
      {/* Toolbar */}
      <div className="border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* Text Formatting */}
          <div className="flex items-center gap-1 bg-white rounded-xl p-1 shadow-sm">
            <ToolbarButton
              onClick={() => execCommand("bold")}
              icon={Bold}
              title="Bold (Ctrl+B)"
              isActive={document.queryCommandState("bold")}
            />
            <ToolbarButton
              onClick={() => execCommand("italic")}
              icon={Italic}
              title="Italic (Ctrl+I)"
              isActive={document.queryCommandState("italic")}
            />
            <ToolbarButton
              onClick={() => execCommand("underline")}
              icon={Underline}
              title="Underline (Ctrl+U)"
              isActive={document.queryCommandState("underline")}
            />
            <ToolbarButton
              onClick={() => execCommand("strikeThrough")}
              icon={Strikethrough}
              title="Strikethrough"
              isActive={document.queryCommandState("strikeThrough")}
            />
          </div>

          {/* Alignment */}
          <div className="flex items-center gap-1 bg-white rounded-xl p-1 shadow-sm">
            <ToolbarButton
              onClick={() => execCommand("justifyLeft")}
              icon={AlignLeft}
              title="Align Left"
              isActive={document.queryCommandState("justifyLeft")}
            />
            <ToolbarButton
              onClick={() => execCommand("justifyCenter")}
              icon={AlignCenter}
              title="Align Center"
              isActive={document.queryCommandState("justifyCenter")}
            />
            <ToolbarButton
              onClick={() => execCommand("justifyRight")}
              icon={AlignRight}
              title="Align Right"
              isActive={document.queryCommandState("justifyRight")}
            />
          </div>

          {/* Insert Elements */}
          <div className="flex items-center gap-1 bg-white rounded-xl p-1 shadow-sm">
            <ToolbarButton onClick={openLinkDialog} icon={LinkIcon} title="Insert Link" variant="primary" />
            <ToolbarButton onClick={openImageUpload} icon={ImageIcon} title="Insert Image" variant="primary" />
            <ToolbarButton onClick={openVideoEmbed} icon={Video} title="Embed Video" variant="primary" />
          </div>

          {/* Special Elements */}
          <div className="flex items-center gap-1 bg-white rounded-xl p-1 shadow-sm">
            <ToolbarButton onClick={handleQuote} icon={Quote} title="Insert Quote (wraps selected text)" />
            <ToolbarButton onClick={handleCodeBlock} icon={Code} title="Insert Code Block (wraps selected text)" />
            <ToolbarButton
              onClick={() => {
                saveSelection()
                insertHTMLAtCursor('<hr class="my-8 border-t-2 border-gray-200" />')
              }}
              icon={Minus}
              title="Insert Divider"
            />
          </div>

          {/* Undo/Redo */}
          <div className="flex items-center gap-1 bg-white rounded-xl p-1 shadow-sm">
            <ToolbarButton onClick={() => execCommand("undo")} icon={Undo} title="Undo (Ctrl+Z)" />
            <ToolbarButton onClick={() => execCommand("redo")} icon={Redo} title="Redo (Ctrl+Y)" />
          </div>

          {/* Preview Toggle */}
          <div className="ml-auto">
            <ToolbarButton
              onClick={() => setIsPreviewMode(!isPreviewMode)}
              icon={isPreviewMode ? EyeOff : Eye}
              title={isPreviewMode ? "Edit Mode" : "Preview Mode"}
              variant={isPreviewMode ? "warning" : "success"}
            />
          </div>
        </div>
      </div>

      {/* Editor Content */}
      <div className="relative">
        {isPreviewMode ? (
          <div className="p-6 min-h-[400px] prose prose-lg max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-purple-600">
            <div dangerouslySetInnerHTML={{ __html: value }} />
          </div>
        ) : (
          <div
            ref={editorRef}
            contentEditable
            onInput={handleContentChange}
            onPaste={handlePaste}
            onMouseUp={handleTextSelection}
            onKeyUp={handleTextSelection}
            className="p-6 min-h-[400px] focus:outline-none text-left"
            style={{
              direction: "ltr",
              textAlign: "left",
              unicodeBidi: "normal",
              whiteSpace: "pre-wrap",
              wordWrap: "break-word",
              overflowWrap: "break-word",
            }}
            data-placeholder={placeholder}
            suppressContentEditableWarning={true}
          />
        )}

        {/* Placeholder */}
        {!isPreviewMode && !value && (
          <div className="absolute top-6 left-6 text-gray-400 pointer-events-none select-none">
            {placeholder || "Start writing your amazing content..."}
          </div>
        )}
      </div>

      {/* Usage Instructions */}
      <div className="border-t border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
        <p>
          <strong>💡 Tips:</strong> Use Bold, Italic, Underline for text styling • Select text and click Quote/Code to
          wrap it • Use Preview to see how your content will look
        </p>
      </div>

      {/* Link Dialog */}
      {showLinkDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <div className="flex items-center gap-2 mb-4">
              <LinkIcon className="w-5 h-5 text-purple-600" />
              <h3 className="text-lg font-semibold">Insert Link</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Link Text</label>
                <input
                  type="text"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  placeholder={selectedText || "Link text"}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleInsertLink}
                disabled={!linkUrl}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <Check className="w-4 h-4" />
                Insert Link
              </button>
              <button
                onClick={() => setShowLinkDialog(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Embed Dialog */}
      {showVideoEmbed && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <div className="flex items-center gap-2 mb-4">
              <Video className="w-5 h-5 text-purple-600" />
              <h3 className="text-lg font-semibold">Embed Video</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Video URL</label>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="YouTube, Vimeo, or direct video URL"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">Supports YouTube, Vimeo, and direct video links</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleInsertVideo}
                disabled={!videoUrl}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <Check className="w-4 h-4" />
                Embed Video
              </button>
              <button
                onClick={() => setShowVideoEmbed(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Upload Dialog */}
      {showImageUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <div className="flex items-center gap-2 mb-4">
              <ImageIcon className="w-5 h-5 text-purple-600" />
              <h3 className="text-lg font-semibold">Upload Image</h3>
            </div>
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-purple-400 transition-colors">
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600 mb-4">
                  {isUploading ? "Uploading..." : "Click to upload an image"}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={isUploading}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? "Uploading..." : "Choose File"}
                </button>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowImageUpload(false)}
                disabled={isUploading}
                className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
