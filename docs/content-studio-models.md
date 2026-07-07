# Content Studio — AI generation models

The curated image + video models offered in the Content Studio "Generate with AI"
picker. Source of truth: [`lib/ai-gateway-models.ts`](../lib/ai-gateway-models.ts)
(`CURATED`). All run through the **Vercel AI Gateway**; price + availability are
enriched **live** from the gateway, so the numbers below are a snapshot and the
app always shows the current price. First image + first video entry = the picker
default.

Prices are per-image where the gateway exposes a clean unit price; "usage-based"
= token/compute-metered (no flat per-asset price).

---

## Image models

### Nano Banana Lite — `google/gemini-3.1-flash-lite-image` · Google · _default_
- **Specialty:** Fast edits · **Badge:** Best value · **~$0.034/image**
- Google's fastest image model (Gemini 3.1 Flash-Lite Image). Cheapest of the
  Gemini Flash Image family — built for rapid creation, iteration, and quick edits/remixes.
- Homepage: https://deepmind.google/models/gemini/

### GPT Image 2 — `openai/gpt-image-2` · OpenAI
- **Specialty:** Text-in-image · **usage-based**
- OpenAI's versatile all-rounder — strong at rendering readable text in images,
  flexible sizes, and high-fidelity image inputs (edits).
- Homepage: https://platform.openai.com/docs/guides/image-generation

### Nano Banana Pro — `google/gemini-3-pro-image` · Google
- **Specialty:** Precise remix · **~$0.134/image**
- Studio-quality, production-ready design. Highest-fidelity edits and precise
  remixes in the Gemini image family (the premium tier vs. Lite).
- Homepage: https://deepmind.google/models/gemini/

### Recraft v4.1 — `recraft/recraft-v4.1` · Recraft
- **Specialty:** Brand & vector · **$0.035/image**
- Design-grade model tuned with designers: strong typography, brand assets, and
  **editable vector/SVG** output (logos, icons). The pick for on-brand graphics.
- Homepage: https://www.recraft.ai/

### Flux 2 Klein 9B — `bfl/flux-2-klein-9b` · Black Forest Labs
- **Specialty:** Fast & stylized · **usage-based**
- The efficient FLUX.2 tier — sub-second generation + editing in one compact
  model. Artistic/stylized raster visuals with strong quality-for-speed.
- Homepage: https://bfl.ai/models/flux-2-klein

### Grok Imagine — `xai/grok-imagine-image` · xAI
- **Specialty:** Budget · **$0.02/image** (cheapest)
- xAI's text-to-image via the imagine API — broad stylistic range (photoreal,
  concept art, anime, cyberpunk). Note: the API path is standard-moderated; the
  consumer "Spicy Mode" is app-only and not exposed here.
- Homepage: https://x.ai/

---

## Video models

### Grok Imagine 1.5 — `xai/grok-imagine-video-1.5` · xAI · _default_
- **Specialty:** Fast + audio · **Badge:** New · **per-second** (480p $0.08 / 720p $0.14 / 1080p $0.25)
- xAI's latest image-to-video model, and the video default. Native **synced audio
  in one pass** (SFX, ambience, dialogue), better **motion & real-world physics**,
  faster generation (~25s for 6s/720p), and longer **6–15s** clips (up to 1080p).
- Homepage: https://x.ai/news/grok-imagine-video-1-5

### Veo 3.1 — `google/veo-3.1-generate-001` · Google
- **Specialty:** Video + audio · **per-second**
- Google's flagship — high-fidelity 8-second clips at 720p/1080p/4k with natively
  generated audio. 16:9 / 9:16.
- Homepage: https://deepmind.google/models/veo/

### Kling 3.0 — `klingai/kling-v3.0-t2v` · Kling AI
- **Specialty:** Cinematic · **per-second**
- Smooth, cinematic motion; full multimodal (text/image/audio/video) framework.
- Homepage: https://klingai.com/

### Seedance 2.0 — `bytedance/seedance-2.0` · ByteDance
- **Specialty:** Action · **usage-based**
- Dynamic action & camera moves; unified audio-video generation. Six aspect
  ratios incl. 21:9 ultrawide, 4–15s.
- Homepage: https://seed.bytedance.com/

---

## How the picker surfaces this
Each card shows three tiers of "what it's known for":
1. **Specialty chip** — the scannable lane (e.g. "Brand & vector").
2. **Blurb** — the one-line "good for…" detail.
3. **Gateway description on hover** — the authoritative deep-dive, pulled live.

Plus an optional **badge** (e.g. "Best value") to feature a recommended model,
and the live **price** hint. To change the default, reorder `CURATED` (first of
each kind wins). To add a model, confirm its id exists on the gateway
`/v1/models` first — an id that isn't live is silently hidden.
