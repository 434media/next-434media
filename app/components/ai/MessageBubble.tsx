"use client"

import { motion, AnimatePresence } from "motion/react"
import { useState } from "react"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import { Brain } from "lucide-react"

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
  imageBase64?: string
  imageAlt?: string
}

interface MessageBubbleProps {
  message: Message
  isStreaming?: boolean
  variant?: 'default' | 'bw'
}

export default function MessageBubble({ message, isStreaming = false, variant = 'default' }: MessageBubbleProps) {
  const [showSources, setShowSources] = useState(false)
  const isUser = message.role === "user"
  const isBW = variant === 'bw'

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 32, mass: 0.6 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div className={`max-w-[78%] ${isUser ? "order-2" : "order-1"}`}>
        <div className={`flex items-start gap-3 ${isUser ? "flex-row-reverse gap-3" : ""}`}>
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ring-1 ring-black/10 ${
              isUser ? (isBW ? 'bg-black text-white' : 'bg-black text-white') : (isBW ? 'bg-white text-black border border-black/10' : 'bg-purple-100 text-purple-700')
            }`}
          >
            {isUser ? (
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            ) : (
              <Brain className="w-4 h-4" />
            )}
          </div>
          <div className="flex-1">
            <div
              className={`relative rounded-2xl px-4 py-3 leading-relaxed text-[15px] shadow-sm backdrop-blur-sm transition-colors ${
                isUser
                  ? (isBW ? 'bg-black text-white' : 'bg-black text-white')
                  : (isBW ? 'bg-white text-black border border-black/10 shadow-sm' : 'bg-white text-slate-900 border border-purple-100/60 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)]')
              }`}
            >
              {!isUser && !isBW && (
                <motion.span
                  className="pointer-events-none absolute inset-0 rounded-2xl"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.35, 0], scale: [0.98, 1.02, 1] }}
                  transition={{ duration: 6, repeat: Number.POSITIVE_INFINITY }}
                  style={{
                    background:
                      "radial-gradient(circle at 20% 20%, rgba(168,85,247,0.18), transparent 60%), radial-gradient(circle at 80% 70%, rgba(124,58,237,0.18), transparent 65%)",
                  }}
                />
              )}
              <div className="space-y-3 relative z-10">
                {message.imageBase64 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.02 }}
                    className={`overflow-hidden rounded-lg border ${isBW ? 'border-black/20 bg-white' : 'border-purple-200/60 bg-white/40'} backdrop-blur`}
                  >
                    <img
                      src={`data:image/png;base64,${message.imageBase64}`}
                      alt={message.imageAlt || 'Generated image'}
                      className="w-full h-auto object-cover"
                      loading="lazy"
                    />
                    {message.imageAlt && (
                      <div className={`text-[11px] ${isBW ? 'text-black/60 border-black/10' : 'text-slate-500 border-purple-100/60'} px-3 py-2 border-t  bg-white/60`}>
                        {message.imageAlt}
                      </div>
                    )}
                  </motion.div>
                )}
                <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-2 prose-pre:my-3 prose-code:px-1 prose-code:py-0.5 prose-code:rounded-md prose-code:bg-slate-100 prose-code:text-slate-800 prose-li:my-0 whitespace-pre-wrap break-words">
                  {isUser ? (
                    message.content
                  ) : (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        strong: (props: any) => <strong className={`font-semibold ${isBW ? 'text-black' : 'text-slate-900'}`} {...props} />,
                        em: (props: any) => <em className={`${isBW ? 'text-black/70' : 'text-slate-700'}`} {...props} />,
                        code: ({ inline, className, children, ...rest }: any) => {
                          const lang = /language-(\w+)/.exec(className || '')?.[1]
                          return inline ? (
                            <code className="bg-slate-100 text-slate-800 px-1 py-0.5 rounded" {...rest}>{children}</code>
                          ) : (
                            <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg overflow-auto text-xs" {...rest}>
                              <code className={className}>{children}</code>
                            </pre>
                          )
                        },
                        a: (props: any) => <a className={`${isBW ? 'text-black underline decoration-black/30 hover:decoration-black' : 'text-purple-600 hover:text-purple-700 underline'}`} target="_blank" rel="noopener noreferrer" {...props} />,
                        ul: (props: any) => <ul className="list-disc ml-5 space-y-1" {...props} />,
                        ol: (props: any) => <ol className="list-decimal ml-5 space-y-1" {...props} />,
                        blockquote: (props: any) => <blockquote className={`border-l-4 ${isBW ? 'border-black/30 text-black/70' : 'border-purple-300 text-slate-700'} pl-3 italic`} {...props} />,
                        hr: () => <hr className={`my-4 ${isBW ? 'border-black/10' : 'border-purple-200/60'}`} />,
                      } as Components}
                    >
                      {message.content}
                    </ReactMarkdown>
                  )}
                  {isStreaming && (
                    <motion.span
                      animate={{ opacity: [1, 0.2, 1] }}
                      transition={{ duration: 0.9, repeat: Number.POSITIVE_INFINITY }}
                      className="inline-block w-2 h-5 bg-current ml-1 rounded-sm align-middle"
                    />
                  )}
                </div>
              </div>
            </div>
            {message.sources && message.sources.length > 0 && (
              <div className="mt-2">
                <button
                  onClick={() => setShowSources((s) => !s)}
                  className="text-xs text-slate-600 hover:text-slate-800 flex items-center space-x-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                    />
                  </svg>
                  <span>
                    {message.sources.length} source{message.sources.length !== 1 ? "s" : ""}
                  </span>
                  <svg
                    className={`w-3 h-3 transition-transform ${showSources ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <AnimatePresence initial={false}>
                  {showSources && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-2 space-y-2"
                    >
                      {message.sources.map((source, index) => (
                        <div
                          key={index}
                          className={`backdrop-blur rounded-lg p-3 text-xs shadow-sm ${isBW ? 'bg-white border border-black/10' : 'bg-white/90 border border-purple-100'}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium tracking-wide ${isBW ? 'text-black' : 'text-slate-900'}">{source.title}</span>
                            <span className="text-slate-500 font-mono text-[10px]">
                              {Math.round(source.similarity * 100)}% match
                            </span>
                          </div>
                          {source.url && (
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`${isBW ? 'text-black underline decoration-black/30 hover:decoration-black' : 'text-purple-600 hover:text-purple-700'} font-medium`}
                            >
                              View source
                            </a>
                          )}
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
            <div
              className={`text-[10px] uppercase tracking-wide font-medium text-slate-400 mt-1 ${
                isUser ? "text-right" : "text-left"
              }`}
            >
              {message.timestamp.toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
