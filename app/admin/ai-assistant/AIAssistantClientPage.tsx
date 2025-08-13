"use client"

import React, { useRef } from "react"
import { AIChatbotHeader } from "../../components//ai/AIChatbotHeader"
import { useChat } from "@ai-sdk/react"
import { TextStreamChatTransport } from "ai"
import { useState, useEffect } from "react"
import { Button } from "../../components/analytics/Button"
import { Card, CardContent, CardFooter } from "../../components/analytics/Card"
import { Badge } from "../../components/analytics/Badge"
import { Loader2, Brain, AlertCircle, CheckCircle, Clock } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import MessageBubble from "../../components/ai/MessageBubble"
import TypingIndicator from "../../components/ai/TypingIndicator"
import ChatInput from "../../components/ai/ChatInput"

export default function ChatbotApp() {
  const API_BASE = "/api/ai-assistant"
  const INGEST_API = `${API_BASE}/ingest`
  const [input, setInput] = useState("")

  const pendingImageIntentRef = useRef<string | null>(null)
  const { messages, status, error, sendMessage, stop } = useChat({
    transport: new TextStreamChatTransport({
      api: `${API_BASE}/chat`,
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
      // If there is a pending image intent, create placeholder AFTER assistant reply
      if (pendingImageIntentRef.current) {
        const prompt = pendingImageIntentRef.current
        pendingImageIntentRef.current = null
        // Ensure assistant message has timestamp assigned (if not yet, we approximate)
        const assistantTs = Date.now()
        const placeholderId = `img-${assistantTs}-${Math.random().toString(36).slice(2,8)}`
        setSyntheticMessages(prev => [
          ...prev,
          {
            id: placeholderId,
            role: 'assistant',
            prompt,
            status: 'generating',
            createdAt: assistantTs + 1, // always after assistant
          },
        ])
        generateImage(prompt, placeholderId)
      }
    },
  })

  const [isIngesting, setIsIngesting] = useState(false)
  const [ingestStatus, setIngestStatus] = useState<string>("")
  const [syncInfo, setSyncInfo] = useState<any>(null)
  interface SyntheticMessage {
    id: string
    role: 'assistant'
    prompt: string
    status: 'generating' | 'done' | 'error'
    imageBase64?: string
    imageAlt?: string
    error?: string
    createdAt: number // epoch ms for stable ordering
  }
  const [syntheticMessages, setSyntheticMessages] = useState<SyntheticMessage[]>([])
  const [messageTimestamps, setMessageTimestamps] = useState<Record<string, number>>({})
  const nextTimestampRef = useRef<number>(Date.now())

  // Assign stable timestamps to base messages once
  useEffect(() => {
    if (!messages) return
    setMessageTimestamps(prev => {
      let changed = false
      const updated = { ...prev }
      for (const m of messages) {
        if (!updated[m.id]) {
          nextTimestampRef.current = Math.max(Date.now(), nextTimestampRef.current + 1)
          updated[m.id] = nextTimestampRef.current
          changed = true
        }
      }
      return changed ? updated : prev
    })
  }, [messages])

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

  const handleClearChat = () => {
    // Clear messages by reloading or implementing a clear function
    window.location.reload()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    processUserInput(input.trim())
    setInput("")
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
  }

  const imagePromptRegex = /(generate|create|make|design)\s+(an?\s+)?(image|logo|icon|illustration|graphic|picture|art|painting)/i

  async function processUserInput(raw: string) {
    const wantsImage = imagePromptRegex.test(raw)
    sendMessage({ text: raw })
    if (wantsImage) {
      pendingImageIntentRef.current = raw
    }
  }

  async function generateImage(prompt: string, placeholderId: string) {
    console.debug('[IMG] start generation', { prompt, placeholderId })
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 65000)
    try {
      let res = await fetch('/api/ai-assistant/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }), // default server size 1024x1024 (dall-e-3 requirement)
        signal: controller.signal,
      })
      if (!res.ok && res.status === 400) {
        // Retry with square size explicitly if first attempt failed (defensive)
        try {
          const firstErr = await res.json().catch(() => ({}))
          console.warn('[IMG] first attempt 400, retrying with explicit 1024x1024', firstErr)
        } catch {}
        res = await fetch('/api/ai-assistant/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, size: '1024x1024' }),
          signal: controller.signal,
        })
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      console.debug('[IMG] success', { placeholderId, bytes: data.image?.length })
  setSyntheticMessages(prev => prev.map(m => m.id === placeholderId ? { ...m, status: 'done', imageBase64: data.image, imageAlt: data.revisedPrompt || prompt } : m))
    } catch (e) {
      console.warn('[IMG] failed', e)
  setSyntheticMessages(prev => prev.map(m => m.id === placeholderId ? { ...m, status: 'error', error: e instanceof Error ? e.message : 'Unknown error' } : m))
    } finally {
      clearTimeout(timeout)
    }
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
      console.debug(
        "[AI Debug] Latest messages:",
        messages.map((m) => ({
          id: m.id,
          role: m.role,
          parts: m.parts?.map((p: any) => ({ type: p.type, keys: Object.keys(p) })),
        })),
      )
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

  // New message rendering handled by MessageBubble component

  return (
  <div className="min-h-screen bg-white p-4 mt-32 md:mt-16">
      <div className="max-w-5xl mx-auto">
        <AIChatbotHeader
          onSyncNotion={handleIngestNotion}
          isLoading={isLoading}
          isSyncing={isIngesting}
          syncStatus={ingestStatus}
          lastSync={syncInfo?.syncStatus?.lastSync || null}
        />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="h-[70vh] flex flex-col bg-white shadow-none rounded-xl border-none">
            <CardContent className="flex-1 overflow-y-auto p-2 sm:p-4 md:p-6">
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

              <div className="space-y-4">
                {[
                  ...messages.map((m: any) => ({
                    id: m.id,
                    role: m.role as 'user' | 'assistant',
                    content: getMessageText(m),
                    createdAt: messageTimestamps[m.id] || Date.now(),
                  })),
                  ...syntheticMessages.map(sm => ({
                    id: sm.id,
                    role: 'assistant' as const,
                    content: sm.status === 'generating' ? `Generating image: "${sm.prompt}" ...` : sm.status === 'error' ? `Image generation failed: ${sm.error}` : `Image generated for: ${sm.prompt}`,
                    createdAt: sm.createdAt,
                    imageBase64: sm.imageBase64,
                    imageAlt: sm.imageAlt,
                    isStreaming: sm.status === 'generating',
                  })),
                ]
                  .sort((a, b) => a.createdAt - b.createdAt)
                  .map(item => (
                    <MessageBubble
                      key={item.id}
                      message={{
                        id: item.id,
                        role: item.role,
                        content: item.content,
                        timestamp: new Date(item.createdAt),
                        imageBase64: (item as any).imageBase64,
                        imageAlt: (item as any).imageAlt,
                      }}
                      isStreaming={(item as any).isStreaming}
                    />
                  ))}
                {isLoading && <TypingIndicator />}
              </div>

              <AnimatePresence>
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="flex justify-start mb-4"
                  >
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-full bg-purple-700 flex items-center justify-center">
                        <Brain className="w-4 h-4 text-white" />
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-purple-200 shadow-sm">
                        <div className="flex items-center space-x-2">
                          <Loader2 className="w-4 animate-spin text-purple-600" />
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
            <CardFooter className="bg-transparent pt-2">
              <form onSubmit={handleSubmit} className="w-full">
                <ChatInput
                  disabled={isLoading}
                  onSendMessage={async (val) => {
                    processUserInput(val)
                  }}
                  className="w-full"
                />
              </form>
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
