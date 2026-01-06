"use client"

import { useState, useRef, useCallback } from "react"
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
  EyeOff,
  HelpCircle
} from "lucide-react"

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minRows?: number
}

export function RichTextEditor({ value, onChange, placeholder, minRows = 8 }: RichTextEditorProps) {
  const [showPreview, setShowPreview] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
      const newPosition = start + before.length + selectedText.length
      textarea.focus()
      textarea.setSelectionRange(newPosition, newPosition)
    }, 0)
  }, [value, onChange])

  // Insert at line start
  const insertAtLineStart = useCallback((prefix: string) => {
    const textarea = textareaRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const lineStart = value.lastIndexOf("\n", start - 1) + 1
    const lineEnd = value.indexOf("\n", start)
    const actualLineEnd = lineEnd === -1 ? value.length : lineEnd
    
    // Check if line already has the prefix
    const currentLine = value.substring(lineStart, actualLineEnd)
    if (currentLine.startsWith(prefix)) {
      // Remove prefix
      onChange(value.substring(0, lineStart) + value.substring(lineStart + prefix.length))
    } else {
      // Add prefix
      onChange(value.substring(0, lineStart) + prefix + value.substring(lineStart))
    }
  }, [value, onChange])

  // Format helpers
  const formatBold = () => insertMarkdown("**", "**", "bold text")
  const formatItalic = () => insertMarkdown("*", "*", "italic text")
  const formatLink = () => {
    const textarea = textareaRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = value.substring(start, end)
    
    if (selectedText) {
      insertMarkdown("[", "](https://)", selectedText)
    } else {
      insertMarkdown("[link text](", ")", "https://example.com")
    }
  }
  const formatBulletList = () => insertAtLineStart("- ")
  const formatNumberedList = () => insertAtLineStart("1. ")
  const formatCode = () => insertMarkdown("`", "`", "code")
  const formatH1 = () => insertAtLineStart("# ")
  const formatH2 = () => insertAtLineStart("## ")
  const formatH3 = () => insertAtLineStart("### ")
  const formatQuote = () => insertAtLineStart("> ")

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
          formatLink()
          break
      }
    }
  }, [formatBold, formatItalic, formatLink])

  // Convert markdown to HTML for preview
  const renderMarkdownPreview = (text: string) => {
    let html = text
      // Code blocks (before other replacements)
      .replace(/```(\w*)\n([\s\S]*?)```/gim, '<pre class="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto my-4"><code>$2</code></pre>')
      // Headers
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-6 mb-3 text-gray-900">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-8 mb-4 text-gray-900">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-8 mb-4 text-gray-900">$1</h1>')
      // Blockquotes
      .replace(/^> (.*$)/gim, '<blockquote class="border-l-4 border-gray-300 pl-4 italic text-gray-600 my-4">$1</blockquote>')
      // Bold
      .replace(/\*\*(.*?)\*\*/gim, '<strong class="font-semibold text-gray-900">$1</strong>')
      // Italic
      .replace(/(?<!\*)\*(?!\*)([^*]+)\*(?!\*)/gim, '<em class="italic">$1</em>')
      // Links
      .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2" class="text-blue-600 underline hover:text-blue-800" target="_blank" rel="noopener noreferrer">$1</a>')
      // Inline code
      .replace(/`([^`]+)`/gim, '<code class="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-gray-800">$1</code>')
      // Unordered lists
      .replace(/^- (.*$)/gim, '<li class="ml-4">$1</li>')
      // Ordered lists
      .replace(/^\d+\. (.*$)/gim, '<li class="ml-4 list-decimal">$1</li>')
      // Paragraphs (double line breaks)
      .replace(/\n\n/gim, '</p><p class="mb-4">')
      // Single line breaks
      .replace(/\n/gim, '<br />')

    // Wrap in paragraph
    return `<p class="mb-4">${html}</p>`
  }

  const ToolbarButton = ({ onClick, title, children, active = false }: { onClick: () => void, title: string, children: React.ReactNode, active?: boolean }) => (
    <button
      type="button"
      onClick={onClick}
      className={`p-2 rounded transition-colors ${
        active 
          ? 'bg-gray-900 text-white' 
          : 'hover:bg-gray-200 text-gray-700'
      }`}
      title={title}
    >
      {children}
    </button>
  )

  const ToolbarDivider = () => <div className="w-px h-6 bg-gray-300 mx-1" />

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm">
      {/* Toolbar */}
      <div className="bg-gray-50 border-b border-gray-200 p-2 flex items-center gap-0.5 flex-wrap">
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
        
        {/* Lists */}
        <ToolbarButton onClick={formatBulletList} title="Bullet List">
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={formatNumberedList} title="Numbered List">
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={formatQuote} title="Blockquote">
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        
        <ToolbarDivider />
        
        {/* Link */}
        <ToolbarButton onClick={formatLink} title="Insert Link (⌘K)">
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>
        
        {/* Spacer */}
        <div className="flex-1" />
        
        {/* Help */}
        <ToolbarButton onClick={() => setShowHelp(!showHelp)} title="Markdown Help" active={showHelp}>
          <HelpCircle className="h-4 w-4" />
        </ToolbarButton>
        
        {/* Preview toggle */}
        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            showPreview 
              ? "bg-gray-900 text-white" 
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {showPreview ? "Edit" : "Preview"}
        </button>
      </div>

      {/* Help panel */}
      {showHelp && (
        <div className="bg-blue-50 border-b border-blue-200 p-4 text-sm">
          <h4 className="font-semibold text-blue-900 mb-2">Markdown Quick Reference</h4>
          <div className="grid grid-cols-2 gap-4 text-blue-800">
            <div>
              <p><code className="bg-blue-100 px-1 rounded">**bold**</code> → <strong>bold</strong></p>
              <p><code className="bg-blue-100 px-1 rounded">*italic*</code> → <em>italic</em></p>
              <p><code className="bg-blue-100 px-1 rounded">`code`</code> → <code className="bg-gray-200 px-1 rounded text-xs">code</code></p>
            </div>
            <div>
              <p><code className="bg-blue-100 px-1 rounded">[text](url)</code> → link</p>
              <p><code className="bg-blue-100 px-1 rounded"># Heading</code> → H1</p>
              <p><code className="bg-blue-100 px-1 rounded">- item</code> → bullet list</p>
            </div>
          </div>
          <p className="mt-2 text-blue-600 text-xs">Keyboard shortcuts: ⌘B (bold), ⌘I (italic), ⌘K (link)</p>
        </div>
      )}

      {/* Editor or Preview */}
      {showPreview ? (
        <div className="p-6 min-h-[300px] bg-white">
          <div 
            className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-strong:text-gray-900 prose-a:text-blue-600"
            dangerouslySetInnerHTML={{ __html: renderMarkdownPreview(value) }}
          />
        </div>
      ) : (
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || "Write your content here...\n\nUse the toolbar buttons or markdown syntax:\n**bold**, *italic*, [link](url)"}
            rows={minRows}
            className="w-full px-4 py-4 focus:outline-none resize-y font-mono text-sm leading-relaxed text-gray-800 placeholder:text-gray-400 min-h-[200px]"
            style={{ minHeight: `${Math.max(minRows * 1.75, 12)}rem` }}
          />
          {/* Resize Indicator */}
          <div className="absolute bottom-0 right-0 p-2 pointer-events-none">
            <div className="flex flex-col items-center gap-1 text-neutral-300">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 17L17 7" />
                <path d="M11 17L17 11" />
                <path d="M15 17L17 15" />
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* Status bar */}
      <div className="bg-gray-50 border-t border-gray-200 px-4 py-2 flex items-center justify-between text-xs text-gray-500">
        <span>
          {value.length} characters · {value.split(/\s+/).filter(Boolean).length} words
        </span>
        <div className="flex items-center gap-3">
          <span className="hidden sm:flex items-center gap-1.5 text-neutral-400">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 17L17 7" />
              <path d="M15 17L17 15" />
            </svg>
            Drag corner to resize
          </span>
          <span className="text-gray-400">
            Markdown supported
          </span>
        </div>
      </div>
    </div>
  )
}
