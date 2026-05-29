# VemosVamos Validated Higgsfield Prompts

Prompts that have been tested against the Higgsfield CLI and produced output aligned with the VemosVamos brand DNA (see `docs/brand/vemosvamos-brand-system.md`). These are the canonical starting points for re-generation, hi-fi passes, or extension to new assets.

**All prompts below were validated at low-fidelity (`gpt_image_2`, `--resolution 1k --quality low`, ~0.5 credits per run) to confirm visual direction before committing to a hi-fi production pass.**

---

## Asset 1 — Editorial Street-Scene Hero (16:9)

**Use case:** Website hero background, social Reel still frame, campaign key art.

**Visual direction confirmed:** Hand-painted bilingual mural anchors the right two-thirds; bicultural figures walk through the foreground; warm South Texas golden-hour light; left negative space for headline overlay.

**Lo-fi run config**
- Model: `gpt_image_2`
- `--aspect_ratio 16:9 --resolution 1k --quality low`

**Recommended hi-fi run config**
- `--aspect_ratio 16:9 --resolution 2k --quality high`
- Also generate a `--aspect_ratio 4:5` matching variant for mobile hero

**Prompt**

```
Editorial wide shot, sun-washed Texas-Latin street scene at golden hour.
Centerpiece: a large hand-painted bilingual mural in chicano sign-painter /
Mexican loteria style reading 'Vemos Vamos — We See. We Go.' in bold
mustard-yellow and hot-pink hand-lettered typography, with small loteria
icons (a watchful eye, a star, walking footsteps) tucked into the negative
space. Foreground: a small group of bicultural friends, real and unposed,
moving through the frame in casual streetwear. Background: warm South Texas
storefronts, string lights, parked low-rider. Color palette: mustard
yellow, hot pink, electric blue, neon red, warm cream. Composition: clean
negative space on the left third for website headline overlay. Cinematic,
editorial, human, textured, vibrant, modern, culturally grounded. Avoid
glossy stock photo look, AI-generic sheen, influencer poses, generic
marketing aesthetic.
```

**Tunes to fold in on hi-fi pass**
1. Add `Acciones hablan más fuerte` as a smaller secondary line under the main mural lockup
2. Push the mural slightly right so the left ~30% is cleaner sky / wall (more headline room)
3. Request more visible photographic grain — should read as editorial photo, not digital-clean
4. Reposition the foreground people tighter to lower-right or further pulled-back so the mural stays the hero

**4:5 mobile variant change**: replace "Composition: clean negative space on the left third for website headline overlay" with "Composition: clean negative space at the top for mobile website headline overlay; mural occupies the middle band; people in lower half."

---

## Asset 2 — Six-Sticker Pack (1:1)

**Use case:** UI accents, section dividers, content callouts, social post decoration. The output is a single sheet; individual stickers need to be cut out / background-removed for production.

**Visual direction confirmed:** Six die-cut stickers in a 3×2 grid, hand-painted chicano sign-painter aesthetic, consistent print/border treatment.

**Lo-fi run config**
- Model: `gpt_image_2`
- `--aspect_ratio 1:1 --resolution 1k --quality low`

**Recommended hi-fi run config**
- `--aspect_ratio 1:1 --resolution 2k --quality high`
- Consider regenerating individual stickers as single-hero-format pieces (see Asset 3 pattern) for cleanest background-removal

**Prompt**

```
Sticker sheet flat-lay, 6 die-cut style stickers arranged in a 3x2 grid on
a clean off-white textured paper background. Hand-painted chicano
sign-painter and Mexican loteria aesthetic. Sticker designs: (1) a
stylized watchful eye in mustard yellow and hot pink with 'VEMOS'
hand-lettered curving around it; (2) a pair of walking footprints in
electric blue with 'VAMOS' hand-lettered below them; (3) a bold rounded
text bubble with 'Acciones hablan' in mustard-yellow hand-painted lettering
with hot-pink drop shadow; (4) a yellow lightning-bolt burst with 'SEÑAL'
in red sign-painter type; (5) a small red heart with 'AMOR a la cultura'
lettered through it; (6) a hand-lettered banner reading 'We See. We Go.'
in bilingual hot-pink-and-yellow type. Each sticker has a thick white
die-cut border. Bold linework, slight chalk and print texture, vintage
bodega signage feel. Color palette: mustard yellow, hot pink, electric
blue, neon red, warm cream. Modern, vibrant, culturally grounded. Avoid
glossy 3D rendering, AI sheen, generic emoji sticker style.
```

**Tunes to fold in on hi-fi pass**
- Drop the two weakest stickers (SEÑAL lightning + We See/We Go banner) and replace with stronger candidates: a megaphone "OYE", a fist "ACCIÓN", or a film clapboard "TOMA UNO"

---

## Asset 3 — VEMOS Hero Sticker (1:1)

**Use case:** Standalone centerpiece — homepage hero element, 404 page, loading state, social avatar, oversized print/swag. The strongest single asset to come out of the lo-fi validation pass.

**Visual direction confirmed:** Single large die-cut sticker, centered watchful-eye lotería motif, "VEMOS" hand-lettered above in red sign-painter type, "We See." ribbon below.

**Lo-fi run config**
- Model: `gpt_image_2`
- `--aspect_ratio 1:1 --resolution 1k --quality low`

**Recommended hi-fi run config**
- `--aspect_ratio 1:1 --resolution 2k --quality high`

**Prompt**

```
Single large die-cut sticker centered in frame on a clean off-white
textured paper background with subtle decorative print marks. Hand-painted
chicano sign-painter and Mexican loteria aesthetic. The sticker design:
a large stylized watchful eye in mustard yellow with deep ochre iris and
bold black pupil, surrounded by hot-pink starburst rays radiating outward,
with 'VEMOS' hand-lettered in bold red sign-painter typography curving
above the eye, and 'We See.' in smaller bilingual hand-lettering tucked
below the eye. Thick clean white die-cut border around the entire sticker
shape. Bold black linework, vintage print texture, slight off-register
printing feel, warm cream paper underneath. Generous breathing room around
the sticker. Color palette: mustard yellow, hot pink, neon red, deep blue
accents, warm cream. Modern, vibrant, culturally grounded, loteria card
energy. Avoid glossy 3D rendering, AI sheen, generic emoji sticker style.
```

**Known nits to address on hi-fi pass**
- "VEMOS" sits slightly tight against the top of the sticker border — push letterforms down ~5% for breathing room

---

## Asset 4 — VAMOS Hero Sticker (1:1) — Companion to Asset 3

**Use case:** Matched companion to VEMOS hero. Use as a pair (side-by-side, alternating, or as bookends in a layout).

**Visual direction confirmed:** Single large die-cut sticker, centered electric-blue walking-footprints motif, "VAMOS" hand-lettered above in red sign-painter type matching VEMOS, "We Go." ribbon below.

**Lo-fi run config**
- Model: `gpt_image_2`
- `--aspect_ratio 1:1 --resolution 1k --quality low`

**Recommended hi-fi run config**
- `--aspect_ratio 1:1 --resolution 2k --quality high`
- Generate alongside Asset 3 in the same session for tightest style match

**Prompt**

```
Single large die-cut sticker centered in frame on a clean off-white
textured paper background with subtle decorative print marks. Hand-painted
chicano sign-painter and Mexican loteria aesthetic, companion piece to a
matching VEMOS sticker. The sticker design: a pair of bold walking
footprints in electric blue with deep cobalt outlines, arranged mid-stride
as if walking upward through the frame, surrounded by mustard-yellow
starburst rays radiating outward, with 'VAMOS' hand-lettered in bold red
sign-painter typography curving above the footprints (same lettering style
as VEMOS), and 'We Go.' in smaller hand-lettering inside a ribbon banner
tucked below the footprints. Thick clean white die-cut border around the
entire sticker shape. Bold black linework, vintage print texture, slight
off-register printing feel, warm cream paper underneath. Generous breathing
room around the sticker. Decorative hot-pink 4-point star accents flanking
the center motif, ornamental corner flourishes matching the VEMOS sticker.
Color palette: electric blue dominant, mustard yellow, hot pink, neon red,
warm cream. Modern, vibrant, culturally grounded, loteria card energy.
Avoid glossy 3D rendering, AI sheen, generic emoji sticker style.
```

**Known nits to address on hi-fi pass**
- VAMOS has more elaborate floral corner flourishes than VEMOS — when running the hi-fi pair, regularize corner treatments so VEMOS and VAMOS match exactly. Suggest passing the hi-fi VEMOS output as `--image` reference when generating hi-fi VAMOS to lock the style match.

---

## Reusable Visual DNA Block

The following descriptor block is the distillation of what makes a VemosVamos visual read as on-brand. Drop it into any future Higgsfield prompt for this brand — it's the visual equivalent of the brand voice rules.

```
Hand-painted chicano sign-painter and Mexican loteria aesthetic.
Color palette: mustard yellow, hot pink, electric blue, neon red, warm cream.
Bold linework, vintage print texture, slight off-register printing feel.
Cinematic, editorial, human, textured, vibrant, modern, culturally grounded.
Avoid glossy 3D rendering, AI sheen, influencer poses, generic marketing
aesthetic, generic emoji sticker style.
```

This block should be appended to every Higgsfield prompt run on behalf of VemosVamos until a dedicated brand-guide Higgsfield skill exists that handles it automatically. See `docs/HIGGSFIELD-INTEGRATION.md` for the broader integration plan.

---

## Production Pipeline Note

All four assets above need background removal before deployment on the website (the off-white textured paper background renders as part of the image). Two options:

1. **Manual** — open in Photoshop/Figma, remove the off-white, export as transparent PNG.
2. **Automated** — the Adobe MCP `image_remove_background` tool is available in this Claude environment and can be wired into the next-434media ingestion pipeline. Worth wiring up as part of `actions/higgsfield/` in Phase 1 of the integration so AI-generated assets land in the CRM already background-removed.
