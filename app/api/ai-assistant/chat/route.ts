import { openai } from "@ai-sdk/openai"
import { streamText, tool } from "ai"
import { z } from "zod"
import { searchKnowledgeBase } from "../../../lib/knowledge-base"
import { convertToModelMessages } from "ai"

export const maxDuration = 30

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()

    console.log("Chat API called with messages:", messages.length)

    const result = streamText({
      model: openai("gpt-4o"),
      // Convert UIMessage[] from client to Core/Model messages expected by streamText
      messages: convertToModelMessages(messages),
      system: `You are a helpful AI assistant with access to an internal knowledge base and image generation capabilities.

CRITICAL INSTRUCTIONS FOR CONVERSATIONAL RESPONSES:

1. **Always be conversational and natural** - Don't just list information, engage like a helpful colleague
2. **When you search the knowledge base and find relevant information:**
   - Use that information to provide a comprehensive, conversational answer
   - Synthesize the information from multiple sources if available
   - Speak naturally as if you're explaining to a coworker
   - Don't just show links or raw data - incorporate the content into your response

3. **Knowledge Base Usage:**
   - Search the knowledge base for ANY question that might relate to company information
   - Use the actual content from the search results to answer questions
   - If you find team member information, present it conversationally (e.g., "Based on our internal docs, our team includes...")
   - Always cite sources naturally (e.g., "According to the [Document Name]...")

4. **Response Style:**
   - Be friendly and helpful
   - Provide context and explanations
   - Use the person's name if mentioned in the documents
   - Give complete answers, not just fragments

5. **When no relevant information is found:**
   - Clearly state you couldn't find specific information in the knowledge base
   - Offer to help in other ways or suggest they might need to sync more recent data

6. **For Image Generation:**
   - When asked to generate images about the company, first search the knowledge base to understand the company better
   - Use that information to create more relevant and accurate image prompts
   - If you can't find company information, generate a generic professional image

Example good response: "Based on our team directory, we have several key team members including John Smith who works as our Lead Developer, and Sarah Johnson who handles Marketing. According to the documentation, John has been with the company for 3 years and specializes in React development..."`,
      tools: {
        searchKnowledgeBase: tool({
          description:
            "Search the internal knowledge base for relevant information. Use this for ANY question about the company, team, processes, or internal information.",
          inputSchema: z.object({
            query: z.string().describe("The search query to find relevant information"),
          }),
          execute: async ({ query }) => {
            try {
              console.log("Searching knowledge base for:", query)
              const results = await searchKnowledgeBase(query)
              console.log("Knowledge base search results:", results.length)

              if (results.length === 0) {
                return {
                  query,
                  found: false,
                  message: "No relevant information found in the knowledge base for this query.",
                }
              }

              // Format the content for conversational use
              const contentSummary = results
                .map((result, index) => {
                  return `**Source ${index + 1}: ${result.title}**\n${result.content.substring(0, 1000)}${result.content.length > 1000 ? "..." : ""}\n`
                })
                .join("\n---\n")

              return {
                query,
                found: true,
                resultsCount: results.length,
                contentSummary,
                sources: results.map((r) => ({
                  title: r.title,
                  url: r.url,
                  relevanceScore: r.relevanceScore,
                })),
                instruction:
                  "Use this information to provide a comprehensive, conversational response. Don't just list the sources - synthesize the information into a natural answer.",
              }
            } catch (error) {
              console.error("Error in searchKnowledgeBase tool:", error)
              return {
                query,
                found: false,
                message: "Error occurred while searching the knowledge base.",
              }
            }
          },
        }),
        generateImage: tool({
          description:
            "Generate an image using DALL-E 3. For company-related images, search the knowledge base first to get context.",
          inputSchema: z.object({
            prompt: z.string().describe("The prompt to generate the image from"),
            style: z.enum(["natural", "vivid"]).default("vivid").describe("The style of the image"),
          }),
          execute: async ({ prompt, style }) => {
            try {
              console.log("🎨 Starting image generation with prompt:", prompt)
              console.log("🎨 Style:", style)
              console.log("🔑 API Key present:", !!process.env.OPENAI_API_KEY)

              // Validate API key
              if (!process.env.OPENAI_API_KEY) {
                throw new Error("OpenAI API key is not configured")
              }

              const requestBody = {
                model: "dall-e-3",
                prompt: prompt,
                n: 1,
                size: "1024x1024" as const,
                style: style,
                response_format: "b64_json" as const,
              }

              console.log("🚀 Making request to OpenAI API...")

              const response = await fetch("https://api.openai.com/v1/images/generations", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(requestBody),
              })

              console.log("📡 API Response status:", response.status)

              if (!response.ok) {
                const errorText = await response.text()
                console.error("❌ API Error Response:", errorText)

                let errorMessage = "Failed to generate image"
                try {
                  const errorData = JSON.parse(errorText)
                  errorMessage = errorData.error?.message || errorMessage
                } catch {
                  // If we can't parse the error, use the status text
                  errorMessage = `API Error: ${response.status} ${response.statusText}`
                }

                throw new Error(errorMessage)
              }

              const data = await response.json()
              console.log("📦 API Response received")

              // Check if we have the expected response structure
              if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
                console.error("❌ Unexpected API response structure:", data)
                throw new Error("Invalid response format from OpenAI API")
              }

              const imageData = data.data[0]
              if (!imageData.b64_json) {
                console.error("❌ No b64_json in response:", imageData)
                throw new Error("No image data received from OpenAI API")
              }

              console.log("✅ Image generated successfully")

              return {
                image: imageData.b64_json,
                prompt: prompt,
                style: style,
                success: true,
              }
            } catch (error) {
              console.error("❌ Image generation error:", error)

              // Return a structured error response instead of throwing
              return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error occurred",
                prompt: prompt,
                style: style,
              }
            }
          },
        }),
      },
    })

    console.log("Streaming response created successfully")

  // Return text stream so the client hook can construct assistant messages and tool events
  return result.toTextStreamResponse()
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
