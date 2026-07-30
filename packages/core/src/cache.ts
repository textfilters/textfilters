import type {
  CachedTextProcessor,
  CachedTextProcessorOptions,
} from "./contracts.js";
import { normalizeTextInput } from "./input.js";

const DEFAULT_CACHED_TEXT_MAX_ENTRIES = 256;
const MAX_CACHED_TEXT_MAX_ENTRIES = 10_000;

/**
 * Creates an opt-in bounded helper for repeated identical text processing.
 */
export function createCachedTextProcessor<T>(
  processor: (text: string) => T,
  options: CachedTextProcessorOptions = {},
): CachedTextProcessor<T> {
  if (typeof processor !== "function") {
    throw new TypeError("processor must be a function");
  }

  const maxEntries = normalizeCacheMaxEntries(options.maxEntries);
  const cache = new Map<string, T>();

  return {
    maxEntries,

    get size() {
      return cache.size;
    },

    process(value) {
      const text = normalizeTextInput(value);
      if (maxEntries === 0) return processor(text);

      if (cache.has(text)) {
        const cached = cache.get(text)!;
        cache.delete(text);
        cache.set(text, cached);
        return cached;
      }

      const result = processor(text);
      cache.set(text, result);
      if (cache.size > maxEntries) {
        const oldestKey = cache.keys().next().value;
        if (oldestKey !== undefined) {
          cache.delete(oldestKey);
        }
      }
      return result;
    },

    clear() {
      cache.clear();
    },
  };
}

function normalizeCacheMaxEntries(maxEntries: unknown): number {
  const parsed = Math.trunc(Number(maxEntries));
  if (!Number.isFinite(parsed)) return DEFAULT_CACHED_TEXT_MAX_ENTRIES;
  return Math.min(Math.max(parsed, 0), MAX_CACHED_TEXT_MAX_ENTRIES);
}
