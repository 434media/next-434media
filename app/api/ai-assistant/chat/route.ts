import { openai } from "@ai-sdk/openai"
import { streamText } from "ai"
import { z } from "zod"
import { searchKnowledgeBase } from "../../../lib/knowledge-base"
import { convertToModelMessages } from "ai"

export const maxDuration = 30

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()

    console.log("Chat API called with messages:", messages.length)

    // Extract latest user question for manual KB search
    const lastUser = [...messages].reverse().find((m: any) => m.role === "user")
    const userText = typeof lastUser?.content === "string"
      ? lastUser.content
      : (lastUser?.parts || [])
          .filter((p: any) => p.type === "text" && typeof p.text === "string")
          .map((p: any) => p.text)
          .join("")

    let kbContext = ""
    if (userText && userText.trim().length > 2) {
      try {
        console.log("Manual KB search for user query:", userText)
        const results = await searchKnowledgeBase(userText)
        if (results.length > 0) {
          const top = results.slice(0, 5)
          kbContext = top
            .map(
              (r, i) =>
                `Source ${i + 1}: ${r.title}\n${r.content.substring(0, 600)}${r.content.length > 600 ? "..." : ""}`,
            )
            .join("\n---\n")
        } else {
          kbContext = "(No relevant knowledge base documents were found for this query.)"
        }
      } catch (e) {
        console.warn("KB search failed:", e)
        kbContext = "(Knowledge base search failed; proceed with general knowledge.)"
      }
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY missing in environment (production?) returning explanatory message")
      return new Response("OpenAI API key not configured on server.")
    }

    const result = streamText({
      model: openai("gpt-4o"),
      messages: convertToModelMessages(messages),
  system: `You are a helpful AI assistant with access to an internal knowledge base. Always answer conversationally.\n\nKnowledge Base Context (may be empty):\n${kbContext}\n\nInstructions:\n- If context provided, synthesize it into a natural answer and cite document titles inline.\n- If context says no docs found, be transparent and still provide a helpful general answer.\n- Be concise but thorough.\n- The platform can generate images separately AFTER your reply. If the user requests or implies they want an image, DO NOT say you cannot create images. Provide: (1) a brief creative description / concept (<= 4 sentences), (2) optionally 3 concise variation bullet points. Avoid apologetic language or disclaimers about not generating images.\n- Never output phrases like "I can't create images" or "I cannot generate images".\n- Keep stylistic tone consistent with brand: confident, clear, no fluff.`,
    })

    console.log("Streaming response created successfully")

  // Return text stream so the client hook can construct assistant messages and tool events
  const response = result.toTextStreamResponse()
  // If the model produces no tokens some clients show empty bubble; add header marker
  return new Response(response.body, {
    headers: {
      ...Object.fromEntries(response.headers.entries()),
      'x-ai-route': 'chat',
    },
    status: response.status,
    statusText: response.statusText,
  })
  } catch (error) {
    console.error("Chat API error:", error)
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    )
  }
}
