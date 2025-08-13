import type { Metadata } from "next"
import AIAssistantClientPage from "./AIAssistantClientPage"

// Auto-sync on app startup
import { autoSyncOnStartup } from "../../lib/knowledge-base"

export const metadata: Metadata = {
  title: "AI Assistant - 434 MEDIA RAG (Retrieval-Augmented Generation) Chatbot",
  description: "Interact with the AI Assistant powered by 434 MEDIA, OpenAI, and the AI SDK",
}

// Initialize auto-sync (runs once on server start)
if (typeof window === "undefined") {
  autoSyncOnStartup().catch(console.error)
}

export default function AIAssistantPage() {
  return <AIAssistantClientPage />
}
