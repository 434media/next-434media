/**
 * Example usage of the Modern RichTextEditor component
 */

"use client"

import { useState } from "react"
import RichTextEditor from "./RichTextEditor"

export default function RichTextEditorExample() {
  const [content, setContent] = useState(`
    <h1 class="text-3xl font-bold mb-4">Welcome to the Modern Rich Text Editor</h1>
    <p>This is an example of the enhanced rich text editor with:</p>
    <ul class="list-disc ml-6 mb-4">
      <li class="mb-1">Modern formatting without deprecated methods</li>
      <li class="mb-1">Black and white theme</li>
      <li class="mb-1">Enhanced features like search & replace</li>
      <li class="mb-1">Keyboard shortcuts support</li>
      <li class="mb-1">Auto-save capabilities</li>
    </ul>
    <blockquote class="border-l-4 border-gray-800 pl-4 italic text-gray-700 my-4 bg-gray-50">
      "The best writing is rewriting." - E.B. White
    </blockquote>
    <p>Try the various formatting options and features available in the toolbar!</p>
  `)

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Rich Text Editor Example</h1>
      
      {/* Basic Editor */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Basic Editor</h2>
        <RichTextEditor
          value={content}
          onChange={setContent}
          placeholder="Start typing your content here..."
          className="mb-4"
        />
      </div>

      {/* Editor with all features enabled */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Full-Featured Editor</h2>
        <RichTextEditor
          value={content}
          onChange={setContent}
          placeholder="Enhanced editor with all features..."
          autoSave={true}
          maxLength={5000}
          className="mb-4"
        />
        <p className="text-sm text-gray-600">
          Auto-save enabled, 5000 character limit
        </p>
      </div>

      {/* Read-only editor */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Read-Only Mode</h2>
        <RichTextEditor
          value={content}
          onChange={setContent}
          readOnly={true}
          className="mb-4"
        />
        <p className="text-sm text-gray-600">
          This editor is in read-only mode
        </p>
      </div>

      {/* Raw HTML Output */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Raw HTML Output</h2>
        <pre className="bg-gray-100 p-4 rounded-lg overflow-auto text-sm">
          {content}
        </pre>
      </div>
    </div>
  )
}