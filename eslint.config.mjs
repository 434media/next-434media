import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // Generated from the canonical master by the parser in the context repo,
  // docs/context/"04 Build"/master_extract.py. Excluded so `eslint --fix`
  // cannot rewrite them: lib/master-manifest.json records a
  // sha256 of work-records.ts, and any reformat changes that hash and trips
  // scripts/check_drift.py. Regenerate rather than reformat.
  { ignores: ["lib/work-records.ts", "lib/brand-records.ts", "lib/master-manifest.json"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;
