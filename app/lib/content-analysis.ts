import type { ContentAnalysis, EmbeddedMedia } from "../types/blog-types"

export function analyzeContent(html: string): ContentAnalysis {
  // Create a temporary DOM element to parse HTML
  const tempDiv = document.createElement("div")
  tempDiv.innerHTML = html

  // Extract text content
  const textContent = tempDiv.textContent || ""
  const words = textContent
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0)

  // Count characters (excluding HTML tags)
  const characterCount = textContent.length

  // Calculate reading time (average 200 words per minute)
  const readingTime = Math.ceil(words.length / 200)

  // Count media elements
  const images = tempDiv.querySelectorAll("img").length
  const videos = tempDiv.querySelectorAll("iframe, video").length
  const mediaCount = images + videos

  // Count links
  const linkCount = tempDiv.querySelectorAll("a").length

  // Analyze heading structure
  const headingStructure = {
    h1: tempDiv.querySelectorAll("h1").length,
    h2: tempDiv.querySelectorAll("h2").length,
    h3: tempDiv.querySelectorAll("h3").length,
    h4: tempDiv.querySelectorAll("h4").length,
  }

  // Calculate basic SEO score
  const seoScore = calculateSEOScore({
    wordCount: words.length,
    headingStructure,
    mediaCount,
    linkCount,
    textContent,
  })

  // Calculate readability score (simplified Flesch Reading Ease)
  const readabilityScore = calculateReadabilityScore(textContent)

  return {
    word_count: words.length,
    character_count: characterCount,
    reading_time: readingTime,
    media_count: mediaCount,
    link_count: linkCount,
    heading_structure: headingStructure,
    seo_score: seoScore,
    readability_score: readabilityScore,
  }
}

function calculateSEOScore(data: {
  wordCount: number
  headingStructure: { h1: number; h2: number; h3: number; h4: number }
  mediaCount: number
  linkCount: number
  textContent: string
}): number {
  let score = 0

  // Word count (optimal: 300-2000 words)
  if (data.wordCount >= 300 && data.wordCount <= 2000) {
    score += 25
  } else if (data.wordCount >= 200) {
    score += 15
  }

  // Heading structure
  if (data.headingStructure.h1 === 1) score += 15 // Exactly one H1
  if (data.headingStructure.h2 >= 1) score += 15 // At least one H2
  if (data.headingStructure.h3 >= 1) score += 10 // At least one H3

  // Media presence
  if (data.mediaCount >= 1) score += 15
  if (data.mediaCount >= 3) score += 10

  // Internal/external links
  if (data.linkCount >= 1) score += 10
  if (data.linkCount >= 3) score += 10

  return Math.min(score, 100)
}

function calculateReadabilityScore(text: string): number {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0)
  const words = text.split(/\s+/).filter((w) => w.length > 0)
  const syllables = words.reduce((total, word) => total + countSyllables(word), 0)

  if (sentences.length === 0 || words.length === 0) return 0

  const avgWordsPerSentence = words.length / sentences.length
  const avgSyllablesPerWord = syllables / words.length

  // Simplified Flesch Reading Ease formula
  const score = 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord

  return Math.max(0, Math.min(100, Math.round(score)))
}

function countSyllables(word: string): number {
  word = word.toLowerCase()
  if (word.length <= 3) return 1

  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "")
  word = word.replace(/^y/, "")

  const matches = word.match(/[aeiouy]{1,2}/g)
  return matches ? matches.length : 1
}

export function extractEmbeddedMedia(html: string): EmbeddedMedia[] {
  const tempDiv = document.createElement("div")
  tempDiv.innerHTML = html
  const media: EmbeddedMedia[] = []

  // Extract images
  const images = tempDiv.querySelectorAll("img")
  images.forEach((img, index) => {
    media.push({
      id: `img_${Date.now()}_${index}`,
      type: "image",
      url: img.src,
      title: img.alt || undefined,
      description: img.title || undefined,
      embedded_at: new Date().toISOString(),
    })
  })

  // Extract videos (iframes and video elements)
  const iframes = tempDiv.querySelectorAll("iframe")
  iframes.forEach((iframe, index) => {
    try {
      const urlObj = new URL(iframe.src);
      const allowedHosts = [
        "youtube.com",
        "www.youtube.com",
        "vimeo.com",
        "www.vimeo.com"
      ];
      if (allowedHosts.includes(urlObj.hostname)) {
        media.push({
          id: `video_${Date.now()}_${index}`,
          type: "video",
          url: iframe.src,
          embedded_at: new Date().toISOString(),
        })
      }
    } catch (e) {
      // Invalid URL, skip
    }
  })

  const videos = tempDiv.querySelectorAll("video")
  videos.forEach((video, index) => {
    const source = video.querySelector("source")
    if (source) {
      media.push({
        id: `video_${Date.now()}_${index}`,
        type: "video",
        url: source.src,
        embedded_at: new Date().toISOString(),
      })
    }
  })

  return media
}
