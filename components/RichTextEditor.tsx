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
  ExternalLink,
  Minus,
  Undo,
  Redo,
  SplitSquareVertical,
  X
} from "lucide-react"
import { Marked } from 'marked'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minRows?: number
}

// Configure marked to match production exactly
const syncMarked = new Marked({ 
  async: false, 
  gfm: true, // GitHub Flavored Markdown
  breaks: true // Convert \n to <br> - important for line breaks
})

// Custom renderer for production-matching output (using marked v15+ API)
const renderer = {
  paragraph({ text }: { text: string }) {
    return `<p class="mb-4 leading-relaxed">${text}</p>\n`
  },
  heading({ text, depth }: { text: string; depth: number }) {
    const sizes: Record<number, string> = {
      1: 'text-2xl font-bold mt-8 mb-4',
      2: 'text-xl font-bold mt-6 mb-3',
      3: 'text-lg font-semibold mt-5 mb-2',
      4: 'text-base font-semibold mt-4 mb-2',
      5: 'text-sm font-semibold mt-3 mb-1',
      6: 'text-xs font-semibold mt-3 mb-1 uppercase tracking-wider',
    }
    return `<h${depth} class="${sizes[depth] || ''} text-gray-900">${text}</h${depth}>\n`
  },
  link({ href, title, text }: { href: string; title?: string | null; text: string }) {
    const titleAttr = title ? ` title="${title}"` : ''
    return `<a href="${href}"${titleAttr} class="text-blue-600 underline decoration-blue-300 underline-offset-2 hover:decoration-blue-600 transition-colors" target="_blank" rel="noopener noreferrer">${text}<svg class="inline-block w-3 h-3 ml-0.5 -mt-0.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg></a>`
  },
  strong({ text }: { text: string }) {
    return `<strong class="font-semibold text-gray-900">${text}</strong>`
  },
  em({ text }: { text: string }) {
    return `<em class="italic text-gray-700">${text}</em>`
  },
  codespan({ text }: { text: string }) {
    return `<code class="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-sm font-mono">${text}</code>`
  },
  code({ text, lang }: { text: string; lang?: string }) {
    return `<pre class="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto my-4 text-sm"><code class="language-${lang || 'text'}">${text}</code></pre>\n`
  },
  blockquote({ text }: { text: string }) {
    return `<blockquote class="border-l-4 border-gray-300 pl-4 my-4 text-gray-600 italic">${text}</blockquote>\n`
  },
  list({ items, ordered }: { items: Array<{ text: string }>; ordered: boolean }) {
    const tag = ordered ? 'ol' : 'ul'
    const cls = ordered ? 'list-decimal' : 'list-disc'
    const body = items.map(item => `<li class="leading-relaxed">${item.text}</li>`).join('\n')
    return `<${tag} class="${cls} pl-6 my-4 space-y-1 text-gray-700">${body}</${tag}>\n`
  },
  listitem({ text }: { text: string }) {
    return `<li class="leading-relaxed">${text}</li>\n`
  },
  hr() {
    return `<hr class="border-t border-gray-200 my-8" />\n`
  },
  br() {
    return `<br />`
  },
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
syncMarked.use({ renderer: renderer as any })

export function RichTextEditor({ value, onChange, placeholder, minRows = 8 }: RichTextEditorProps) {
  const [viewMode, setViewMode] = useState<'edit' | 'preview' | 'split'>('edit')
  const [showHelp, setShowHelp] = useState(false)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [linkText, setLinkText] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
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
      return syncMarked.parse(value) as string
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
    disabled = false 
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
      className={`p-2 rounded-md transition-all ${
        disabled
          ? 'text-gray-300 cursor-not-allowed'
          : active 
            ? 'bg-sky-100 text-sky-700 shadow-sm' 
            : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
      }`}
      title={title}
    >
      {children}
    </button>
  )

  const ToolbarDivider = () => <div className="w-px h-6 bg-gray-200 mx-1" />

  const ViewModeButton = ({ mode, icon, label }: { mode: 'edit' | 'preview' | 'split'; icon: React.ReactNode; label: string }) => (
    <button
      type="button"
      onClick={() => setViewMode(mode)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
        viewMode === mode 
          ? "bg-sky-100 text-sky-700 shadow-sm" 
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm relative">
      {/* Toolbar */}
      <div className="bg-gray-50 border-b border-gray-200 p-2 flex items-center gap-1 flex-wrap">
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
        
        {/* Link */}
        <ToolbarButton onClick={openLinkDialog} title="Insert Link (⌘K)">
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>
        
        {/* Spacer */}
        <div className="flex-1" />
        
        {/* Help */}
        <ToolbarButton onClick={() => setShowHelp(!showHelp)} title="Markdown Help" active={showHelp}>
          <HelpCircle className="h-4 w-4" />
        </ToolbarButton>
        
        {/* View mode toggles */}
        <div className="flex items-center gap-1 bg-white rounded-lg p-1 border border-gray-200 ml-2">
          <ViewModeButton mode="edit" icon={<Edit3 className="h-3.5 w-3.5" />} label="Edit" />
          <ViewModeButton mode="split" icon={<SplitSquareVertical className="h-3.5 w-3.5" />} label="Split" />
          <ViewModeButton mode="preview" icon={<Eye className="h-3.5 w-3.5" />} label="Preview" />
        </div>
      </div>

      {/* Link Dialog */}
      {linkDialogOpen && (
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-50" onClick={() => setLinkDialogOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <LinkIcon className="h-5 w-5 text-sky-600" />
                Insert Link
              </h3>
              <button onClick={() => setLinkDialogOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Link Text</label>
                <input
                  type="text"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  placeholder="Display text for the link"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">URL</label>
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  onKeyDown={(e) => e.key === 'Enter' && insertLink()}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setLinkDialogOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={insertLink}
                  disabled={!linkUrl}
                  className="px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <ExternalLink className="h-4 w-4" />
                  Insert Link
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Help panel */}
      {showHelp && (
        <div className="bg-linear-to-r from-sky-50 to-blue-50 border-b border-sky-200 p-4 text-sm">
          <h4 className="font-semibold text-sky-900 mb-3 flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            Markdown Quick Reference
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sky-800">
            <div className="space-y-1.5">
              <p className="font-medium text-sky-900 text-xs uppercase tracking-wide">Formatting</p>
              <p><code className="bg-sky-100 px-1 rounded text-xs">**bold**</code> → <strong>bold</strong></p>
              <p><code className="bg-sky-100 px-1 rounded text-xs">*italic*</code> → <em>italic</em></p>
              <p><code className="bg-sky-100 px-1 rounded text-xs">`code`</code> → <code className="bg-gray-200 px-1 rounded text-xs">code</code></p>
            </div>
            <div className="space-y-1.5">
              <p className="font-medium text-sky-900 text-xs uppercase tracking-wide">Links</p>
              <p><code className="bg-sky-100 px-1 rounded text-xs">[text](url)</code> → link</p>
              <p className="text-xs text-sky-600">Or use ⌘K shortcut</p>
            </div>
            <div className="space-y-1.5">
              <p className="font-medium text-sky-900 text-xs uppercase tracking-wide">Structure</p>
              <p><code className="bg-sky-100 px-1 rounded text-xs"># Heading 1</code></p>
              <p><code className="bg-sky-100 px-1 rounded text-xs">## Heading 2</code></p>
              <p><code className="bg-sky-100 px-1 rounded text-xs">---</code> → horizontal line</p>
            </div>
            <div className="space-y-1.5">
              <p className="font-medium text-sky-900 text-xs uppercase tracking-wide">Lists</p>
              <p><code className="bg-sky-100 px-1 rounded text-xs">- item</code> → bullet</p>
              <p><code className="bg-sky-100 px-1 rounded text-xs">1. item</code> → numbered</p>
              <p><code className="bg-sky-100 px-1 rounded text-xs">&gt; quote</code> → blockquote</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-sky-200">
            <p className="text-sky-600 text-xs flex items-center gap-2 flex-wrap">
              <kbd className="bg-sky-100 px-1.5 py-0.5 rounded text-xs font-mono">⌘B</kbd> Bold
              <span className="text-sky-300">•</span>
              <kbd className="bg-sky-100 px-1.5 py-0.5 rounded text-xs font-mono">⌘I</kbd> Italic
              <span className="text-sky-300">•</span>
              <kbd className="bg-sky-100 px-1.5 py-0.5 rounded text-xs font-mono">⌘K</kbd> Link
              <span className="text-sky-300">•</span>
              <kbd className="bg-sky-100 px-1.5 py-0.5 rounded text-xs font-mono">⌘Z</kbd> Undo
              <span className="text-sky-300">•</span>
              <kbd className="bg-sky-100 px-1.5 py-0.5 rounded text-xs font-mono">⌘⇧Z</kbd> Redo
            </p>
          </div>
        </div>
      )}

      {/* Editor / Preview Area */}
      <div className={`${viewMode === 'split' ? 'grid grid-cols-2 divide-x divide-gray-200' : ''}`}>
        {/* Editor */}
        {(viewMode === 'edit' || viewMode === 'split') && (
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder || "Write your content here using Markdown...\n\nTip: Use **bold**, *italic*, [links](url), and more!\n\nLine breaks are preserved. Use blank lines for new paragraphs."}
              rows={minRows}
              className="w-full px-4 py-4 focus:outline-none focus:ring-2 focus:ring-sky-500/20 resize-y font-mono text-sm leading-relaxed text-gray-800 placeholder:text-gray-400 min-h-50 bg-white"
              style={{ minHeight: `${Math.max(minRows * 1.75, 12)}rem` }}
            />
            {/* Editor label */}
            {viewMode === 'split' && (
              <div className="absolute top-2 right-2 bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded-md font-medium">
                Markdown
              </div>
            )}
          </div>
        )}

        {/* Preview */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className="relative bg-white">
            {/* Preview label */}
            {viewMode === 'split' && (
              <div className="absolute top-2 right-2 bg-sky-100 text-sky-700 text-xs px-2 py-1 rounded-md font-medium z-10">
                Preview
              </div>
            )}
            <div 
              className="px-6 py-4 min-h-50 overflow-auto prose prose-sm max-w-none 
                prose-headings:text-gray-900 prose-p:text-gray-700 prose-strong:text-gray-900 
                prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
                prose-code:text-gray-800 prose-code:bg-gray-100 prose-code:rounded prose-code:px-1
                prose-pre:bg-gray-900 prose-pre:text-gray-100
                prose-blockquote:text-gray-600 prose-blockquote:border-gray-300
                prose-ul:text-gray-700 prose-ol:text-gray-700 prose-li:text-gray-700"
              style={{ minHeight: `${Math.max(minRows * 1.75, 12)}rem` }}
              dangerouslySetInnerHTML={{ __html: renderedPreview }}
            />
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="bg-gray-50 border-t border-gray-200 px-4 py-2 flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-3">
          <span className="font-medium">
            {value.length.toLocaleString()} chars
          </span>
          <span className="text-gray-300">•</span>
          <span>
            {value.split(/\s+/).filter(Boolean).length.toLocaleString()} words
          </span>
          <span className="text-gray-300">•</span>
          <span>
            {value.split('\n').length} lines
          </span>
        </div>
        <div className="flex items-center gap-2">
          {viewMode === 'split' && (
            <span className="text-sky-600 font-medium">
              ✓ Live preview matches production
            </span>
          )}
          <span className="text-gray-400">
            Markdown
          </span>
        </div>
      </div>
    </div>
  )
}
