/**
 * A detail read that survives another instance's write.
 *
 * The core view is cached per server instance for 30 s (lib/core-model/read.ts). A save that replaces a record read
 * from an old list creates a new Person or Organization, clears only the cache of the instance that handled it, and
 * the drawer then opens the new id. When that GET lands on another instance, its cached view does not have the record
 * yet, and the drawer showed "Not found" for a record that exists. So a miss rebuilds the view once and looks again.
 * A record that still isn't there after a fresh build is a real 404.
 */
export async function findWithOneRebuild<V, T>(
  getView: () => Promise<V>,
  rebuildView: () => Promise<V>,
  find: (view: V) => T | null,
): Promise<T | null> {
  const first = find(await getView())
  if (first) return first
  return find(await rebuildView())
}
