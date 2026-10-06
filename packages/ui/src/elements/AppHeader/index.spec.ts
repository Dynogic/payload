/**
 * FORK (#124): the header breadcrumb scrolls inside its own band.
 *
 * Upstream's `.app-header__step-nav-wrapper` hides its scrollbar and the trail
 * draws a fade at its end, but the wrapper never said `overflow` and, as a
 * flex item, could not shrink below its content. On a 390px phone a three-crumb
 * trail measured 394px in a 358px band and the whole document page scrolled
 * sideways. This compiles the real stylesheet and checks the wrapper's rule.
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
// `sass` and `postcss` are not direct dependencies of @payloadcms/ui; borrow
// the build's own copies.
const fromBuild = createRequire(require.resolve('esbuild-sass-plugin'))
const sass = fromBuild('sass') as typeof import('sass')
const postcss = fromBuild('postcss') as typeof import('postcss')

const Dir = path.dirname(fileURLToPath(import.meta.url))
const Css = sass.compile(path.join(Dir, 'index.scss'), {
  loadPaths: [path.join(Dir, '../../scss')],
}).css

/** Every declaration on the wrapper outside any media query, last one wins. */
function wrapperDecls(): Record<string, string> {
  const out: Record<string, string> = {}
  postcss.parse(Css).walkRules((rule) => {
    if (rule.parent?.type === 'atrule' && (rule.parent as any).name === 'media') {
      return
    }
    if (!rule.selectors.includes('.app-header__step-nav-wrapper')) {
      return
    }
    rule.walkDecls((decl) => {
      out[decl.prop] = decl.value
    })
  })
  return out
}

describe('AppHeader stylesheet: the breadcrumb never widens the page (#124)', () => {
  it('the step-nav wrapper scrolls its trail sideways and clips nothing vertically', () => {
    const decls = wrapperDecls()
    expect(decls['overflow-x']).toBe('auto')
    expect(decls['overflow-y']).toBe('hidden')
  })

  it('the wrapper can shrink below its content in the header flex row', () => {
    expect(wrapperDecls()['min-width']).toBe('0')
  })

  it('the scrollbar stays hidden, in Firefox too', () => {
    expect(wrapperDecls()['scrollbar-width']).toBe('none')
  })
})
