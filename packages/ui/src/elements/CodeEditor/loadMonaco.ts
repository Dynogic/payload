'use client'
/**
 * Fork #115: loads `./monaco.js` (the installed monaco-editor, handed to `@monaco-editor/react`'s
 * loader) once per page, in the browser only. The editor renders only after this resolves, so the
 * loader never falls back to fetching monaco from its CDN.
 */
let monacoPromise: null | Promise<void> = null
let monacoLoaded = false

export const isMonacoLoaded = (): boolean => monacoLoaded

export const loadMonaco = (): Promise<void> => {
  if (monacoPromise === null) {
    monacoPromise = import('./monaco.js').then(
      () => {
        monacoLoaded = true
      },
      (error: unknown) => {
        // Let a later mount try again (a chunk that failed to load is not cached as failed).
        monacoPromise = null
        throw error
      },
    )
  }
  return monacoPromise
}
