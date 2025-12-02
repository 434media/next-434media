"use client"

import { useState, useEffect } from "react"
import { Bold, Italic, Link as LinkIcon, List, ListOrdered, Code } from "lucide-react"

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minRows?: number
}

export function RichTextEditor({ value, onChange, placeholder, minRows = 4 }: RichTextEditorProps) {
  const [showPreview, setShowPreview] = useState(false)
  const [cursorPosition, setCursorPosition] = useState<number>(0)

  // Insert markdown syntax at cursor position
  const insertMarkdown = (before: string, after: string = "", defaultText: string = "") => {
    const textarea = document.querySelector<HTMLTextAreaElement>(`textarea[data-rich-text-editor]`)
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = value.substring(start, end) || defaultText
    const newText = value.substring(0, start) + before + selectedText + after + value.substring(end)
    
    onChange(newText)
    
    // Set cursor position after the inserted text
    setTimeout(() => {
      const newPosition = start + before.length + selectedText.length + after.length
      textarea.focus()
      textarea.setSelectionRange(newPosition, newPosition)
    }, 0)
  }

  // Format helpers
  const formatBold = () => insertMarkdown("**", "**", "bold text")
  const formatItalic = () => insertMarkdown("*", "*", "italic text")
  const formatLink = () => insertMarkdown("[", "](https://example.com)", "link text")
  const formatBulletList = () => {
    const textarea = document.querySelector<HTMLTextAreaElement>(`textarea[data-rich-text-editor]`)
    if (!textarea) return
    const start = textarea.selectionStart
    const lineStart = value.lastIndexOf("\n", start - 1) + 1
    onChange(value.substring(0, lineStart) + "- " + value.substring(lineStart))
  }
  const formatNumberedList = () => {
    const textarea = document.querySelector<HTMLTextAreaElement>(`textarea[data-rich-text-editor]`)
    if (!textarea) return
    const start = textarea.selectionStart
    const lineStart = value.lastIndexOf("\n", start - 1) + 1
    onChange(value.substring(0, lineStart) + "1. " + value.substring(lineStart))
  }
  const formatCode = () => insertMarkdown("`", "`", "code")

  // Convert markdown to HTML for preview
  const renderMarkdownPreview = (text: string) => {
    let html = text
      // Headers
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-3 mb-2">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-4 mb-2">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-4 mb-3">$1</h1>')
      // Bold
      .replace(/\*\*(.*?)\*\*/gim, '<strong class="font-bold">$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/gim, '<em class="italic">$1</em>')
      // Links
      .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2" class="text-blue-600 underline" target="_blank" rel="noopener noreferrer">$1</a>')
      // Inline code
      .replace(/`(.*?)`/gim, '<code class="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>')
      // Line breaks
      .replace(/\n/gim, '<br />')

    return html
  }

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="bg-gray-50 border-b border-gray-300 p-2 flex items-center gap-1 flex-wrap">
        <button
          type="button"
          onClick={formatBold}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Bold (Ctrl+B)"
        >
          <Bold className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={formatItalic}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Italic (Ctrl+I)"
        >
          <Italic className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={formatLink}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Insert Link"
        >
          <LinkIcon className="h-4 w-4" />
        </button>
        <div className="w-px h-6 bg-gray-300 mx-1" />
        <button
          type="button"
          onClick={formatBulletList}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={formatNumberedList}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </button>
        <div className="w-px h-6 bg-gray-300 mx-1" />
        <button
          type="button"
          onClick={formatCode}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Inline Code"
        >
          <Code className="h-4 w-4" />
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
            showPreview 
              ? "bg-blue-600 text-white" 
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          {showPreview ? "Edit" : "Preview"}
        </button>
      </div>

      {/* Editor or Preview */}
      {showPreview ? (
        <div 
          className="p-4 min-h-[100px] prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: renderMarkdownPreview(value) }}
        />
      ) : (
        <textarea
          data-rich-text-editor
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={minRows}
          className="w-full px-4 py-3 focus:outline-none resize-y font-sans"
          style={{ minHeight: `${minRows * 1.5}rem` }}
        />
      )}

      {/* Help text */}
      {!showPreview && (
        <div className="bg-gray-50 border-t border-gray-300 px-3 py-2 text-xs text-gray-500">
          Supports Markdown: **bold**, *italic*, [link](url), `code`, - bullet list, 1. numbered list
        </div>
      )}
    </div>
  )
}
