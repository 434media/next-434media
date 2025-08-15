"use client"

import React, { useEffect, useRef, useState } from "react"
import { useChat } from "@ai-sdk/react"
import { TextStreamChatTransport } from "ai"
import MessageBubble from "./MessageBubble"
import ChatInput from "./ChatInput"
import TypingIndicator from "./TypingIndicator"
import { motion, AnimatePresence } from "motion/react"
import { MessageCircle, X, Sparkles, Headphones } from "lucide-react"

// Extract plain text from AI SDK messages
function getMessageText(message: any): string {
  if (!message) return ""
  if (typeof message.content === "string") return message.content
  if (typeof message.text === "string") return message.text
  const collect = (arr: any[]) =>
    arr
      .map((p: any) => {
        if (!p) return ""
        if (p.type === "text" && typeof p.text === "string") return p.text
        if (p.type === "text-delta") return p.textDelta || p.delta || ""
        return ""
      })
      .join("")
  if (Array.isArray(message.parts)) return collect(message.parts)
  if (Array.isArray(message.content)) return collect(message.content)
  return ""
}

interface ChatPopupProps {
  delayMs?: number
  ctaHref?: string
  title?: string
  storageKey?: string
}

export const ChatPopup: React.FC<ChatPopupProps> = ({
  delayMs = 8000,
  ctaHref = "/contact",
  title = "Questions about 434 Media?",
  storageKey = "chatPopupDismissedAt",
}) => {
  const [open, setOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const { messages, status, sendMessage, stop, error } = useChat({
    transport: new TextStreamChatTransport({ api: "/api/ai-assistant/chat" }),
  })
  const [messageTimestamps, setMessageTimestamps] = useState<Record<string, number>>({})
  const nextTsRef = useRef<number>(Date.now())
  const isLoading = status === "streaming"
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const dismissedAt = localStorage.getItem(storageKey)
    if (dismissedAt) {
      const delta = Date.now() - parseInt(dismissedAt, 10)
      // Re-show after 6h
      if (delta < 6 * 60 * 60 * 1000) return
    }
    const t = setTimeout(() => setOpen(true), delayMs)
    return () => clearTimeout(t)
  }, [delayMs, storageKey])

  // Stable timestamps
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
  }, [messages, isLoading, minimized])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
  }

  function handleDismiss() {
    setOpen(false)
    localStorage.setItem(storageKey, Date.now().toString())
  }

  return (
    <>
      {/* Floating button when closed */}
      <AnimatePresence>
        {!open && (
          <motion.button
            key="fab"
            initial={{ opacity: 0, scale: 0.8, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-6 right-6 z-40 bg-neutral-950 hover:bg-neutral-700 text-white rounded-full shadow-lg w-14 h-14 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
            aria-label="Open chat assistant"
          >
            <MessageCircle className="w-6 h-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Popup Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className="fixed bottom-6 right-6 z-50 w-[340px] sm:w-[380px] bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            role="dialog"
            aria-modal="true"
          >
            <div className="p-4 bg-black text-white flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-white text-black flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-[13px] leading-tight mb-1 tracking-tight">{title}</h3>
                <p className="text-[11px] leading-snug text-white/70">Ask anything. I use our internal knowledge base to help.</p>
              </div>
              <button
                onClick={handleDismiss}
                className="text-white/70 hover:text-white transition"
                aria-label="Dismiss chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className={`flex-1 flex flex-col ${minimized ? "h-0 invisible" : "h-72"}`}>
              <div className="flex-1 overflow-y-auto p-4 space-y-4" aria-live="polite">
                {messages.length === 0 && !isLoading && (
                  <div className="text-center text-xs text-black/60 pt-4">
                    <p className="font-semibold text-black mb-1 tracking-wide">Hi there 👋</p>
                    <p>Need help learning about 434 Media? Just ask.</p>
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
                    <MessageBubble key={item.id} message={item} variant="bw" />
                  ))}
                {isLoading && <TypingIndicator />}
                <div ref={endRef} />
              </div>
              <div className="border-t border-slate-200 p-3">
                <form onSubmit={handleSubmit} className="space-y-2">
                  {error && (
                    <div className="text-[11px] text-red-600 bg-red-50 px-2 py-1 rounded">{error.message}</div>
                  )}
                  <ChatInput
                    disabled={isLoading}
                    onSendMessage={(val) => {
                      sendMessage({ text: val })
                      setMinimized(false)
                    }}
                    placeholder="Ask a question..."
                    className="text-sm"
                    variant="bw"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <a
                      href={ctaHref}
                      className="flex items-center gap-1.5 text-[11px] font-medium text-black hover:text-black bg-black/5 hover:bg-black/10 rounded px-2 py-1 transition"
                    >
                      <Headphones className="w-3.5 h-3.5" /> Contact Sales
                    </a>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setMinimized((m) => !m)}
                        className="text-[11px] text-black/60 hover:text-black px-2 py-1 rounded hover:bg-black/5"
                      >
                        {minimized ? "Expand" : "Minimize"}
                      </button>
                      {isLoading && (
                        <button
                          type="button"
                          onClick={() => stop()}
                          className="text-[11px] text-black/60 hover:text-black px-2 py-1 rounded hover:bg-black/5"
                        >
                          Stop
                        </button>
                      )}
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default ChatPopup
