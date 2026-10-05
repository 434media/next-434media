// GENERATED FILE - DO NOT EDIT BY HAND.
// Written by 434media/434-context: 04 Build/emit_work_media.py from
// 04 Build/records-media-manifest.json, the manifest published alongside the
// objects themselves at "records/manifest-2.0.30-20261005-103703.json".
//
// Display and Design Standard section 5: the site resolves delivered media from
// the stamped manifest rather than by path convention, which is what makes an
// asset addressable by version. Every URL below carries one.
//
// Master 2.0.30, asset version v1, published 2026-10-05T15:37:03+00:00.
//
// Every published record is here. There is no path convention to fall back to:
// a record this map does not name has no media.

export interface RecordLoop {
  webm: string
  mp4: string
}

/** The full film with its audio, requested only when the detail view opens. */
export interface RecordDetail {
  webm?: string
  mp4: string
}

/** A WebP is absent where it came out larger than the JPEG: never offer the larger file. */
export interface RecordTile {
  wide: string
  wideWebp?: string
  compact: string
  compactWebp?: string
}

export interface RecordMedia {
  loop?: RecordLoop
  detail?: RecordDetail
  tile?: RecordTile
}

export const RECORD_MEDIA: Record<string, RecordMedia> = {
  "280-earth": {
      loop: { mp4: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/280-earth/v1/loop.mp4", webm: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/280-earth/v1/loop.webm" },
      detail: { mp4: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/280-earth/v1/detail.mp4", webm: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/280-earth/v1/detail.webm" },
      tile: { compact: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/280-earth/v1/tile-4x5.jpg", compactWebp: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/280-earth/v1/tile-4x5.webp", wide: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/280-earth/v1/tile-16x9.jpg", wideWebp: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/280-earth/v1/tile-16x9.webp" },
  },
  "aim-health-summit": {
      loop: { mp4: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/aim-health-summit/v1/loop.mp4", webm: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/aim-health-summit/v1/loop.webm" },
      detail: { mp4: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/aim-health-summit/v1/detail.mp4" },
      tile: { compact: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/aim-health-summit/v1/tile-4x5.jpg", compactWebp: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/aim-health-summit/v1/tile-4x5.webp", wide: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/aim-health-summit/v1/tile-16x9.jpg" },
  },
  "alamo-angels": {
      loop: { mp4: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/alamo-angels/v1/loop.mp4", webm: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/alamo-angels/v1/loop.webm" },
      detail: { mp4: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/alamo-angels/v1/detail.mp4" },
      tile: { compact: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/alamo-angels/v1/tile-4x5.jpg", compactWebp: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/alamo-angels/v1/tile-4x5.webp", wide: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/alamo-angels/v1/tile-16x9.jpg", wideWebp: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/alamo-angels/v1/tile-16x9.webp" },
  },
  "ampd-project": {
      loop: { mp4: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/ampd-project/v1/loop.mp4", webm: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/ampd-project/v1/loop.webm" },
      detail: { mp4: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/ampd-project/v1/detail.mp4" },
      tile: { compact: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/ampd-project/v1/tile-4x5.jpg", compactWebp: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/ampd-project/v1/tile-4x5.webp", wide: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/ampd-project/v1/tile-16x9.jpg", wideWebp: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/ampd-project/v1/tile-16x9.webp" },
  },
  "amplifier-health": {
      loop: { mp4: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/amplifier-health/v1/loop.mp4", webm: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/amplifier-health/v1/loop.webm" },
      detail: { mp4: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/amplifier-health/v1/detail.mp4", webm: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/amplifier-health/v1/detail.webm" },
      tile: { compact: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/amplifier-health/v1/tile-4x5.jpg", compactWebp: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/amplifier-health/v1/tile-4x5.webp", wide: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/amplifier-health/v1/tile-16x9.jpg", wideWebp: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/amplifier-health/v1/tile-16x9.webp" },
  },
  "ashbrook-technologies": {
      loop: { mp4: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/ashbrook-technologies/v1/loop.mp4", webm: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/ashbrook-technologies/v1/loop.webm" },
      detail: { mp4: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/ashbrook-technologies/v1/detail.mp4", webm: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/ashbrook-technologies/v1/detail.webm" },
      tile: { compact: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/ashbrook-technologies/v1/tile-4x5.jpg", compactWebp: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/ashbrook-technologies/v1/tile-4x5.webp", wide: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/ashbrook-technologies/v1/tile-16x9.jpg", wideWebp: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/ashbrook-technologies/v1/tile-16x9.webp" },
  },
  "breaking": {
      loop: { mp4: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/breaking/v1/loop.mp4", webm: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/breaking/v1/loop.webm" },
      detail: { mp4: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/breaking/v1/detail.mp4", webm: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/breaking/v1/detail.webm" },
      tile: { compact: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/breaking/v1/tile-4x5.jpg", compactWebp: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/breaking/v1/tile-4x5.webp", wide: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/breaking/v1/tile-16x9.jpg", wideWebp: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/breaking/v1/tile-16x9.webp" },
  },
  "checkerspot": {
      loop: { mp4: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/checkerspot/v1/loop.mp4", webm: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/checkerspot/v1/loop.webm" },
      detail: { mp4: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/checkerspot/v1/detail.mp4", webm: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/checkerspot/v1/detail.webm" },
      tile: { compact: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/checkerspot/v1/tile-4x5.jpg", compactWebp: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/checkerspot/v1/tile-4x5.webp", wide: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/checkerspot/v1/tile-16x9.jpg", wideWebp: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/checkerspot/v1/tile-16x9.webp" },
  },
  "gradiant": {
      loop: { mp4: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/gradiant/v1/loop.mp4", webm: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/gradiant/v1/loop.webm" },
      detail: { mp4: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/gradiant/v1/detail.mp4", webm: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/gradiant/v1/detail.webm" },
      tile: { compact: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/gradiant/v1/tile-4x5.jpg", compactWebp: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/gradiant/v1/tile-4x5.webp", wide: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/gradiant/v1/tile-16x9.jpg", wideWebp: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/gradiant/v1/tile-16x9.webp" },
  },
  "milcityusa": {
      tile: { compact: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/milcityusa/v1/tile-4x5.jpg", compactWebp: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/milcityusa/v1/tile-4x5.webp", wide: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/milcityusa/v1/tile-16x9.jpg" },
  },
  "mission-road-soar": {
      loop: { mp4: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/mission-road-soar/v1/loop.mp4", webm: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/mission-road-soar/v1/loop.webm" },
      detail: { mp4: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/mission-road-soar/v1/detail.mp4" },
      tile: { compact: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/mission-road-soar/v1/tile-4x5.jpg", compactWebp: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/mission-road-soar/v1/tile-4x5.webp", wide: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/mission-road-soar/v1/tile-16x9.jpg", wideWebp: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/mission-road-soar/v1/tile-16x9.webp" },
  },
  "native-microbials": {
      loop: { mp4: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/native-microbials/v1/loop.mp4", webm: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/native-microbials/v1/loop.webm" },
      detail: { mp4: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/native-microbials/v1/detail.mp4", webm: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/native-microbials/v1/detail.webm" },
      tile: { compact: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/native-microbials/v1/tile-4x5.jpg", compactWebp: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/native-microbials/v1/tile-4x5.webp", wide: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/native-microbials/v1/tile-16x9.jpg", wideWebp: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/native-microbials/v1/tile-16x9.webp" },
  },
  "navier": {
      loop: { mp4: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/navier/v1/loop.mp4", webm: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/navier/v1/loop.webm" },
      detail: { mp4: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/navier/v1/detail.mp4", webm: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/navier/v1/detail.webm" },
      tile: { compact: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/navier/v1/tile-4x5.jpg", compactWebp: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/navier/v1/tile-4x5.webp", wide: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/navier/v1/tile-16x9.jpg", wideWebp: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/navier/v1/tile-16x9.webp" },
  },
  "nucleate-global-summit": {
      tile: { compact: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/nucleate-global-summit/v1/tile-4x5.jpg", compactWebp: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/nucleate-global-summit/v1/tile-4x5.webp", wide: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/nucleate-global-summit/v1/tile-16x9.jpg", wideWebp: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/nucleate-global-summit/v1/tile-16x9.webp" },
  },
  "overdrive": {
      loop: { mp4: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/overdrive/v1/loop.mp4", webm: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/overdrive/v1/loop.webm" },
      detail: { mp4: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/overdrive/v1/detail.mp4" },
      tile: { compact: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/overdrive/v1/tile-4x5.jpg", compactWebp: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/overdrive/v1/tile-4x5.webp", wide: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/overdrive/v1/tile-16x9.jpg", wideWebp: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/overdrive/v1/tile-16x9.webp" },
  },
  "pathos": {
      loop: { mp4: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/pathos/v1/loop.mp4", webm: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/pathos/v1/loop.webm" },
      detail: { mp4: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/pathos/v1/detail.mp4", webm: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/pathos/v1/detail.webm" },
      tile: { compact: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/pathos/v1/tile-4x5.jpg", compactWebp: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/pathos/v1/tile-4x5.webp", wide: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/pathos/v1/tile-16x9.jpg", wideWebp: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/pathos/v1/tile-16x9.webp" },
  },
  "pie-vat": {
      loop: { mp4: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/pie-vat/v1/loop.mp4", webm: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/pie-vat/v1/loop.webm" },
      detail: { mp4: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/pie-vat/v1/detail.mp4", webm: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/pie-vat/v1/detail.webm" },
      tile: { compact: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/pie-vat/v1/tile-4x5.jpg", compactWebp: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/pie-vat/v1/tile-4x5.webp", wide: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/pie-vat/v1/tile-16x9.jpg", wideWebp: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/pie-vat/v1/tile-16x9.webp" },
  },
  "que-es-sdoh": {
      loop: { mp4: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/que-es-sdoh/v1/loop.mp4", webm: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/que-es-sdoh/v1/loop.webm" },
      detail: { mp4: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/que-es-sdoh/v1/detail.mp4" },
      tile: { compact: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/que-es-sdoh/v1/tile-4x5.jpg", compactWebp: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/que-es-sdoh/v1/tile-4x5.webp", wide: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/que-es-sdoh/v1/tile-16x9.jpg", wideWebp: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/que-es-sdoh/v1/tile-16x9.webp" },
  },
  "rise-of-a-champion": {
      loop: { mp4: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/rise-of-a-champion/v1/loop.mp4", webm: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/rise-of-a-champion/v1/loop.webm" },
      detail: { mp4: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/rise-of-a-champion/v1/detail.mp4" },
      tile: { compact: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/rise-of-a-champion/v1/tile-4x5.jpg", compactWebp: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/rise-of-a-champion/v1/tile-4x5.webp", wide: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/rise-of-a-champion/v1/tile-16x9.jpg", wideWebp: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/rise-of-a-champion/v1/tile-16x9.webp" },
  },
  "salute-to-troops": {
      loop: { mp4: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/salute-to-troops/v1/loop.mp4", webm: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/salute-to-troops/v1/loop.webm" },
      detail: { mp4: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/salute-to-troops/v1/detail.mp4" },
      tile: { compact: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/salute-to-troops/v1/tile-4x5.jpg", wide: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/salute-to-troops/v1/tile-16x9.jpg" },
  },
  "techbloc-tech-day": {
      loop: { mp4: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/techbloc-tech-day/v1/loop.mp4", webm: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/techbloc-tech-day/v1/loop.webm" },
      detail: { mp4: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/techbloc-tech-day/v1/detail.mp4" },
      tile: { compact: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/techbloc-tech-day/v1/tile-4x5.jpg", compactWebp: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/techbloc-tech-day/v1/tile-4x5.webp", wide: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/techbloc-tech-day/v1/tile-16x9.jpg", wideWebp: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/techbloc-tech-day/v1/tile-16x9.webp" },
  },
  "txmx-boxing": {
      loop: { mp4: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/txmx-boxing/v1/loop.mp4", webm: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/txmx-boxing/v1/loop.webm" },
      detail: { mp4: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/txmx-boxing/v1/detail.mp4" },
      tile: { compact: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/txmx-boxing/v1/tile-4x5.jpg", compactWebp: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/txmx-boxing/v1/tile-4x5.webp", wide: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/txmx-boxing/v1/tile-16x9.jpg", wideWebp: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/txmx-boxing/v1/tile-16x9.webp" },
  },
  "ubiqd": {
      loop: { mp4: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/ubiqd/v1/loop.mp4", webm: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/ubiqd/v1/loop.webm" },
      detail: { mp4: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/ubiqd/v1/detail.mp4", webm: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/ubiqd/v1/detail.webm" },
      tile: { compact: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/ubiqd/v1/tile-4x5.jpg", compactWebp: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/ubiqd/v1/tile-4x5.webp", wide: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/ubiqd/v1/tile-16x9.jpg", wideWebp: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/ubiqd/v1/tile-16x9.webp" },
  },
  "univision-70th": {
      loop: { mp4: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/univision-70th/v1/loop.mp4", webm: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/univision-70th/v1/loop.webm" },
      detail: { mp4: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/univision-70th/v1/detail.mp4" },
      tile: { compact: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/univision-70th/v1/tile-4x5.jpg", compactWebp: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/univision-70th/v1/tile-4x5.webp", wide: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/univision-70th/v1/tile-16x9.jpg", wideWebp: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/univision-70th/v1/tile-16x9.webp" },
  },
  "velocitytx-demo-day": {
      loop: { mp4: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/velocitytx-demo-day/v1/loop.mp4", webm: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/velocitytx-demo-day/v1/loop.webm" },
      detail: { mp4: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/velocitytx-demo-day/v1/detail.mp4" },
      tile: { compact: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/velocitytx-demo-day/v1/tile-4x5.jpg", compactWebp: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/velocitytx-demo-day/v1/tile-4x5.webp", wide: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/velocitytx-demo-day/v1/tile-16x9.jpg", wideWebp: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/velocitytx-demo-day/v1/tile-16x9.webp" },
  },
  "vemosvamos": {
      loop: { mp4: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/vemosvamos/v1/loop.mp4", webm: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/vemosvamos/v1/loop.webm" },
      detail: { mp4: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/vemosvamos/v1/detail.mp4" },
      tile: { compact: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/vemosvamos/v1/tile-4x5.jpg", wide: "https://storage.googleapis.com/groovy-ego-462522-v2.firebasestorage.app/records/vemosvamos/v1/tile-16x9.jpg" },
  },
}
