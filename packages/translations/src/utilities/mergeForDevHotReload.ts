import { deepMergeSimple } from './deepMergeSimple.js'

/**
 * In `NODE_ENV === 'development'`, returns a Proxy that defers
 * `deepMergeSimple(original, additional)` to per-`[lang]` access time. This
 * preserves Proxy semantics of `original` so projects with reactive
 * `config.i18n.translations` (e.g. fresh-on-disk JSON for hot-reload) keep
 * working past every layer of Payload's setup pipeline (root sanitize,
 * per-field editor sanitize, lexical feature sanitize, etc.).
 *
 * In production, returns the eager merge as before — identical behavior, no
 * runtime overhead.
 *
 * The chain is safe: each call wraps the previous result, and per-`[lang]`
 * access cascades through every Proxy layer back to the project's original
 * reactive translations.
 *
 * See FORK-CHANGES.md #53 / #54.
 */
export function mergeForDevHotReload<T = object>(obj1: object, obj2: object): T {
  if (process.env.NODE_ENV === 'development') {
    const original = obj1 as Record<string, any>
    const additional = obj2 as Record<string, any>
    return new Proxy(
      {},
      {
        get: (_, lang: string) => deepMergeSimple(original[lang] || {}, additional[lang] || {}),
        getOwnPropertyDescriptor: () => ({
          configurable: true,
          enumerable: true,
        }),
        has: (_, lang: string) => lang in original || lang in additional,
        ownKeys: () => Array.from(new Set([...Object.keys(additional), ...Object.keys(original)])),
      },
    ) as T
  }
  return deepMergeSimple<T>(obj1, obj2)
}
