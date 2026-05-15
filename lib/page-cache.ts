/**
 * Module-level in-memory SWR (stale-while-revalidate) cache.
 *
 * - Data is served INSTANTLY from memory on repeat navigations (0ms).
 * - If the entry is older than `staleAfterMs`, a background refresh is
 *   triggered while still returning the stale data immediately.
 * - The cache lives for the browser session (module singleton).
 * - Call `pageCache.clear(key)` after mutations that should invalidate data.
 */

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

// Default: serve from memory for up to 60 s before background-refreshing.
const DEFAULT_STALE_MS = 60_000;

export const pageCache = {
  /**
   * Get data for `key`.
   * - If fresh: return immediately, no fetch.
   * - If stale: return immediately AND kick off a background refresh.
   * - If missing: fetch, store, return.
   *
   * @param key        Unique cache key
   * @param fetchFn    Function to (re-)fetch data
   * @param staleAfterMs  How old the entry can be before it's considered stale (default 60 s)
   * @param onRefresh  Optional callback called with fresh data after a background refresh
   */
  async get<T>(
    key: string,
    fetchFn: () => Promise<T>,
    staleAfterMs = DEFAULT_STALE_MS,
    onRefresh?: (fresh: T) => void,
  ): Promise<T> {
    const entry = store.get(key) as CacheEntry<T> | undefined;
    const now = Date.now();

    if (entry) {
      const age = now - entry.fetchedAt;

      if (age < staleAfterMs) {
        // Fresh — return immediately.
        return entry.data;
      }

      // Stale — return immediately, refresh in background.
      fetchFn()
        .then((fresh) => {
          store.set(key, { data: fresh, fetchedAt: Date.now() });
          onRefresh?.(fresh);
        })
        .catch(() => {/* silently keep stale data */});

      return entry.data;
    }

    // Cache miss — fetch, store, return.
    const data = await fetchFn();
    store.set(key, { data, fetchedAt: now });
    return data;
  },

  /** Remove a single key (e.g. after a mutation). */
  clear(key: string) {
    store.delete(key);
  },

  /** Remove all keys matching a prefix. */
  clearPrefix(prefix: string) {
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) store.delete(key);
    }
  },

  /** Wipe everything (e.g. on logout). */
  clearAll() {
    store.clear();
  },

  /** Peek at raw entry without triggering a fetch. */
  peek<T>(key: string): T | undefined {
    return (store.get(key) as CacheEntry<T> | undefined)?.data;
  },
};
