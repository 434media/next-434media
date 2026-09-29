/**
 * CI check: the generated design tokens have not been hand-edited.
 *
 * The visual system's source — the logo SVGs, the spec, the palette with its
 * provenance — is canonical in the private context repository. This repository
 * holds only what is generated from it, so CI cannot regenerate to compare.
 *
 * It can answer the narrower question, and it is the one this repo is exposed
 * to: did someone edit a generated file instead of changing the source? A brand
 * colour added here rather than in the handoff is a colour with no provenance,
 * which is the failure the whole system exists to prevent.
 *
 * "Are the tokens current with the handoff" is answered where the handoff is,
 * by `04 Build/build_visual_tokens.py --check`. Same split as lib/sor.
 */
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"

const MANIFEST = "lib/visual/tokens.manifest.json"
const { files, sourceVersion } = JSON.parse(readFileSync(MANIFEST, "utf8"))

const bad: string[] = []
for (const [path, expected] of Object.entries(files as Record<string, string>)) {
  const actual = createHash("sha256").update(readFileSync(path, "utf8")).digest("hex").slice(0, 16)
  if (actual !== expected) bad.push(`  ${path}\n    recorded ${expected}\n    actual   ${actual}`)
}

if (bad.length) {
  console.error(
    `Generated design tokens do not match ${MANIFEST}:\n${bad.join("\n")}\n` +
      `Change the source in 434-context and regenerate — do not edit these files.`
  )
  process.exit(1)
}

console.log(
  `design tokens match their manifest (${Object.keys(files).length} files, handoff ${sourceVersion})`
)
