import { describe, expect, it } from 'vitest'

import { firstVisibleIndex, indexOfSlug, resolveActiveTabIndex } from './resolveTabIndex.js'

const tab = (index: number, slug?: string, passesCondition = true) => ({
  index,
  passesCondition,
  slug,
})

// A products-style doc: Details + Content share `content` and are
// condition-exclusive; Page/Teaser/Sell carry their own slugs.
const productTabs = [
  tab(0, 'content', false), // Details — hidden on an existing curriculum doc
  tab(1, 'content', true), // Content — the studio
  tab(2, 'page'),
  tab(3, 'teaser'),
  tab(4, 'sell'),
]

describe('indexOfSlug', () => {
  it('returns the index of the visible tab carrying the slug', () => {
    expect(indexOfSlug(productTabs, 'page')).toBe(2)
    expect(indexOfSlug(productTabs, 'sell')).toBe(4)
  })

  it('is condition-aware: the FIRST match whose condition passes wins', () => {
    expect(indexOfSlug(productTabs, 'content')).toBe(1)
    // Flip the exclusivity (the create form: no id → Details visible, Content hidden).
    const createForm = [tab(0, 'content', true), tab(1, 'content', false), tab(2, 'page')]
    expect(indexOfSlug(createForm, 'content')).toBe(0)
  })

  it('returns null for an unknown slug, a hidden-only slug, or no slug', () => {
    expect(indexOfSlug(productTabs, 'nope')).toBeNull()
    expect(indexOfSlug([tab(0, 'only', false)], 'only')).toBeNull()
    expect(indexOfSlug(productTabs, null)).toBeNull()
    expect(indexOfSlug(productTabs, undefined)).toBeNull()
    expect(indexOfSlug(productTabs, '')).toBeNull()
  })

  it('never matches slug-less tabs', () => {
    expect(indexOfSlug([tab(0), tab(1)], 'undefined')).toBeNull()
  })
})

describe('firstVisibleIndex', () => {
  it('skips hidden tabs and falls back to 0 when nothing is visible', () => {
    expect(firstVisibleIndex(productTabs)).toBe(1)
    expect(firstVisibleIndex([tab(0, 'a', false), tab(1, 'b', false)])).toBe(0)
    expect(firstVisibleIndex([])).toBe(0)
  })
})

describe('resolveActiveTabIndex', () => {
  it('the tab param wins over local click state', () => {
    expect(
      resolveActiveTabIndex({ localIndex: 4, slugParam: 'page', tabStates: productTabs }),
    ).toBe(2)
  })

  it('falls back to the local click state when the param is absent or unknown', () => {
    expect(resolveActiveTabIndex({ localIndex: 3, slugParam: null, tabStates: productTabs })).toBe(
      3,
    )
    expect(resolveActiveTabIndex({ localIndex: 3, slugParam: 'zzz', tabStates: productTabs })).toBe(
      3,
    )
  })

  it('ignores a local index whose tab is no longer visible', () => {
    expect(resolveActiveTabIndex({ localIndex: 0, slugParam: null, tabStates: productTabs })).toBe(
      1,
    )
  })

  it('falls back to the first visible tab when nothing else applies', () => {
    expect(
      resolveActiveTabIndex({ localIndex: null, slugParam: null, tabStates: productTabs }),
    ).toBe(1)
  })

  it('prefers the local index while its own URL write is still in flight', () => {
    // Clicked Sell (local 4, write pending) while the router still reports ?tab=page.
    expect(
      resolveActiveTabIndex({
        localIndex: 4,
        pendingLocal: true,
        slugParam: 'page',
        tabStates: productTabs,
      }),
    ).toBe(4)
    // …but not when that local tab has since been hidden.
    expect(
      resolveActiveTabIndex({
        localIndex: 0,
        pendingLocal: true,
        slugParam: 'page',
        tabStates: productTabs,
      }),
    ).toBe(2)
  })
})
