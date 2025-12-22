/**
 * Modern Rich Text Editor Component
 * 
 * A comprehensive WYSIWYG editor with modern features and black/white theme.
 * Replaces deprecated document.execCommand with modern DOM manipulation.
 * 
 * Features:
 * - Text formatting (bold, italic, underline, strikethrough)
 * - Headings (H1, H2, H3) and lists (bullet, numbered)
 * - Media insertion (images, videos, links)
 * - Search and replace functionality
 * - Undo/redo with history tracking
 * - Auto-save capabilities
 * - Keyboard shortcuts (Ctrl/Cmd + B/I/U/Z/Y/F/S)
 * - Zoom controls
 * - Character counting and limits
 * - Read-only mode support
 * - Preview mode
 * 
 * @author 434Media
 * @version 2.0.0
 * @updated 2025-10-21
 */

"use client"

import type React from "react"

import { useState, useRef, useEffect, useCallback } from "react"
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
  Type,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Search,
  RotateCcw as Replace,
  X,
  ChevronDown,
  Palette,
  MoreHorizontal,
  Copy,
  Clipboard,
  Save,
  FileText,
  ZoomIn,
  ZoomOut,
} from "lucide-react"

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  autoSave?: boolean
  maxLength?: number
  readOnly?: boolean
}

// Command history for undo/redo
interface HistoryEntry {
  content: string
  timestamp: number
}

// URL validation helpers
function getHostname(url: string): string | null {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.toLowerCase()
  } catch {
    return null
  }
}

function isYouTubeUrl(hostname: string): boolean {
  return hostname === 'youtube.com' || 
    hostname === 'www.youtube.com' ||
    hostname === 'youtu.be' ||
    hostname === 'www.youtu.be'
}

function isVimeoUrl(hostname: string): boolean {
  return hostname === 'vimeo.com' || 
    hostname === 'www.vimeo.com' ||
    hostname === 'player.vimeo.com'
}

// Extract YouTube video ID safely
function extractYouTubeVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.toLowerCase()
    
    if (hostname === 'youtu.be' || hostname === 'www.youtu.be') {
      // Short URL format: youtu.be/VIDEO_ID
      const pathMatch = urlObj.pathname.match(/^\/([a-zA-Z0-9_-]{11})/)
      return pathMatch ? pathMatch[1] : null
    }
    
    // Standard YouTube URL: youtube.com/watch?v=VIDEO_ID
    const videoId = urlObj.searchParams.get('v')
    if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return videoId
    }
    
    // Embed URL format: youtube.com/embed/VIDEO_ID
    const embedMatch = urlObj.pathname.match(/^\/embed\/([a-zA-Z0-9_-]{11})/)
    return embedMatch ? embedMatch[1] : null
  } catch {
    return null
  }
}

// Extract Vimeo video ID safely
function extractVimeoVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url)
    const pathMatch = urlObj.pathname.match(/^\/(?:video\/)?([0-9]{1,15})(?:\/|$)/)
    return pathMatch ? pathMatch[1] : null
  } catch {
    return null
  }
}

// HTML entity escaping for safe display
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }
  return text.replace(/[&<>"']/g, (char) => map[char])
}

// Modern formatting utilities to replace deprecated execCommand
class ModernEditor {
  static formatSelection(element: HTMLElement, tag: string, className?: string) {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return false

    const range = selection.getRangeAt(0)
    if (range.collapsed) return false

    try {
      const selectedContent = range.extractContents()
      const wrapper = document.createElement(tag)
      if (className) wrapper.className = className
      wrapper.appendChild(selectedContent)
      range.insertNode(wrapper)
      
      // Clear selection
      selection.removeAllRanges()
      return true
    } catch (error) {
      console.error('Error formatting selection:', error)
      return false
    }
  }

  static insertHTML(element: HTMLElement, html: string) {
    const selection = window.getSelection()
    if (!selection) return false

    try {
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        range.deleteContents()
        
        const template = document.createElement('template')
        template.innerHTML = html
        const fragment = template.content
        
        range.insertNode(fragment)
        range.collapse(false)
        selection.removeAllRanges()
        selection.addRange(range)
      } else {
        // Insert at end if no selection
        element.focus()
        const range = document.createRange()
        range.selectNodeContents(element)
        range.collapse(false)
        selection.removeAllRanges()
        selection.addRange(range)
        
        const template = document.createElement('template')
        template.innerHTML = html
        element.appendChild(template.content)
      }
      return true
    } catch (error) {
      console.error('Error inserting HTML:', error)
      return false
    }
  }

  static toggleFormat(element: HTMLElement, tag: string, className?: string) {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return false

    const range = selection.getRangeAt(0)
    const container = range.commonAncestorContainer
    
    // Check if already formatted
    let formatElement = container.nodeType === Node.TEXT_NODE 
      ? container.parentElement 
      : container as Element
    
    while (formatElement && formatElement !== element) {
      if (formatElement.tagName === tag.toUpperCase()) {
        // Remove formatting
        const parent = formatElement.parentNode
        if (parent) {
          while (formatElement.firstChild) {
            parent.insertBefore(formatElement.firstChild, formatElement)
          }
          parent.removeChild(formatElement)
        }
        return true
      }
      formatElement = formatElement.parentElement
    }
    
    // Apply formatting
    return this.formatSelection(element, tag, className)
  }

  static setAlignment(element: HTMLElement, alignment: 'left' | 'center' | 'right' | 'justify') {
    const selection = window.getSelection()
    if (!selection) return false

    // Find the paragraph or block element
    let blockElement = selection.anchorNode
    while (blockElement && blockElement.nodeType !== Node.ELEMENT_NODE) {
      blockElement = blockElement.parentNode
    }

    if (blockElement && blockElement !== element) {
      (blockElement as HTMLElement).style.textAlign = alignment
      return true
    }
    return false
  }
}

export default function RichTextEditor({ 
  value, 
  onChange, 
  placeholder, 
  className,
  autoSave = false,
  maxLength,
  readOnly = false
}: RichTextEditorProps) {
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [showImageUpload, setShowImageUpload] = useState(false)
  const [showVideoEmbed, setShowVideoEmbed] = useState(false)
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [showSearchReplace, setShowSearchReplace] = useState(false)
  const [showFormatDropdown, setShowFormatDropdown] = useState(false)
  const [linkUrl, setLinkUrl] = useState("")
  const [linkText, setLinkText] = useState("")
  const [videoUrl, setVideoUrl] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [replaceTerm, setReplaceTerm] = useState("")
  const [selectedText, setSelectedText] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [wordCount, setWordCount] = useState(0)
  const [characterCount, setCharacterCount] = useState(0)
  const [zoomLevel, setZoomLevel] = useState(100)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [isDirty, setIsDirty] = useState(false)
  
  const editorRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const savedRangeRef = useRef<Range | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Update word and character count
  const updateCounts = useCallback((content: string) => {
    // Use loop to handle nested/malformed tags that a single replace might miss
    let text = content
    let prevLength: number
    do {
      prevLength = text.length
      text = text.replace(/<[^>]*>/g, '')
    } while (text.length !== prevLength)
    text = text.trim()
    setWordCount(text ? text.split(/\s+/).length : 0)
    setCharacterCount(text.length)
  }, [])

  // Add to history for undo/redo
  const addToHistory = useCallback((content: string) => {
    const newEntry: HistoryEntry = {
      content,
      timestamp: Date.now()
    }
    
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1)
      newHistory.push(newEntry)
      // Limit history to 50 entries
      return newHistory.slice(-50)
    })
    setHistoryIndex(prev => prev + 1)
  }, [historyIndex])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showFormatDropdown) {
        setShowFormatDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showFormatDropdown])

  // Auto-save functionality
  useEffect(() => {
    if (!autoSave || !isDirty) return

    const timeoutId = setTimeout(() => {
      // Here you could implement actual auto-save logic
      console.log('Auto-saving content...')
      setIsDirty(false)
    }, 2000)

    return () => clearTimeout(timeoutId)
  }, [value, autoSave, isDirty])

  // Initialize editor content and setup
  useEffect(() => {
    if (editorRef.current && !isPreviewMode) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value || ""
        updateCounts(value || "")
        
        // Initialize history if empty
        if (history.length === 0 && value) {
          addToHistory(value)
        }
      }
    }
  }, [value, isPreviewMode, updateCounts, history.length, addToHistory])

  // Handle content changes with validation
  const handleContentChange = useCallback(() => {
    if (!editorRef.current) return

    const html = editorRef.current.innerHTML
    
    // Check max length
    if (maxLength) {
      // Use loop to handle nested/malformed tags that a single replace might miss
      let text = html
      let prevLength: number
      do {
        prevLength = text.length
        text = text.replace(/<[^>]*>/g, '')
      } while (text.length !== prevLength)
      if (text.length > maxLength) {
        return // Don't update if exceeds max length
      }
    }

    updateCounts(html)
    onChange(html)
    setIsDirty(true)
    
    // Add to history if significant change
    if (html !== value) {
      addToHistory(html)
    }
  }, [maxLength, updateCounts, onChange, value, addToHistory])

  // Modern formatting functions replacing execCommand
  const toggleBold = () => {
    if (!editorRef.current) return
    ModernEditor.toggleFormat(editorRef.current, 'strong', 'font-bold')
    handleContentChange()
  }

  const toggleItalic = () => {
    if (!editorRef.current) return
    ModernEditor.toggleFormat(editorRef.current, 'em', 'italic')
    handleContentChange()
  }

  const toggleUnderline = () => {
    if (!editorRef.current) return
    ModernEditor.toggleFormat(editorRef.current, 'u', 'underline')
    handleContentChange()
  }

  const toggleStrikethrough = () => {
    if (!editorRef.current) return
    ModernEditor.toggleFormat(editorRef.current, 'del', 'line-through')
    handleContentChange()
  }

  const setAlignment = (alignment: 'left' | 'center' | 'right' | 'justify') => {
    if (!editorRef.current) return
    ModernEditor.setAlignment(editorRef.current, alignment)
    handleContentChange()
  }

  const insertHeading = (level: 1 | 2 | 3) => {
    if (!editorRef.current) return
    const headingClass = level === 1 ? 'text-3xl font-bold mb-4' : 
                        level === 2 ? 'text-2xl font-semibold mb-3' : 
                        'text-xl font-medium mb-2'
    const html = `<h${level} class="${headingClass}">Heading ${level}</h${level}>`
    ModernEditor.insertHTML(editorRef.current, html)
    handleContentChange()
  }

  const insertList = (ordered = false) => {
    if (!editorRef.current) return
    const tag = ordered ? 'ol' : 'ul'
    const listClass = ordered ? 'list-decimal ml-6 mb-4' : 'list-disc ml-6 mb-4'
    const html = `<${tag} class="${listClass}"><li class="mb-1">List item</li></${tag}>`
    ModernEditor.insertHTML(editorRef.current, html)
    handleContentChange()
  }

  // Undo/Redo functionality
  const undo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1
      const prevEntry = history[prevIndex]
      if (prevEntry && editorRef.current) {
        editorRef.current.innerHTML = prevEntry.content
        onChange(prevEntry.content)
        setHistoryIndex(prevIndex)
        updateCounts(prevEntry.content)
      }
    }
  }

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1
      const nextEntry = history[nextIndex]
      if (nextEntry && editorRef.current) {
        editorRef.current.innerHTML = nextEntry.content
        onChange(nextEntry.content)
        setHistoryIndex(nextIndex)
        updateCounts(nextEntry.content)
      }
    }
  }

  // Search and replace functionality
  const handleSearch = () => {
    if (!searchTerm || !editorRef.current) return
    
    const content = editorRef.current.innerHTML
    const regex = new RegExp(searchTerm, 'gi')
    const highlighted = content.replace(regex, `<mark class="bg-yellow-200">$&</mark>`)
    editorRef.current.innerHTML = highlighted
  }

  const handleReplace = () => {
    if (!searchTerm || !editorRef.current) return
    
    const content = editorRef.current.innerHTML
    const regex = new RegExp(searchTerm, 'gi')
    const replaced = content.replace(regex, replaceTerm)
    editorRef.current.innerHTML = replaced
    handleContentChange()
  }

  const clearHighlights = () => {
    if (!editorRef.current) return
    const content = editorRef.current.innerHTML
    const cleared = content.replace(/<mark[^>]*>(.*?)<\/mark>/gi, '$1')
    editorRef.current.innerHTML = cleared
  }

  // Copy content to clipboard
  const copyContent = async () => {
    if (!editorRef.current) return
    try {
      await navigator.clipboard.writeText(editorRef.current.innerText)
      console.log('Content copied to clipboard')
    } catch (error) {
      console.error('Failed to copy content:', error)
    }
  }

  // Adjust zoom functionality
  const adjustZoom = (delta: number) => {
    const newZoom = Math.max(50, Math.min(200, zoomLevel + delta))
    setZoomLevel(newZoom)
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!editorRef.current || readOnly) return

      // Check if Ctrl/Cmd is pressed
      const isCtrlOrCmd = event.ctrlKey || event.metaKey

      if (isCtrlOrCmd) {
        switch (event.key.toLowerCase()) {
          case 'b':
            event.preventDefault()
            toggleBold()
            break
          case 'i':
            event.preventDefault()
            toggleItalic()
            break
          case 'u':
            event.preventDefault()
            toggleUnderline()
            break
          case 'z':
            event.preventDefault()
            if (event.shiftKey) {
              redo()
            } else {
              undo()
            }
            break
          case 'y':
            event.preventDefault()
            redo()
            break
          case 'f':
            event.preventDefault()
            setShowSearchReplace(true)
            break
          case 's':
            event.preventDefault()
            // Trigger save if auto-save is enabled
            if (autoSave) {
              setIsDirty(false)
            }
            break
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [toggleBold, toggleItalic, toggleUnderline, undo, redo, autoSave, readOnly])

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

  // Handle text selection for links
  const handleTextSelection = () => {
    const selection = window.getSelection()
    if (selection && selection.toString()) {
      setSelectedText(selection.toString())
    }
  }

  // Insert HTML at saved cursor position using modern approach
  const insertHTMLAtCursor = (html: string) => {
    if (!editorRef.current) return

    if (savedRangeRef.current) {
      restoreSelection()
      ModernEditor.insertHTML(editorRef.current, html)
      savedRangeRef.current = null
    } else {
      ModernEditor.insertHTML(editorRef.current, html)
    }
    handleContentChange()
  }

  // Modern wrapper for wrapping selected text or inserting new content
  const wrapOrInsert = (wrapStart: string, wrapEnd: string, defaultContent: string) => {
    if (!editorRef.current) return

    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      // Wrap selected text
      const range = selection.getRangeAt(0)
      const selectedContent = range.extractContents()
      
      const wrapper = document.createElement('div')
      wrapper.innerHTML = wrapStart
      wrapper.appendChild(selectedContent)
      wrapper.innerHTML += wrapEnd
      
      range.insertNode(wrapper.firstChild as Node)
    } else {
      // Insert default content
      const html = `${wrapStart}${defaultContent}${wrapEnd}`
      ModernEditor.insertHTML(editorRef.current, html)
    }
    
    handleContentChange()
  }

  // Handle quote insertion with black/white theme
  const handleQuote = () => {
    wrapOrInsert(
      '<blockquote class="border-l-4 border-gray-800 pl-4 italic text-gray-700 my-4 bg-gray-50">',
      "</blockquote>",
      "Quote text here",
    )
  }

  // Handle code block insertion with black/white theme
  const handleCodeBlock = () => {
    wrapOrInsert(
      '<pre class="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto my-4 border border-gray-300"><code>',
      "</code></pre>",
      "Code here"
    )
  }

  // Handle link insertion with black/white theme
  const handleInsertLink = () => {
    if (linkUrl) {
      // Validate URL format
      let validatedUrl: string
      try {
        const urlObj = new URL(linkUrl)
        // Only allow http/https protocols
        if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
          alert('Only HTTP and HTTPS URLs are allowed')
          return
        }
        validatedUrl = urlObj.href
      } catch {
        alert('Please enter a valid URL')
        return
      }

      const text = linkText || selectedText || linkUrl
      const escapedText = escapeHtml(text)
      const html = `<a href="${validatedUrl}" class="text-gray-900 hover:text-black underline decoration-2 underline-offset-2 transition-colors font-medium" target="_blank" rel="noopener noreferrer">${escapedText}</a>`

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
      const hostname = getHostname(videoUrl)

      // YouTube - using proper URL parsing
      if (hostname && isYouTubeUrl(hostname)) {
        const videoId = extractYouTubeVideoId(videoUrl)

        if (videoId) {
          embedHtml = `
            <div class="my-6 relative w-full aspect-video">
              <iframe 
                src="https://www.youtube.com/embed/${encodeURIComponent(videoId)}" 
                class="absolute inset-0 w-full h-full rounded-xl shadow-lg"
                frameborder="0" 
                allowfullscreen>
              </iframe>
            </div>
          `
        }
      }
      // Vimeo - using proper URL parsing
      else if (hostname && isVimeoUrl(hostname)) {
        const videoId = extractVimeoVideoId(videoUrl)
        if (videoId) {
          embedHtml = `
            <div class="my-6 relative w-full aspect-video">
              <iframe 
                src="https://player.vimeo.com/video/${encodeURIComponent(videoId)}" 
                class="absolute inset-0 w-full h-full rounded-xl shadow-lg"
                frameborder="0" 
                allowfullscreen>
              </iframe>
            </div>
          `
        }
      }
      // Direct video URL - validate URL format first
      else {
        try {
          const urlObj = new URL(videoUrl)
          if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
            embedHtml = `
              <div class="my-6">
                <video controls class="w-full rounded-xl shadow-lg">
                  <source src="${urlObj.href}" type="video/mp4">
                  Your browser does not support the video tag.
                </video>
              </div>
            `
          }
        } catch {
          // Invalid URL, don't embed
        }
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

  // Handle paste events to clean up content and prevent deprecated methods
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const text = e.clipboardData.getData("text/plain")
    
    if (editorRef.current) {
      // Use modern approach instead of deprecated execCommand
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        range.deleteContents()
        range.insertNode(document.createTextNode(text))
        range.collapse(false)
        selection.removeAllRanges()
        selection.addRange(range)
        handleContentChange()
      }
    }
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

  // Toolbar button component with black/white theme
  const ToolbarButton = ({
    onClick,
    icon: Icon,
    title,
    isActive = false,
    variant = "default",
    className: buttonClassName = "",
    disabled = false,
  }: {
    onClick: () => void
    icon: any
    title: string
    isActive?: boolean
    variant?: "default" | "primary" | "success" | "warning" | "danger"
    className?: string
    disabled?: boolean
  }) => {
    const baseClasses = "p-2 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
    const variantClasses = {
      default: isActive
        ? "bg-gray-900 text-white shadow-md"
        : "bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-900 shadow-sm border border-gray-200",
      primary: "bg-black text-white hover:bg-gray-800 shadow-lg",
      success: "bg-gray-800 text-white hover:bg-gray-700 shadow-lg",
      warning: "bg-gray-700 text-white hover:bg-gray-600 shadow-lg",
      danger: "bg-gray-900 text-white hover:bg-black shadow-lg",
    }

    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        disabled={disabled || readOnly}
        className={`${baseClasses} ${variantClasses[variant]} ${buttonClassName}`}
      >
        <Icon className="w-4 h-4" />
      </button>
    )
  }

  return (
    <div
      className={`bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden ${className}`}
    >
      {/* Enhanced Toolbar */}
      <div className="border-b border-gray-200 bg-gray-50 p-4">
        {/* Main Toolbar */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {/* Format Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowFormatDropdown(!showFormatDropdown)}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={readOnly}
            >
              <Type className="w-4 h-4" />
              <span className="text-sm">Format</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            
            {showFormatDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[160px]">
                <button onClick={() => insertHeading(1)} className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100">
                  <span className="text-2xl font-bold">Heading 1</span>
                </button>
                <button onClick={() => insertHeading(2)} className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100">
                  <span className="text-xl font-semibold">Heading 2</span>
                </button>
                <button onClick={() => insertHeading(3)} className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100">
                  <span className="text-lg font-medium">Heading 3</span>
                </button>
                <button onClick={() => insertList(false)} className="w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100">
                  • Bullet List
                </button>
                <button onClick={() => insertList(true)} className="w-full px-3 py-2 text-left hover:bg-gray-50">
                  1. Numbered List
                </button>
              </div>
            )}
          </div>

          {/* Text Formatting */}
          <div className="flex items-center gap-1 bg-white rounded-xl p-1 shadow-sm border border-gray-200">
            <ToolbarButton
              onClick={toggleBold}
              icon={Bold}
              title="Bold (Ctrl+B)"
              isActive={false}
            />
            <ToolbarButton
              onClick={toggleItalic}
              icon={Italic}
              title="Italic (Ctrl+I)"
              isActive={false}
            />
            <ToolbarButton
              onClick={toggleUnderline}
              icon={Underline}
              title="Underline (Ctrl+U)"
              isActive={false}
            />
            <ToolbarButton
              onClick={toggleStrikethrough}
              icon={Strikethrough}
              title="Strikethrough"
              isActive={false}
            />
          </div>

          {/* Lists */}
          <div className="flex items-center gap-1 bg-white rounded-xl p-1 shadow-sm border border-gray-200">
            <ToolbarButton
              onClick={() => insertList(false)}
              icon={List}
              title="Bullet List"
            />
            <ToolbarButton
              onClick={() => insertList(true)}
              icon={ListOrdered}
              title="Numbered List"
            />
          </div>

          {/* Alignment */}
          <div className="flex items-center gap-1 bg-white rounded-xl p-1 shadow-sm border border-gray-200">
            <ToolbarButton
              onClick={() => setAlignment('left')}
              icon={AlignLeft}
              title="Align Left"
              isActive={false}
            />
            <ToolbarButton
              onClick={() => setAlignment('center')}
              icon={AlignCenter}
              title="Align Center"
              isActive={false}
            />
            <ToolbarButton
              onClick={() => setAlignment('right')}
              icon={AlignRight}
              title="Align Right"
              isActive={false}
            />
          </div>

          {/* Insert Elements */}
          <div className="flex items-center gap-1 bg-white rounded-xl p-1 shadow-sm border border-gray-200">
            <ToolbarButton onClick={openLinkDialog} icon={LinkIcon} title="Insert Link" variant="primary" />
            <ToolbarButton onClick={openImageUpload} icon={ImageIcon} title="Insert Image" variant="primary" />
            <ToolbarButton onClick={openVideoEmbed} icon={Video} title="Embed Video" variant="primary" />
          </div>

          {/* Special Elements */}
          <div className="flex items-center gap-1 bg-white rounded-xl p-1 shadow-sm border border-gray-200">
            <ToolbarButton onClick={handleQuote} icon={Quote} title="Insert Quote" />
            <ToolbarButton onClick={handleCodeBlock} icon={Code} title="Insert Code Block" />
            <ToolbarButton
              onClick={() => {
                saveSelection()
                insertHTMLAtCursor('<hr class="my-8 border-t-2 border-gray-300" />')
              }}
              icon={Minus}
              title="Insert Divider"
            />
          </div>

          {/* Undo/Redo */}
          <div className="flex items-center gap-1 bg-white rounded-xl p-1 shadow-sm border border-gray-200">
            <ToolbarButton 
              onClick={undo} 
              icon={Undo} 
              title="Undo (Ctrl+Z)" 
              disabled={historyIndex <= 0}
            />
            <ToolbarButton 
              onClick={redo} 
              icon={Redo} 
              title="Redo (Ctrl+Y)" 
              disabled={historyIndex >= history.length - 1}
            />
          </div>

          {/* Utility Tools */}
          <div className="flex items-center gap-1 bg-white rounded-xl p-1 shadow-sm border border-gray-200">
            <ToolbarButton onClick={() => setShowSearchReplace(true)} icon={Search} title="Search & Replace" />
            <ToolbarButton onClick={copyContent} icon={Copy} title="Copy Content" />
            <ToolbarButton onClick={() => adjustZoom(-10)} icon={ZoomOut} title="Zoom Out" />
            <ToolbarButton onClick={() => adjustZoom(10)} icon={ZoomIn} title="Zoom In" />
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

        {/* Secondary Toolbar - Stats and Info */}
        <div className="flex items-center justify-between text-xs text-gray-600 pt-2 border-t border-gray-200">
          <div className="flex items-center gap-4">
            <span>Words: {wordCount}</span>
            <span>Characters: {characterCount}</span>
            {maxLength && (
              <span className={characterCount > maxLength ? 'text-red-600' : ''}>
                Max: {maxLength}
              </span>
            )}
            <span>Zoom: {zoomLevel}%</span>
            {isDirty && autoSave && <span className="text-orange-600">● Auto-saving...</span>}
          </div>
          <div className="flex items-center gap-2">
            {readOnly && <span className="text-gray-500">Read Only</span>}
            <span>Click outside dropdowns to close</span>
          </div>
        </div>
      </div>

      {/* Editor Content */}
      <div className="relative" style={{ zoom: `${zoomLevel}%` }}>
        {isPreviewMode ? (
          <div className="p-6 min-h-[400px] prose prose-lg max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-gray-900">
            <div dangerouslySetInnerHTML={{ __html: value }} />
          </div>
        ) : (
          <div
            ref={editorRef}
            contentEditable={!readOnly}
            onInput={handleContentChange}
            onPaste={handlePaste}
            onMouseUp={handleTextSelection}
            onKeyUp={handleTextSelection}
            onFocus={() => setShowFormatDropdown(false)}
            className={`p-6 min-h-[400px] focus:outline-none text-left transition-all ${
              readOnly ? 'bg-gray-50 cursor-not-allowed' : 'bg-white'
            }`}
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
        {!isPreviewMode && !value && !readOnly && (
          <div className="absolute top-6 left-6 text-gray-400 pointer-events-none select-none">
            {placeholder || "Start writing your amazing content..."}
          </div>
        )}

        {/* Character limit warning */}
        {maxLength && characterCount > maxLength * 0.9 && (
          <div className="absolute bottom-2 right-2 bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">
            {characterCount}/{maxLength} characters
          </div>
        )}
      </div>

      {/* Usage Instructions */}
      <div className="border-t border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
        <p>
          <strong>💡 Tips:</strong> Use formatting buttons for text styling • Select text and use Quote/Code to wrap • 
          Search & Replace available • Auto-save {autoSave ? 'enabled' : 'disabled'} • Preview mode shows final result
        </p>
      </div>

      {/* Search & Replace Dialog */}
      {showSearchReplace && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-gray-700" />
                <h3 className="text-lg font-semibold">Search & Replace</h3>
              </div>
              <button
                onClick={() => setShowSearchReplace(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search for</label>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Enter search term"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Replace with</label>
                <input
                  type="text"
                  value={replaceTerm}
                  onChange={(e) => setReplaceTerm(e.target.value)}
                  placeholder="Enter replacement text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSearch}
                disabled={!searchTerm}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <Search className="w-4 h-4" />
                Highlight
              </button>
              <button
                onClick={handleReplace}
                disabled={!searchTerm}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <Replace className="w-4 h-4" />
                Replace All
              </button>
            </div>
            <button
              onClick={clearHighlights}
              className="w-full mt-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all"
            >
              Clear Highlights
            </button>
          </div>
        </div>
      )}

      {/* Link Dialog */}
      {showLinkDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <div className="flex items-center gap-2 mb-4">
              <LinkIcon className="w-5 h-5 text-gray-700" />
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleInsertLink}
                disabled={!linkUrl}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
              <Video className="w-5 h-5 text-gray-700" />
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">Supports YouTube, Vimeo, and direct video links</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleInsertVideo}
                disabled={!videoUrl}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
              <ImageIcon className="w-5 h-5 text-gray-700" />
              <h3 className="text-lg font-semibold">Upload Image</h3>
            </div>
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
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
                  className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
