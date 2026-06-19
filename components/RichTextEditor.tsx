"use client"

import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import {
  Bold,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Eye,
  Edit3,
  HelpCircle,
  Minus,
  Undo,
  Redo,
  SplitSquareVertical,
  X,
  Image as ImageIcon,
} from "lucide-react"
import { renderMarkdown } from "@/lib/markdown"
import { ImageUpload } from "./ImageUpload"

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minRows?: number
}

export function RichTextEditor({ value, onChange, placeholder, minRows = 8 }: RichTextEditorProps) {
  const [viewMode, setViewMode] = useState<'edit' | 'preview' | 'split'>('edit')
  const [showHelp, setShowHelp] = useState(false)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [linkText, setLinkText] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  // Image insertion — reuses the shared ImageUpload component which already
  // handles file uploads to Vercel Blob and URL paste. The resulting URL is
  // inserted as a markdown image at the cursor position.
  const [imageDialogOpen, setImageDialogOpen] = useState(false)
  const [imageAlt, setImageAlt] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [undoStack, setUndoStack] = useState<string[]>([])
  const [redoStack, setRedoStack] = useState<string[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lastValueRef = useRef(value)

  // Track changes for undo/redo
  useEffect(() => {
    if (value !== lastValueRef.current) {
      setUndoStack(prev => [...prev.slice(-50), lastValueRef.current])
      setRedoStack([])
      lastValueRef.current = value
    }
  }, [value])

  const handleUndo = useCallback(() => {
    if (undoStack.length > 0) {
      const previousValue = undoStack[undoStack.length - 1]
      setUndoStack(prev => prev.slice(0, -1))
      setRedoStack(prev => [...prev, value])
      lastValueRef.current = previousValue
      onChange(previousValue)
    }
  }, [undoStack, value, onChange])

  const handleRedo = useCallback(() => {
    if (redoStack.length > 0) {
      const nextValue = redoStack[redoStack.length - 1]
      setRedoStack(prev => prev.slice(0, -1))
      setUndoStack(prev => [...prev, value])
      lastValueRef.current = nextValue
      onChange(nextValue)
    }
  }, [redoStack, value, onChange])

  // Insert markdown syntax at cursor position
  const insertMarkdown = useCallback((before: string, after: string = "", defaultText: string = "") => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = value.substring(start, end) || defaultText
    const newText = value.substring(0, start) + before + selectedText + after + value.substring(end)
    
    onChange(newText)
    
    // Set cursor position after the inserted text
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(
        start + before.length, 
        start + before.length + selectedText.length
      )
    }, 0)
  }, [value, onChange])

  // Insert at line start (toggle behavior)
  const insertAtLineStart = useCallback((prefix: string) => {
    const textarea = textareaRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const lineStart = value.lastIndexOf("\n", start - 1) + 1
    const lineEnd = value.indexOf("\n", start)
    const actualLineEnd = lineEnd === -1 ? value.length : lineEnd
    
    const currentLine = value.substring(lineStart, actualLineEnd)
    if (currentLine.startsWith(prefix)) {
      // Remove prefix
      const newValue = value.substring(0, lineStart) + value.substring(lineStart + prefix.length)
      onChange(newValue)
    } else {
      // Remove other list prefixes first
      let cleanLine = currentLine
      if (currentLine.match(/^(\d+\.\s|- |\* )/)) {
        cleanLine = currentLine.replace(/^(\d+\.\s|- |\* )/, '')
      }
      // Add prefix
      const newValue = value.substring(0, lineStart) + prefix + cleanLine + value.substring(actualLineEnd)
      onChange(newValue)
    }

    setTimeout(() => {
      textarea.focus()
    }, 0)
  }, [value, onChange])

  // Format helpers
  const formatBold = useCallback(() => insertMarkdown("**", "**", "bold text"), [insertMarkdown])
  const formatItalic = useCallback(() => insertMarkdown("*", "*", "italic text"), [insertMarkdown])
  const formatCode = useCallback(() => insertMarkdown("`", "`", "code"), [insertMarkdown])
  const formatBulletList = useCallback(() => insertAtLineStart("- "), [insertAtLineStart])
  const formatNumberedList = useCallback(() => insertAtLineStart("1. "), [insertAtLineStart])
  const formatH1 = useCallback(() => insertAtLineStart("# "), [insertAtLineStart])
  const formatH2 = useCallback(() => insertAtLineStart("## "), [insertAtLineStart])
  const formatH3 = useCallback(() => insertAtLineStart("### "), [insertAtLineStart])
  const formatQuote = useCallback(() => insertAtLineStart("> "), [insertAtLineStart])
  const formatHorizontalRule = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const beforeCursor = value.substring(0, start)
    const afterCursor = value.substring(start)
    const needsNewlineBefore = beforeCursor.length > 0 && !beforeCursor.endsWith('\n\n')
    const prefix = needsNewlineBefore ? (beforeCursor.endsWith('\n') ? '\n' : '\n\n') : ''
    onChange(beforeCursor + prefix + '---\n\n' + afterCursor)
  }, [value, onChange])

  // Open link dialog
  const openLinkDialog = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = value.substring(start, end)
    setLinkText(selectedText)
    setLinkUrl('')
    setLinkDialogOpen(true)
  }, [value])

  // Insert link from dialog
  const insertLink = useCallback(() => {
    if (!linkUrl) return
    const displayText = linkText || linkUrl
    insertMarkdown(`[${displayText}](`, ")", linkUrl)
    setLinkDialogOpen(false)
    setLinkText('')
    setLinkUrl('')
  }, [linkText, linkUrl, insertMarkdown])

  // Open image dialog — pre-fills alt with any selected text
  const openImageDialog = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = value.substring(start, end)
    setImageAlt(selectedText)
    setImageUrl('')
    setImageDialogOpen(true)
  }, [value])

  // Insert image from dialog — produces markdown ![alt](url) at the cursor
  const insertImage = useCallback(() => {
    if (!imageUrl) return
    const altText = imageAlt.trim() || "image"
    insertMarkdown(`![${altText}](`, ")", imageUrl)
    setImageDialogOpen(false)
    setImageAlt('')
    setImageUrl('')
  }, [imageAlt, imageUrl, insertMarkdown])

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.metaKey || e.ctrlKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault()
          formatBold()
          break
        case 'i':
          e.preventDefault()
          formatItalic()
          break
        case 'k':
          e.preventDefault()
          openLinkDialog()
          break
        case 'z':
          e.preventDefault()
          if (e.shiftKey) {
            handleRedo()
          } else {
            handleUndo()
          }
          break
      }
    }

    // Handle Tab for indentation
    if (e.key === 'Tab') {
      e.preventDefault()
      const textarea = textareaRef.current
      if (!textarea) return
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newValue = value.substring(0, start) + '  ' + value.substring(end)
      onChange(newValue)
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2
      }, 0)
    }
  }, [formatBold, formatItalic, openLinkDialog, handleUndo, handleRedo, value, onChange])

  // Render markdown preview using the same library as production
  const renderedPreview = useMemo(() => {
    if (!value) {
      return '<p class="text-gray-400 italic">No content yet. Start typing to see a preview...</p>'
    }
    try {
      return renderMarkdown(value)
    } catch (error) {
      console.error('Markdown parsing error:', error)
      return `<p class="text-red-500">Error rendering preview</p>`
    }
  }, [value])

  const ToolbarButton = ({
    onClick,
    title,
    children,
    active = false,
    disabled = false,
  }: {
    onClick: () => void
    title: string
    children: React.ReactNode
    active?: boolean
    disabled?: boolean
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center h-7 w-7 rounded-md transition-colors ${
        disabled
          ? 'text-neutral-300 cursor-not-allowed'
          : active
            ? 'bg-neutral-900 text-white'
            : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
      }`}
      title={title}
    >
      {children}
    </button>
  )

  const ToolbarDivider = () => <div className="w-px h-5 bg-neutral-200 mx-0.5" />

  const ViewModeButton = ({ mode, icon, label }: { mode: 'edit' | 'preview' | 'split'; icon: React.ReactNode; label: string }) => (
    <button
      type="button"
      onClick={() => setViewMode(mode)}
      className={`inline-flex items-center gap-1.5 px-2.5 text-xs font-medium whitespace-nowrap transition-colors ${
        viewMode === mode
          ? "bg-neutral-900 text-white"
          : "bg-white text-neutral-700 hover:bg-neutral-50"
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )

  return (
    <div className="ring-1 ring-neutral-200/70 rounded-md overflow-hidden bg-white relative">
      {/* Toolbar */}
      <div className="bg-neutral-50/50 border-b border-neutral-100 px-2 py-1.5 flex items-center gap-0.5 flex-wrap">
        {/* Undo/Redo */}
        <ToolbarButton 
          onClick={handleUndo} 
          title="Undo (⌘Z)" 
          disabled={undoStack.length === 0}
        >
          <Undo className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton 
          onClick={handleRedo} 
          title="Redo (⌘⇧Z)" 
          disabled={redoStack.length === 0}
        >
          <Redo className="h-4 w-4" />
        </ToolbarButton>
        
        <ToolbarDivider />

        {/* Text formatting */}
        <ToolbarButton onClick={formatBold} title="Bold (⌘B)">
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={formatItalic} title="Italic (⌘I)">
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={formatCode} title="Inline Code">
          <Code className="h-4 w-4" />
        </ToolbarButton>
        
        <ToolbarDivider />
        
        {/* Headers */}
        <ToolbarButton onClick={formatH1} title="Heading 1">
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={formatH2} title="Heading 2">
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={formatH3} title="Heading 3">
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>
        
        <ToolbarDivider />
        
        {/* Lists & Structure */}
        <ToolbarButton onClick={formatBulletList} title="Bullet List">
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={formatNumberedList} title="Numbered List">
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={formatQuote} title="Blockquote">
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={formatHorizontalRule} title="Horizontal Rule">
          <Minus className="h-4 w-4" />
        </ToolbarButton>
        
        <ToolbarDivider />
        
        {/* Link + Image */}
        <ToolbarButton onClick={openLinkDialog} title="Insert link (⌘K)">
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={openImageDialog} title="Insert image">
          <ImageIcon className="h-4 w-4" />
        </ToolbarButton>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Help */}
        <ToolbarButton onClick={() => setShowHelp(!showHelp)} title="Markdown help" active={showHelp}>
          <HelpCircle className="h-4 w-4" />
        </ToolbarButton>

        {/* View mode segmented control */}
        <div className="inline-flex h-7 rounded-md ring-1 ring-neutral-200 divide-x divide-neutral-200 overflow-hidden bg-white ml-1.5">
          <ViewModeButton mode="edit" icon={<Edit3 className="h-3 w-3" />} label="Edit" />
          <ViewModeButton mode="split" icon={<SplitSquareVertical className="h-3 w-3" />} label="Split" />
          <ViewModeButton mode="preview" icon={<Eye className="h-3 w-3" />} label="Preview" />
        </div>
      </div>

      {/* Link Dialog */}
      {linkDialogOpen && (
        <div
          className="absolute inset-0 bg-black/20 flex items-center justify-center z-50"
          onClick={() => setLinkDialogOpen(false)}
          onKeyDown={(e) => e.key === "Escape" && setLinkDialogOpen(false)}
        >
          <div className="bg-white rounded-md ring-1 ring-neutral-200 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.18)] p-5 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-md bg-neutral-100 text-neutral-700">
                  <LinkIcon className="h-3.5 w-3.5" />
                </div>
                <h3 className="text-sm font-medium text-neutral-900">Insert link</h3>
              </div>
              <button
                onClick={() => setLinkDialogOpen(false)}
                className="inline-flex items-center justify-center h-7 w-7 rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Link text</label>
                <input
                  type="text"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  placeholder="Display text for the link"
                  className="w-full h-10 px-3 ring-1 ring-neutral-200 rounded-md focus:ring-2 focus:ring-neutral-900 focus:outline-none text-sm bg-white"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">URL</label>
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full h-10 px-3 ring-1 ring-neutral-200 rounded-md focus:ring-2 focus:ring-neutral-900 focus:outline-none text-sm bg-white font-mono"
                  onKeyDown={(e) => e.key === "Enter" && insertLink()}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setLinkDialogOpen(false)}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md ring-1 ring-neutral-200 bg-white text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={insertLink}
                  disabled={!linkUrl}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Insert link
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Dialog — reuses the shared ImageUpload component (file-first by
          default). Resulting URL becomes ![alt](url) at the cursor. */}
      {imageDialogOpen && (
        <div
          className="absolute inset-0 bg-black/20 flex items-center justify-center z-50 p-4 overflow-y-auto"
          onClick={() => setImageDialogOpen(false)}
        >
          <div
            className="bg-white rounded-md ring-1 ring-neutral-200 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.18)] p-5 w-full max-w-lg my-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-md bg-neutral-100 text-neutral-700">
                  <ImageIcon className="h-3.5 w-3.5" />
                </div>
                <h3 className="text-sm font-medium text-neutral-900">Insert image</h3>
              </div>
              <button
                onClick={() => setImageDialogOpen(false)}
                className="inline-flex items-center justify-center h-7 w-7 rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                  Alt text
                  <span className="ml-1.5 text-[11px] font-normal text-neutral-400">· describes the image for screen readers and SEO</span>
                </label>
                <input
                  type="text"
                  value={imageAlt}
                  onChange={(e) => setImageAlt(e.target.value)}
                  placeholder="A photo of…"
                  className="w-full h-10 px-3 ring-1 ring-neutral-200 rounded-md focus:ring-2 focus:ring-neutral-900 focus:outline-none text-sm bg-white"
                />
              </div>
              <ImageUpload
                value={imageUrl}
                onChange={setImageUrl}
                label="Image"
                hideUrl
              />
              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setImageDialogOpen(false)}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md ring-1 ring-neutral-200 bg-white text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={insertImage}
                  disabled={!imageUrl}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Insert image
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Help panel */}
      {showHelp && (
        <div className="bg-neutral-50/50 border-b border-neutral-100 px-4 py-3 text-sm">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-3">
            <HelpCircle className="h-3 w-3" />
            Markdown reference
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-neutral-700 text-xs">
            <div className="space-y-1.5">
              <p className="font-medium text-neutral-900 text-[10px] uppercase tracking-[0.18em]">Formatting</p>
              <p><code className="bg-neutral-100 px-1 rounded text-[11px] font-mono">**bold**</code> → <strong>bold</strong></p>
              <p><code className="bg-neutral-100 px-1 rounded text-[11px] font-mono">*italic*</code> → <em>italic</em></p>
              <p><code className="bg-neutral-100 px-1 rounded text-[11px] font-mono">`code`</code> → <code className="bg-neutral-100 px-1 rounded text-[11px]">code</code></p>
            </div>
            <div className="space-y-1.5">
              <p className="font-medium text-neutral-900 text-[10px] uppercase tracking-[0.18em]">Links & images</p>
              <p><code className="bg-neutral-100 px-1 rounded text-[11px] font-mono">[text](url)</code> → link</p>
              <p><code className="bg-neutral-100 px-1 rounded text-[11px] font-mono">![alt](url)</code> → image</p>
              <p className="text-[11px] text-neutral-500">Or use ⌘K / image button</p>
            </div>
            <div className="space-y-1.5">
              <p className="font-medium text-neutral-900 text-[10px] uppercase tracking-[0.18em]">Structure</p>
              <p><code className="bg-neutral-100 px-1 rounded text-[11px] font-mono"># Heading 1</code></p>
              <p><code className="bg-neutral-100 px-1 rounded text-[11px] font-mono">## Heading 2</code></p>
              <p><code className="bg-neutral-100 px-1 rounded text-[11px] font-mono">---</code> → horizontal line</p>
            </div>
            <div className="space-y-1.5">
              <p className="font-medium text-neutral-900 text-[10px] uppercase tracking-[0.18em]">Lists</p>
              <p><code className="bg-neutral-100 px-1 rounded text-[11px] font-mono">- item</code> → bullet</p>
              <p><code className="bg-neutral-100 px-1 rounded text-[11px] font-mono">1. item</code> → numbered</p>
              <p><code className="bg-neutral-100 px-1 rounded text-[11px] font-mono">&gt; quote</code> → blockquote</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-neutral-100">
            <p className="text-[11px] text-neutral-500 flex items-center gap-2 flex-wrap">
              <kbd className="bg-white ring-1 ring-neutral-200 px-1.5 py-0.5 rounded text-[10px] font-mono">⌘B</kbd> Bold
              <span className="text-neutral-300">·</span>
              <kbd className="bg-white ring-1 ring-neutral-200 px-1.5 py-0.5 rounded text-[10px] font-mono">⌘I</kbd> Italic
              <span className="text-neutral-300">·</span>
              <kbd className="bg-white ring-1 ring-neutral-200 px-1.5 py-0.5 rounded text-[10px] font-mono">⌘K</kbd> Link
              <span className="text-neutral-300">·</span>
              <kbd className="bg-white ring-1 ring-neutral-200 px-1.5 py-0.5 rounded text-[10px] font-mono">⌘Z</kbd> Undo
              <span className="text-neutral-300">·</span>
              <kbd className="bg-white ring-1 ring-neutral-200 px-1.5 py-0.5 rounded text-[10px] font-mono">⌘⇧Z</kbd> Redo
            </p>
          </div>
        </div>
      )}

      {/* Editor / Preview Area */}
      <div className={`${viewMode === 'split' ? 'grid grid-cols-2 divide-x divide-neutral-100' : ''}`}>
        {/* Editor */}
        {(viewMode === 'edit' || viewMode === 'split') && (
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder || "Write in Markdown…\n\n**bold**, *italic*, [links](url), ![alt](url) for images.\n\nBlank lines start new paragraphs."}
              rows={minRows}
              className="w-full px-4 py-4 focus:outline-none resize-y font-mono text-sm leading-relaxed text-neutral-800 placeholder:text-neutral-400 min-h-50 bg-white"
              style={{ minHeight: `${Math.max(minRows * 1.75, 12)}rem` }}
            />
            {viewMode === 'split' && (
              <span className="absolute top-2 right-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500 text-[10px] font-medium uppercase tracking-[0.16em]">
                Markdown
              </span>
            )}
          </div>
        )}

        {/* Preview */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className="relative bg-white">
            {viewMode === 'split' && (
              <span className="absolute top-2 right-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500 text-[10px] font-medium uppercase tracking-[0.16em] z-10">
                Preview
              </span>
            )}
            <div
              className="px-6 py-4 min-h-50 overflow-auto prose prose-sm max-w-none
                prose-headings:text-neutral-900 prose-p:text-neutral-700 prose-strong:text-neutral-900
                prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
                prose-code:text-neutral-800 prose-code:bg-neutral-100 prose-code:rounded prose-code:px-1
                prose-pre:bg-neutral-900 prose-pre:text-neutral-100
                prose-blockquote:text-neutral-600 prose-blockquote:border-neutral-300
                prose-ul:text-neutral-700 prose-ol:text-neutral-700 prose-li:text-neutral-700"
              style={{ minHeight: `${Math.max(minRows * 1.75, 12)}rem` }}
              dangerouslySetInnerHTML={{ __html: renderedPreview }}
            />
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="bg-neutral-50/50 border-t border-neutral-100 px-4 py-1.5 flex items-center justify-between text-[11px] text-neutral-500">
        <div className="flex items-center gap-2 tabular-nums">
          <span>{value.length.toLocaleString()} chars</span>
          <span className="text-neutral-300">·</span>
          <span>{value.split(/\s+/).filter(Boolean).length.toLocaleString()} words</span>
          <span className="text-neutral-300">·</span>
          <span>{value.split('\n').length} lines</span>
        </div>
        <div className="flex items-center gap-2">
          {viewMode === 'split' && (
            <span className="inline-flex items-center gap-1.5 text-neutral-500">
              <span className="inline-block h-1 w-1 rounded-full bg-emerald-500" aria-hidden="true" />
              Live preview matches production
            </span>
          )}
          <span className="text-neutral-400 uppercase tracking-[0.16em] text-[10px] font-medium">Markdown</span>
        </div>
      </div>
    </div>
  )
}
