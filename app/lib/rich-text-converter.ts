import { marked } from 'marked'
import sanitizeHtml from 'sanitize-html'

/**
 * Secure HTML sanitization using sanitize-html library
 * Uses a well-tested library to prevent XSS attacks and handle HTML quirks properly
 */
function sanitizeHTML(html: string): string {
  if (!html || typeof html !== 'string') {
    return ''
  }

  // Use sanitize-html with strict allowlist configuration
  let sanitized = sanitizeHtml(html, {
    allowedTags: [
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a', 'div', 'span'
    ],
    allowedAttributes: {
      'a': ['href', 'target', 'rel'],
      'p': ['class'],
      'div': ['class'],
      'span': ['class'],
      'h1': ['class'],
      'h2': ['class'],
      'h3': ['class'],
      'h4': ['class'],
      'h5': ['class'],
      'h6': ['class'],
      'ul': ['class'],
      'ol': ['class'],
      'li': ['class'],
      'blockquote': ['class'],
      'code': ['class'],
      'pre': ['class'],
      'strong': ['class'],
      'b': ['class'],
      'em': ['class'],
      'i': ['class'],
      'u': ['class']
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: {
      'a': ['http', 'https', 'mailto']
    },
    allowProtocolRelative: false,
    transformTags: {
      'a': (tagName, attribs) => {
        // Add security attributes for external links
        if (attribs.href) {
          try {
            const url = new URL(attribs.href)
            const hostname = url.hostname.toLowerCase()
            
            // Check if it's truly our domain (exact match or subdomain)
            const isOurDomain = hostname === '434media.com' || 
                               hostname.endsWith('.434media.com') ||
                               hostname === 'localhost' ||
                               hostname.startsWith('127.') ||
                               hostname.startsWith('192.168.')

            if (!isOurDomain) {
              // Add security attributes for external links
              attribs.target = '_blank'
              attribs.rel = 'noopener noreferrer'
            }
          } catch (e) {
            // If URL parsing fails, treat as external for safety
            attribs.target = '_blank'
            attribs.rel = 'noopener noreferrer'
          }
        }
        
        return {
          tagName,
          attribs
        }
      }
    }
  })

  // Add spacing classes to paragraphs that don't already have them
  sanitized = sanitized.replace(/<p(?!\s+[^>]*class\s*=)([^>]*)>/gi, '<p class="mb-8"$1>')
  
  // Convert double line breaks to paragraph breaks for better spacing
  sanitized = sanitized.replace(/\n\n+/g, '</p>\n<p class="mb-8">')

  return sanitized
}

/**
 * Convert Airtable rich text content to HTML
 * Airtable rich text can come in various formats:
 * 1. Plain text
 * 2. Markdown text
 * 3. JSON rich text object
 * 4. HTML (legacy)
 */
export async function convertAirtableRichTextToHTML(content: any): Promise<string> {
  if (!content) {
    return ''
  }

  // If content is already a string, check if it's markdown or HTML
  if (typeof content === 'string') {
    // If it contains HTML tags, sanitize and return
    if (content.includes('<') && content.includes('>')) {
      return sanitizeHTML(content)
    }
    
    // If it contains markdown syntax, convert to HTML
    if (containsMarkdown(content)) {
      const html = await marked.parse(content, { 
        gfm: true, // GitHub flavored markdown
        breaks: false // Disable breaks to prevent link interference
      })
      return sanitizeHTML(html)
    }
    
    // Plain text - convert line breaks to paragraphs
    return formatPlainText(content)
  }

  // If content is a rich text object (Airtable's collaborative rich text format)
  if (typeof content === 'object' && content !== null) {
    return convertRichTextObjectToHTML(content)
  }

  // Fallback to string conversion
  return formatPlainText(String(content))
}

/**
 * Synchronous version for simple cases
 */
export function convertAirtableRichTextToHTMLSync(content: any): string {
  if (!content) {
    return ''
  }

  // If content is already a string, check if it's markdown or HTML
  if (typeof content === 'string') {
    // If it contains HTML tags, sanitize and return
    if (content.includes('<') && content.includes('>')) {
      return sanitizeHTML(content)
    }
    
    // If it contains markdown syntax, use synchronous parsing
    if (containsMarkdown(content)) {
      marked.setOptions({ 
        gfm: true, 
        breaks: false // Disable breaks to prevent link interference
      })
      const html = marked(content) as string
      return sanitizeHTML(html)
    }
    
    // Plain text - convert line breaks to paragraphs
    return formatPlainText(content)
  }

  // If content is a rich text object (Airtable's collaborative rich text format)
  if (typeof content === 'object' && content !== null) {
    return convertRichTextObjectToHTML(content)
  }

  // Fallback to string conversion
  return formatPlainText(String(content))
}

/**
 * Check if text contains markdown syntax
 */
function containsMarkdown(text: string): boolean {
  const markdownPatterns = [
    /\*\*.*?\*\*/, // Bold
    /\*.*?\*/, // Italic
    /`.*?`/, // Code
    /\[.*?\]\(.*?\)/, // Links
    /^#{1,6}\s/, // Headers
    /^-\s/, // Lists
    /^\d+\.\s/, // Numbered lists
    /^\>/, // Blockquotes
  ]
  
  return markdownPatterns.some(pattern => pattern.test(text))
}

/**
 * Format plain text with proper paragraphs and increased spacing
 */
function formatPlainText(text: string): string {
  return text
    .split('\n\n')
    .map(paragraph => paragraph.trim())
    .filter(paragraph => paragraph.length > 0)
    .map(paragraph => `<p class="mb-8">${paragraph.replace(/\n/g, '<br>')}</p>`)
    .join('\n')
}

/**
 * Convert Airtable rich text object to HTML
 * This handles the collaborative rich text format that Airtable uses
 */
function convertRichTextObjectToHTML(richTextObj: any): string {
  try {
    // If it has a 'document' property, it's likely the new collaborative rich text format
    if (richTextObj.document) {
      return parseCollaborativeRichText(richTextObj.document)
    }
    
    // If it has 'content' array, parse as structured content
    if (richTextObj.content && Array.isArray(richTextObj.content)) {
      return parseStructuredContent(richTextObj.content)
    }
    
    // If it's an array directly
    if (Array.isArray(richTextObj)) {
      return parseStructuredContent(richTextObj)
    }
    
    // Fallback to JSON string representation
    return formatPlainText(JSON.stringify(richTextObj, null, 2))
  } catch (error) {
    console.error('Error parsing rich text object:', error)
    return formatPlainText(String(richTextObj))
  }
}

/**
 * Parse Airtable's collaborative rich text format
 */
function parseCollaborativeRichText(document: any): string {
  if (!document.content || !Array.isArray(document.content)) {
    return ''
  }
  
  return document.content.map((block: any) => parseContentBlock(block)).join('\n\n')
}

/**
 * Parse structured content array
 */
function parseStructuredContent(content: any[]): string {
  return content.map((block: any) => parseContentBlock(block)).join('\n\n')
}

/**
 * Parse individual content blocks
 */
function parseContentBlock(block: any): string {
  if (!block || typeof block !== 'object') {
    return formatPlainText(String(block))
  }
  
  const type = block.type || 'paragraph'
  const text = block.text || ''
  const content = block.content || []
  
  switch (type) {
    case 'paragraph':
      if (Array.isArray(content)) {
        const innerText = content.map(parseInlineContent).join('')
        return `<p class="mb-8">${innerText}</p>`
      }
      return `<p class="mb-8">${parseInlineContent(block)}</p>`
    
    case 'heading':
      const level = Math.min(Math.max(block.attrs?.level || 1, 1), 6)
      const headingText = Array.isArray(content) 
        ? content.map(parseInlineContent).join('')
        : parseInlineContent(block)
      return `<h${level}>${headingText}</h${level}>`
    
    case 'bulletList':
      const listItems = content.map((item: any) => 
        `<li>${parseContentBlock(item)}</li>`
      ).join('')
      return `<ul>${listItems}</ul>`
    
    case 'orderedList':
      const orderedItems = content.map((item: any) => 
        `<li>${parseContentBlock(item)}</li>`
      ).join('')
      return `<ol>${orderedItems}</ol>`
    
    case 'listItem':
      const itemContent = Array.isArray(content)
        ? content.map(parseContentBlock).join('')
        : parseInlineContent(block)
      return itemContent
    
    case 'blockquote':
      const quoteContent = Array.isArray(content)
        ? content.map(parseContentBlock).join('')
        : parseInlineContent(block)
      return `<blockquote>${quoteContent}</blockquote>`
    
    case 'codeBlock':
      return `<pre><code>${text}</code></pre>`
    
    default:
      return parseInlineContent(block)
  }
}

/**
 * Parse inline content (text with formatting)
 */
function parseInlineContent(node: any): string {
  if (!node) return ''
  
  if (typeof node === 'string') {
    return node
  }
  
  if (node.text !== undefined) {
    let text = node.text
    
    // Apply formatting marks
    if (node.marks && Array.isArray(node.marks)) {
      for (const mark of node.marks) {
        switch (mark.type) {
          case 'strong':
            text = `<strong>${text}</strong>`
            break
          case 'em':
            text = `<em>${text}</em>`
            break
          case 'code':
            text = `<code>${text}</code>`
            break
          case 'link':
            const href = mark.attrs?.href || '#'
            // Keep links simple, let CSS handle styling
            text = `<a href="${href}">${text}</a>`
            break
        }
      }
    }
    
    return text
  }
  
  // If it has content array, process recursively
  if (node.content && Array.isArray(node.content)) {
    return node.content.map(parseInlineContent).join('')
  }
  
  return String(node)
}