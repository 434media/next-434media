import { NextResponse } from "next/server"
import { getProducts } from "@/app/lib/shopify"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")

  if (!query) {
    return NextResponse.json({ products: [] })
  }

  try {
    const products = await getProducts({ query })
    return NextResponse.json({ products })
  } catch (error) {
    console.error("Error searching products:", error)
    return NextResponse.json({ products: [], error: "Failed to search products" }, { status: 500 })
  }
}
