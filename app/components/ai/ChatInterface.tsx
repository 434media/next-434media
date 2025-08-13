"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import MessageBubble from "./MessageBubble"
import ChatInput from "./ChatInput"
import TypingIndicator from "./TypingIndicator"

interface Message {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
  sources?: Array<{
    title: string
    url: string
    similarity: number
  }>
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingContent])

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      content: content.trim(),
      role: "user",
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)
    setStreamingContent("")

    try {
      const adminKey = sessionStorage.getItem("adminKey") || localStorage.getItem("adminKey")
      if (!adminKey) {
        throw new Error("No admin key found")
      }

      const response = await fetch("/api/ai-assistant/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminKey}`,
        },
        body: JSON.stringify({
          message: content,
          history: messages.slice(-5), // Send last 5 messages for context
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to get response")
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error("No response stream available")
      }

  let fullContent = ""
  let sources: Message["sources"] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = new TextDecoder().decode(value)
        const lines = chunk.split("\n")

        let hadDataEvent = false
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            hadDataEvent = true
            try {
              const data = JSON.parse(line.slice(6))
              if (data.type === "content") {
                fullContent += data.content
                setStreamingContent(fullContent)
              } else if (data.type === "sources") {
                sources = data.sources
              } else if (data.type === "done") {
                const assistantMessage: Message = {
                  id: `assistant-${Date.now()}`,
                  content: fullContent,
                  role: "assistant",
                  timestamp: new Date(),
                  sources: sources,
                }
                setMessages((prev) => [...prev, assistantMessage])
                setStreamingContent("")
                return
              }
            } catch (parseError) {
              console.error("Error parsing stream data:", parseError)
            }
          }
        }

        // Fallback: plain text streaming (no SSE)
        if (!hadDataEvent && chunk) {
          fullContent += chunk
          setStreamingContent(fullContent)
        }
      }

      // If stream ended without an explicit done event, finalize any accumulated content
      if (fullContent) {
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          content: fullContent,
          role: "assistant",
          timestamp: new Date(),
          sources: sources,
        }
        setMessages((prev) => [...prev, assistantMessage])
        setStreamingContent("")
      }
    } catch (error) {
      console.error("Chat error:", error)

      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}`,
        role: "assistant",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
      setStreamingContent("")
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-[600px]">
      {/* Header */}
      <div className="p-4 border-b border-slate-200">
        <h3 className="font-semibold text-slate-900">AI Knowledge Assistant</h3>
        <p className="text-sm text-slate-600">Ask questions about your content and get intelligent responses</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-12">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
            <h4 className="font-medium text-slate-900 mb-2">Start a conversation</h4>
            <p className="text-slate-600 text-sm max-w-md mx-auto">
              Ask me anything about your content. I can help you find information, explain concepts, or answer questions
              based on your knowledge base.
            </p>
            <div className="mt-6 space-y-2">
              <p className="text-xs text-slate-500">Try asking:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                <button
                  onClick={() => handleSendMessage("What topics are covered in the knowledge base?")}
                  className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1 rounded-full transition-colors"
                >
                  What topics are covered?
                </button>
                <button
                  onClick={() => handleSendMessage("Can you summarize the main content?")}
                  className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1 rounded-full transition-colors"
                >
                  Summarize the content
                </button>
              </div>
            </div>
          </motion.div>
        )}

        <AnimatePresence>
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </AnimatePresence>

        {/* Streaming message */}
        {streamingContent && (
          <MessageBubble
            message={{
              id: "streaming",
              content: streamingContent,
              role: "assistant",
              timestamp: new Date(),
            }}
            isStreaming={true}
          />
        )}

        {/* Typing indicator */}
        {isLoading && !streamingContent && <TypingIndicator />}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-200">
        <ChatInput onSendMessage={handleSendMessage} disabled={isLoading} />
      </div>
    </div>
  )
}
