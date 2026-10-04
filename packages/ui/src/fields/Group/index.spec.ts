/**
 * FORK (#122): a bare group keeps no gutter on a phone.
 *
 * `.group-field--gutter` gets `padding-left: var(--gutter-h)` again inside the
 * small break, AFTER `.group-field--bare` and at the same specificity, so a bare
 * group carrying the gutter modifier (any group nested in a group) stepped
 * 16px right below 768px while its border stayed off. This compiles the real
 * stylesheet and runs the cascade for a bare gutter group, desktop and phone.
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

type Decl = { prop: string; value: string }

/** Does a compound class selector (with `:not(.x)`) match this class list? */
function matches(selector: string, classes: Set<string>): boolean {
  if (/[\s>+~[]/.test(selector.trim())) {
    return false
  }
  const nots = [...selector.matchAll(/:not\(\.([\w-]+)\)/g)].map((m) => m[1])
  const rest = selector.replace(/:not\(\.[\w-]+\)/g, '')
  if (/:[\w-]/.test(rest)) {
    return false
  }
  const needs = rest.split('.').filter(Boolean)
  return needs.every((c) => classes.has(c)) && nots.every((c) => !classes.has(c))
}

/** The winning value of `prop` (or its shorthand) for `classes` at `phone` width. */
function computed(classes: string[], prop: 'border-left' | 'padding-left', phone: boolean) {
  const set = new Set(classes)
  let winner: null | string = null
  postcss.parse(Css).walkRules((rule) => {
    const media = rule.parent?.type === 'atrule' && (rule.parent as any).name === 'media'
    if (media && !phone) {
      return
    }
    if (!rule.selectors.some((sel) => matches(sel, set))) {
      return
    }
    rule.walkDecls((decl: Decl) => {
      if (decl.prop === prop) {
        winner = decl.value
      }
      if (prop === 'padding-left' && decl.prop === 'padding') {
        const parts = decl.value.split(/\s+(?![^(]*\))/)
        winner = parts[parts.length === 4 ? 3 : parts.length === 1 ? 0 : 1]
      }
      if (prop === 'border-left' && decl.prop === 'border') {
        winner = decl.value
      }
    })
  })
  return winner
}

const BareGutter = ['group-field', 'group-field--bare', 'group-field--gutter']

describe('Group stylesheet: a bare group keeps no gutter (#122)', () => {
  it('desktop: no padding, no border', () => {
    expect(computed(BareGutter, 'padding-left', false)).toBe('0')
    expect(computed(BareGutter, 'border-left', false)).toBe('0')
  })

  it('phone: still no padding (the small-break gutter rule used to win)', () => {
    expect(computed(BareGutter, 'padding-left', true)).toBe('0')
  })

  it('a chrome gutter group keeps its phone gutter', () => {
    expect(computed(['group-field', 'group-field--gutter'], 'padding-left', true)).toBe(
      'var(--gutter-h)',
    )
  })
})
