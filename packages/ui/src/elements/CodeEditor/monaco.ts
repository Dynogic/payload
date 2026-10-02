'use client'
/**
 * Fork #115: the code editor runs on the consuming app's INSTALLED `monaco-editor`, never on a CDN.
 *
 * `@monaco-editor/react`'s loader fetches monaco from jsDelivr at the version it pins unless it is
 * handed an instance (`loader.config({ monaco })`), which is what this module does. It is only
 * ever loaded through `loadMonaco()` (a dynamic import from an effect), so monaco, which touches
 * `window` / `document` while it evaluates, never runs on the server.
 *
 * The worker URLs are the monaco-editor >= 0.56 export paths (`monaco-editor/editor/...`,
 * `monaco-editor/languages/features/...`); 0.55 exposed them under `esm/vs/...`, which 0.56's
 * `exports` map no longer resolves, so the peer range starts at 0.56. The bundler (Next) sees the
 * `new Worker(new URL(..., import.meta.url))` calls and emits each worker as its own chunk.
 */
import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'

type MonacoGlobal = {
  monaco?: typeof monaco
  MonacoEnvironment?: monaco.Environment
}

const globalScope = globalThis as unknown as MonacoGlobal

// An app that set its own MonacoEnvironment (custom workers, a CSP-friendly worker host) keeps it.
if (!globalScope.MonacoEnvironment) {
  globalScope.MonacoEnvironment = {
    getWorker(_workerId: string, label: string): Worker {
      switch (label) {
        case 'css':
        case 'less':
        case 'scss':
          return new Worker(
            new URL('monaco-editor/languages/features/css/css.worker.js', import.meta.url),
            { name: label, type: 'module' },
          )
        case 'handlebars':
        case 'html':
        case 'razor':
          return new Worker(
            new URL('monaco-editor/languages/features/html/html.worker.js', import.meta.url),
            { name: label, type: 'module' },
          )
        case 'javascript':
        case 'typescript':
          return new Worker(
            new URL('monaco-editor/languages/features/typescript/ts.worker.js', import.meta.url),
            { name: label, type: 'module' },
          )
        case 'json':
          return new Worker(
            new URL('monaco-editor/languages/features/json/json.worker.js', import.meta.url),
            { name: label, type: 'module' },
          )
        default:
          return new Worker(new URL('monaco-editor/editor/editor.worker.js', import.meta.url), {
            name: label,
            type: 'module',
          })
      }
    },
  }
}

// The CDN (AMD) build left the API on `window.monaco`; keep that for code that reads it.
if (!globalScope.monaco) {
  globalScope.monaco = monaco
}

loader.config({ monaco })

export { monaco }
