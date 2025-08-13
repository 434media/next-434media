import OpenAI from "openai"

export const maxDuration = 60

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

interface RequestBody {
  prompt: string
  size?: "1024x1024" | "1024x1792" | "1792x1024"
  quality?: "standard" | "hd"
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "Server missing OPENAI_API_KEY" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }

    const body = (await req.json()) as Partial<RequestBody>
    const prompt = (body.prompt || "").trim()
    if (!prompt) {
      return new Response(JSON.stringify({ error: "Prompt required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

  const allowedSizes: RequestBody["size"][] = ["1024x1024", "1024x1792", "1792x1024"]
  const size = allowedSizes.includes(body.size as any) ? (body.size as any) : "1024x1024"
    const quality = body.quality || "standard"

    const result = await client.images.generate({
      model: "dall-e-3",
      prompt,
      size,
      quality,
      n: 1,
      response_format: "b64_json",
    })

    const image = result.data?.[0]
    if (!image?.b64_json) {
      return new Response(
        JSON.stringify({ error: "No image data returned", raw: result }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        prompt,
        size,
        quality,
        image: image.b64_json,
        revisedPrompt: image.revised_prompt,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )
  } catch (error) {
    console.error("Image generation error:", error)
    return new Response(
      JSON.stringify({ error: "Image generation failed", details: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    )
  }
}
