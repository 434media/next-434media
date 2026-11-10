import type { BlogFilters } from "../types/blog-types"

/**
 * The filters a blog-post read may use (security log ADM-7). The server action behind the public blog takes its
 * filters from the caller, so anyone could ask for `{ status: "draft" }` or no status at all. Without an admin session
 * the status is forced to "published"; an admin session keeps the filters as given.
 */
export function blogFiltersFor(filters: unknown, isAdmin: boolean): BlogFilters {
  const given: BlogFilters = filters && typeof filters === "object" ? (filters as BlogFilters) : {}
  return isAdmin ? given : { ...given, status: "published" }
}
