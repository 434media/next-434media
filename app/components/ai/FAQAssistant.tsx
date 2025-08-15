"use client"

import React, { useEffect, useRef, useState } from "react"
import { useChat } from "@ai-sdk/react"
import { TextStreamChatTransport } from "ai"
import MessageBubble from "./MessageBubble"
import ChatInput from "./ChatInput"
import TypingIndicator from "./TypingIndicator"
import { motion } from "motion/react"
import { Brain, HelpCircle } from "lucide-react"

interface FAQAssistantProps {
  className?: string
  heading?: string
  description?: string
  faqs?: { question: string; label?: string }[]
}

// Utility to extract plain text from AI SDK UI messages
function getMessageText(message: any): string {
  if (!message) return ""
  if (typeof message.content === "string") return message.content
  if (typeof message.text === "string") return message.text
  const collect = (arr: any[]) =>
    arr
      .map((p: any) => {
        if (!p) return ""
        if (p.type === "text" && typeof p.text === "string") return p.text
        if (p.type === "text-delta") {
          if (typeof p.textDelta === "string") return p.textDelta
          if (typeof p.delta === "string") return p.delta
        }
        return ""
      })
      .join("")
  if (Array.isArray(message.parts)) return collect(message.parts)
  if (Array.isArray(message.content)) return collect(message.content)
  return ""
}

export const FAQAssistant: React.FC<FAQAssistantProps> = ({
  className = "",
  heading = "Ask 434 Media Anything",
  description = "Immediate, AI-powered answers sourced from our internal knowledge base. Explore capabilities, services, process, team, and how we can help accelerate your brand.",
  faqs = [
    { question: "What services does 434 Media provide?" },
    { question: "How can I start a project with 434 Media?" },
    { question: "What industries do you specialize in?" },
    { question: "Can you summarize your capabilities?" },
    { question: "How do I contact the sales team?" },
  ],
}) => {
  const { messages, status, sendMessage, error, stop } = useChat({
    transport: new TextStreamChatTransport({
      api: "/api/ai-assistant/chat",
      headers: { "Content-Type": "application/json" },
    }),
  })
  const endRef = useRef<HTMLDivElement>(null)
  const isLoading = status === "streaming"
  const [messageTimestamps, setMessageTimestamps] = useState<Record<string, number>>({})
  const nextTsRef = useRef<number>(Date.now())

  // Assign stable timestamps
  useEffect(() => {
    if (!messages) return
    setMessageTimestamps((prev) => {
      let changed = false
      const updated = { ...prev }
      for (const m of messages) {
        if (!updated[m.id]) {
          nextTsRef.current = Math.max(Date.now(), nextTsRef.current + 1)
          updated[m.id] = nextTsRef.current
          changed = true
        }
      }
      return changed ? updated : prev
    })
  }, [messages])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

  function handleAsk(q: string) {
    if (isLoading) return
    sendMessage({ text: q })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
  }

  return (
    <div className={`w-full bg-white border border-black/10 rounded-xl shadow-sm ${className}`}>      
      <div className="p-7 border-b border-black/10 bg-black text-white rounded-t-xl">
        <div className="flex flex-col md:flex-row md:items-center md:gap-6 gap-5">
          <div className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center shadow-sm ring-1 ring-white/20">
            <Brain className="w-6 h-6" />
          </div>
          <div className="space-y-3">
            <div>
              <h2 className="font-extrabold text-2xl md:text-3xl leading-tight tracking-tight">{heading}</h2>
              <p className="mt-3 text-[15px] md:text-base leading-relaxed font-medium text-white/80 max-w-3xl">{description}</p>
            </div>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {faqs.map((f) => (
            <button
              key={f.question}
              onClick={() => handleAsk(f.question)}
              disabled={isLoading}
              className="text-[11px] uppercase tracking-wide font-medium px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition disabled:opacity-40 disabled:cursor-not-allowed backdrop-blur"
            >
              {f.label || f.question}
            </button>
          ))}
        </div>
      </div>
      <div className="h-[440px] flex flex-col">
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-white">
          {messages.length === 0 && (
            <div className="text-center py-12 text-slate-500 text-sm">
              <HelpCircle className="w-8 h-8 mx-auto mb-3 text-black/60" />
              <p className="font-semibold text-black mb-1 tracking-wide">Start the conversation</p>
              <p className="text-xs max-w-sm mx-auto text-black/60">Pick a suggested question above or type your own below.</p>
            </div>
          )}
          {[...messages]
            .map((m: any) => ({
              id: m.id,
              role: m.role as 'user' | 'assistant',
              content: getMessageText(m),
              timestamp: new Date(messageTimestamps[m.id] || Date.now()),
            }))
            .map((item) => (
              <MessageBubble key={item.id} message={item} variant="bw" isStreaming={isLoading && item.id === messages[messages.length - 1]?.id && item.role === 'assistant'} />
            ))}
          {isLoading && <TypingIndicator />}
          <div ref={endRef} />
        </div>
        <div className="border-t border-black/10 p-4 bg-white">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {error && (
              <div className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{error.message}</div>
            )}
            <ChatInput
              disabled={isLoading}
              onSendMessage={(val) => handleAsk(val)}
              placeholder="Ask a question about 434 Media..."
              variant="bw"
            />
            {isLoading && (
              <button
                type="button"
                onClick={() => stop()}
                className="self-end text-xs text-slate-500 hover:text-slate-700"
              >
                Stop
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}

export default FAQAssistant
