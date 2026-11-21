/**
 * Whether a string has the shape of one email address, checked by hand in linear time: the pattern
 * /^[^\s@]+@[^\s@]+\.[^\s@]+$/ backtracks polynomially on long hostile input (CodeQL js/polynomial-redos).
 * Same rules as that pattern, plus the 254-character limit of a valid address. Standalone on purpose: outbound send
 * code may not import the core model (lib/__tests__/core-model-personal.test.ts).
 */
export function isEmailShape(value: string): boolean {
  if (value.length > 254 || /\s/.test(value)) return false
  const at = value.indexOf("@")
  if (at < 1 || at !== value.lastIndexOf("@")) return false
  return value.slice(at + 1).slice(1, -1).includes(".")
}
