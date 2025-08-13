"use client"

import type React from "react"

import { useChat } from "@ai-sdk/react"
// Use a text stream transport because the server returns result.toTextStreamResponse()
// DefaultChatTransport expects a UI message chunk stream; with a plain text stream
// it won't construct assistant messages, so we switch to TextStreamChatTransport.
import { TextStreamChatTransport } from "ai"
import { useState, useEffect } from "react"
import { Button } from "../../components/analytics/Button"
import { Input } from "../../components/analytics/Input"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../../components/analytics/Card"
import { Badge } from "../../components/analytics/Badge"
import {
  Loader2,
  Database,
  ImageIcon,
  Bot,
  User,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Clock,
  Search,
  XCircle,
} from "lucide-react"
import Image from "next/image"
import { motion, AnimatePresence } from "motion/react"

export default function ChatbotApp() {
  // Centralize API route (actual route lives at app/api/ai-assistant/ingest/route.ts)
  const INGEST_API = "/api/ai-assistant/ingest"
  const [input, setInput] = useState("")

  const { messages, status, error, sendMessage, stop } = useChat({
    transport: new TextStreamChatTransport({
      api: "/api/ai-assistant/chat",
      headers: {
        "Content-Type": "application/json",
      },
    }),
    onError: (error) => {
      console.error("Chat error:", error)
    },
    onFinish: (message) => {
      console.log("Message finished:", message)
      // Debug: confirm assistant message appended
      console.log("All messages after finish:", messages)
    },
  })

  const [isIngesting, setIsIngesting] = useState(false)
  const [ingestStatus, setIngestStatus] = useState<string>("")
  const [syncInfo, setSyncInfo] = useState<any>(null)

  const isLoading = status === "streaming"

  useEffect(() => {
    loadSyncStatus()
  }, [])

  const loadSyncStatus = async () => {
    try {
  console.log("Loading sync status from", INGEST_API, "...")
  const response = await fetch(INGEST_API, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })

      console.log("Sync status response:", response.status, response.statusText)

      if (!response.ok) {
        console.warn(`Sync status not available: HTTP ${response.status}`)
        setSyncInfo(null)
        return
      }

      const data = await response.json()
      console.log("Sync status data:", data)
      setSyncInfo(data)
    } catch (error) {
      console.warn("Sync status unavailable:", error)
      setSyncInfo({
        syncStatus: null,
        stats: { totalPages: 0 },
      })
    }
  }

  const handleIngestNotion = async () => {
    setIsIngesting(true)
    setIngestStatus("Starting ingestion...")

    try {
      console.log("Making POST request to", INGEST_API, "...")
      const response = await fetch(INGEST_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      console.log("Ingest response:", response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error("Ingest error response:", errorText)
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      const contentType = response.headers.get("content-type") || ""
      if (!contentType.includes("application/json")) {
        const bodyText = await response.text()
        console.error("Unexpected non-JSON ingest response body:", bodyText.slice(0, 500))
        throw new Error("Unexpected non-JSON response from ingest endpoint")
      }
      const data = await response.json()
      console.log("Ingest success:", data)
      setIngestStatus(data.message || "Ingestion completed!")

      await loadSyncStatus()
    } catch (error) {
      console.error("Ingestion error:", error)
      setIngestStatus(`Error: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsIngesting(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    sendMessage({
      text: input,
    })

    setInput("")
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
  }

  const handleClearError = () => {
    console.log("Error cleared")
  }

  const handleStop = () => {
    stop()
  }

  // Extract readable text from AI SDK UIMessage shapes (supports parts[] and content[] arrays)
  const getMessageText = (message: any): string => {
    if (!message) return ""
    // Direct string content fallback
    if (typeof message.content === "string") return message.content
    if (typeof message.text === "string") return message.text

    const collect = (arr: any[]) =>
      arr
        .map((p: any) => {
          if (!p) return ""
          // Stable text part
            if (p.type === "text" && typeof p.text === "string") return p.text
          // Streaming delta: AI SDK transformTextToUiMessageStream uses 'delta' field, not 'textDelta'
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

  // Debug: log messages to inspect part shapes while developing
  useEffect(() => {
    if (messages.length > 0) {
      console.debug("[AI Debug] Latest messages:", messages.map(m => ({ id: m.id, role: m.role, parts: m.parts?.map((p:any)=>({ type: p.type, keys: Object.keys(p) })) })))
    }
  }, [messages])

  const renderSyncStatus = () => {
    if (!syncInfo?.syncStatus) return null

    const { syncStatus, stats } = syncInfo
    const isRecent = syncStatus.lastSync && Date.now() - new Date(syncStatus.lastSync).getTime() < 24 * 60 * 60 * 1000

    return (
      <div className="flex items-center space-x-2 text-xs">
        {syncStatus.status === "success" && (
          <>
            <CheckCircle className="w-3 h-3 text-green-500" />
            <span className="text-green-600">
              {stats.totalPages} pages • Last sync: {new Date(syncStatus.lastSync).toLocaleString()}
            </span>
          </>
        )}
        {syncStatus.status === "error" && (
          <>
            <AlertCircle className="w-3 h-3 text-red-500" />
            <span className="text-red-600">Sync failed</span>
          </>
        )}
        {syncStatus.status === "in-progress" && (
          <>
            <Clock className="w-3 h-3 text-blue-500" />
            <span className="text-blue-600">Syncing...</span>
          </>
        )}
        {!isRecent && syncStatus.status === "success" && (
          <Badge variant="outline" className="text-orange-600 border-orange-200">
            Sync recommended
          </Badge>
        )}
      </div>
    )
  }

  const renderMessage = (message: any, index: number) => {
    const isUser = message.role === "user"

    return (
      <motion.div
        key={message.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: index * 0.1 }}
        className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}
      >
        <div className={`flex items-start space-x-2 max-w-[85%] ${isUser ? "flex-row-reverse space-x-reverse" : ""}`}>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.2, delay: index * 0.1 + 0.1 }}
            className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              isUser ? "bg-blue-500" : "bg-slate-600"
            }`}
          >
            {isUser ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, delay: index * 0.1 + 0.2 }}
            className={`rounded-lg p-3 ${isUser ? "bg-blue-500 text-white" : "bg-slate-50 text-slate-900 border border-slate-200"}`}
          >
            {message.toolInvocations?.some((t: any) => t.toolName === "searchKnowledgeBase") && !isUser && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center space-x-1 text-xs text-blue-600 mb-2 opacity-70"
              >
                <Search className="w-3 h-3" />
                <span>Searched knowledge base</span>
              </motion.div>
            )}

            {message.toolInvocations?.map((toolInvocation: any, toolIndex: number) => {
              if (toolInvocation.toolName === "generateImage" && toolInvocation.result) {
                if (toolInvocation.result.success && toolInvocation.result.image) {
                  return (
                    <motion.div
                      key={toolIndex}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3 }}
                      className="mb-3"
                    >
                      <div className="flex items-center space-x-2 mb-2">
                        <ImageIcon className="w-4 h-4" />
                        <span className="text-sm font-medium">Generated Image</span>
                      </div>
                      <motion.div whileHover={{ scale: 1.05 }} transition={{ duration: 0.2 }}>
                        <Image
                          src={`data:image/png;base64,${toolInvocation.result.image}`}
                          alt={toolInvocation.result.prompt}
                          width={256}
                          height={256}
                          className="rounded-lg shadow-sm"
                        />
                      </motion.div>
                      <p className="text-xs mt-1 opacity-70">Prompt: {toolInvocation.result.prompt}</p>
                    </motion.div>
                  )
                }

                if (!toolInvocation.result.success && toolInvocation.result.error) {
                  return (
                    <motion.div
                      key={toolIndex}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3 }}
                      className="mb-3"
                    >
                      <div className="flex items-center space-x-2 mb-2">
                        <XCircle className="w-4 h-4 text-red-500" />
                        <span className="text-sm font-medium text-red-600">Image Generation Failed</span>
                      </div>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <p className="text-sm text-red-700 mb-1">Unable to generate image</p>
                        <p className="text-xs text-red-600">Error: {toolInvocation.result.error}</p>
                        <p className="text-xs text-red-500 mt-1">Prompt: {toolInvocation.result.prompt}</p>
                      </div>
                    </motion.div>
                  )
                }
              }
              return null
            })}

            {(() => {
              const text = getMessageText(message)
              if (text && text.trim().length > 0) {
                return <div className="whitespace-pre-wrap leading-relaxed">{text}</div>
              }
              // Debug fallback: show compact raw structure when no text extracted
              const debugEnabled = process.env.NEXT_PUBLIC_AI_DEBUG === "true"
              const truncate = (v: any, len = 120) => {
                if (typeof v !== "string") return v
                return v.length > len ? v.slice(0, len) + "…" : v
              }
              if (!debugEnabled) {
                return (
                  <div className="text-xs italic text-slate-400">(No response text produced by model)</div>
                )
              }
              const compact = {
                id: message.id,
                role: message.role,
                keys: Object.keys(message || {}),
                parts: Array.isArray(message.parts)
                  ? message.parts.map((p: any) => ({
                      type: p.type,
                      state: p.state,
                      text: truncate(p.text),
                      delta: truncate(p.delta),
                      textDelta: truncate(p.textDelta),
                      providerMetadata: p.providerMetadata ? Object.keys(p.providerMetadata) : undefined,
                    }))
                  : undefined,
                content: Array.isArray(message.content)
                  ? message.content.map((p: any) => ({ type: p.type, keys: Object.keys(p) }))
                  : undefined,
              }
              return (
                <div className="text-xs text-slate-500 whitespace-pre-wrap leading-relaxed">
                  <em>(no text extracted)</em> {JSON.stringify(compact, null, 2)}
                </div>
              )
            })()}

            {message.toolInvocations?.map((toolInvocation: any, toolIndex: number) => {
              if (
                toolInvocation.toolName === "searchKnowledgeBase" &&
                toolInvocation.result?.found &&
                toolInvocation.result?.sources
              ) {
                return (
                  <motion.div
                    key={toolIndex}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.2 }}
                    className="mt-3 pt-3 border-t border-slate-200"
                  >
                    <div className="text-xs text-slate-500 mb-2">Sources:</div>
                    <div className="space-y-1">
                      {toolInvocation.result.sources.slice(0, 3).map((source: any, sourceIndex: number) => (
                        <div key={sourceIndex} className="flex items-center justify-between text-xs">
                          <span className="text-slate-600 truncate flex-1">{source.title}</span>
                          {source.url && (
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:text-blue-700 ml-2 flex-shrink-0"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )
              }
              return null
            })}
          </motion.div>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="min-h-screen bg-white p-4">
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Card className="mb-4 bg-white border border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-slate-900">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                >
                  <Bot className="w-6 h-6 text-blue-500" />
                </motion.div>
                <span>AI Knowledge Assistant</span>
              </CardTitle>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Button onClick={handleIngestNotion} disabled={isIngesting} variant="outline" size="sm">
                    {isIngesting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <Database className="w-4 h-4 mr-2" />
                        Sync Notion Data
                      </>
                    )}
                  </Button>
                  <AnimatePresence>
                    {ingestStatus && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                          {ingestStatus}
                        </Badge>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                {renderSyncStatus()}
              </div>
            </CardHeader>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="h-[70vh] flex flex-col bg-white border border-slate-200 shadow-sm">
            <CardContent className="flex-1 overflow-y-auto p-6">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between"
                >
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <span className="text-sm text-red-700">Error: {error.message}</span>
                  </div>
                  <Button onClick={handleClearError} variant="ghost" size="sm">
                    Clear
                  </Button>
                </motion.div>
              )}

              <AnimatePresence>
                {messages.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-center text-slate-600 mt-8"
                  >
                    <motion.div
                      animate={{ y: [0, -10, 0] }}
                      transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                    >
                      <Bot className="w-12 h-12 mx-auto mb-4 text-blue-500 opacity-70" />
                    </motion.div>
                    <p className="text-lg font-medium mb-2 text-slate-900">Welcome to your AI Knowledge Assistant!</p>
                    <p className="text-sm">
                      I can help you with information from your Notion knowledge base and generate images.
                    </p>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      className="mt-4 text-xs space-y-1"
                    >
                      <p>• Ask questions about your team, processes, or company info</p>
                      <p>• Request image generation with "generate an image of..."</p>
                      <p>• I'll give you conversational answers using your internal docs</p>
                      <p className="font-medium text-blue-600">
                        Try: "Who are our team members?" or "Generate a company logo"
                      </p>
                      {syncInfo?.stats?.totalPages > 0 && (
                        <p className="text-green-600 font-medium">
                          ✅ {syncInfo.stats.totalPages} pages ready for search
                        </p>
                      )}
                    </motion.div>
                  </motion.div>
                ) : (
                  <div className="space-y-4">{messages.map(renderMessage)}</div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="flex justify-start mb-4"
                  >
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center">
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                        <div className="flex items-center space-x-2">
                          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                          <span className="text-sm text-slate-700">Searching and thinking...</span>
                          <Button onClick={handleStop} variant="ghost" size="sm" className="ml-2">
                            Stop
                          </Button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>

            <CardFooter className="border-t border-slate-200 bg-white">
              <form onSubmit={handleSubmit} className="flex w-full space-x-2">
                <Input
                  value={input}
                  onChange={handleInputChange}
                  placeholder="Ask me about your team, company processes, or request an image..."
                  className="flex-1 border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                  disabled={isLoading}
                />
                <motion.div whileTap={{ scale: 0.95 }}>
                  <Button type="submit" disabled={isLoading || !input.trim()} className="bg-blue-500 hover:bg-blue-600">
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send"}
                  </Button>
                </motion.div>
              </form>
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
