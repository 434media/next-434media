"use client"

import type React from "react"

import { useState, useRef, type KeyboardEvent } from "react"
import { motion } from "motion/react"
import { Rocket } from "lucide-react"

interface ChatInputProps {
  onSendMessage: (content: string) => Promise<void>
  disabled: boolean
  maxLength?: number
  className?: string
}

export default function ChatInput({ onSendMessage, disabled, maxLength = 2000, className = "" }: ChatInputProps) {
  const [input, setInput] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [focused, setFocused] = useState(false)

  const handleSubmit = async () => {
    if (!input.trim() || disabled || isSubmitting) return

    const message = input.trim()
    setInput("")
    setIsSubmitting(true)

    try {
      await onSendMessage(message)
    } finally {
      setIsSubmitting(false)
    }

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)

    // Auto-resize textarea
    const textarea = e.target
    textarea.style.height = "auto"
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
  }

  const remaining = maxLength - input.length

  return (
    <div
      className={`group relative flex items-end gap-3 rounded-xl bg-white/10 backdrop-blur-sm px-4 py-3 transition-all ${
        focused ? "ring-2 ring-purple-500/60 shadow-md" : "ring-1 ring-black/10"
      } ${disabled ? "opacity-60" : ""} ${className}`}
    >
      <div className="flex-1 relative">
        <motion.textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => {
            if (e.target.value.length <= maxLength) handleInputChange(e)
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Ask our AI assistant"
          disabled={disabled || isSubmitting}
          className="w-full resize-none bg-transparent rounded-md px-1 py-1 pr-10 focus:outline-none text-sm text-slate-900 placeholder:text-slate-400 disabled:cursor-not-allowed min-h-[40px] max-h-[140px]"
          rows={1}
          style={{ lineHeight: 1.4 }}
          initial={false}
          animate={{ opacity: disabled ? 0.7 : 1 }}
        />
        <div className="absolute right-2 bottom-1 text-[10px] text-slate-400 select-none">
          {remaining < 200 ? remaining : ''}
        </div>
      </div>
      <motion.button
        whileHover={{ scale: 1.08, backgroundColor: "#4c1d95" }}
        whileTap={{ scale: 0.92 }}
        onClick={handleSubmit}
        disabled={!input.trim() || disabled || isSubmitting}
        className="relative inline-flex items-center justify-center h-10 w-10 rounded-lg bg-black text-white shadow-sm disabled:bg-slate-300 disabled:text-slate-600 transition-colors"
      >
        {isSubmitting ? (
          <div className="w-4 h-4 border-2 border-white/80 border-t-transparent rounded-full animate-spin" />
        ) : (
          <Rocket className="w-4 h-4 text-white" />
        )}
        <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
      </motion.button>
    </div>
  )
}
