/**
 * FORK (#78): pure resolution of a Tabs field's active index from the
 * `?tab=<slug>` query param. Kept free of React/DOM so it is unit-testable
 * and identical on the server and the client (the SSR HTML must already
 * show the addressed tab).
 */

export type TabIndexState = {
  index: number
  passesCondition: boolean
  slug?: string
}

/**
 * Condition-aware first match: the index of the first tab whose `slug`
 * equals `slug` AND whose condition passes. Tabs that are condition-
 * exclusive (e.g. a create-form Details tab and an edit-form Content tab
 * that never co-render) may share a slug — the visible one wins. `null`
 * when the slug is empty or nothing visible carries it.
 */
export function indexOfSlug(
  tabStates: readonly TabIndexState[],
  slug: null | string | undefined,
): null | number {
  if (!slug) {
    return null
  }

  const match = tabStates.find((state) => state.passesCondition && state.slug === slug)

  return match ? match.index : null
}

/** The first tab whose condition passes; 0 when none does (matches the
 * renderer's historic fallback). */
export function firstVisibleIndex(tabStates: readonly TabIndexState[]): number {
  return tabStates.find((state) => state.passesCondition)?.index ?? 0
}

/**
 * The one derivation, client and server alike:
 *
 *   1. the `tab` param, resolved condition-aware (`indexOfSlug`);
 *   2. else the local click state (slug-less tabs never touch the URL),
 *      provided that tab is still visible;
 *   3. else the first visible tab.
 *
 * `localIndex` is also preferred over the param while a click's own URL
 * write is still in flight (`pendingLocal`) so the switch is never gated on
 * the router's async search-param sync.
 */
export function resolveActiveTabIndex({
  localIndex,
  pendingLocal = false,
  slugParam,
  tabStates,
}: {
  localIndex: null | number
  pendingLocal?: boolean
  slugParam: null | string | undefined
  tabStates: readonly TabIndexState[]
}): number {
  const localVisible =
    localIndex !== null && (tabStates[localIndex]?.passesCondition ?? false) ? localIndex : null

  if (pendingLocal && localVisible !== null) {
    return localVisible
  }

  return indexOfSlug(tabStates, slugParam) ?? localVisible ?? firstVisibleIndex(tabStates)
}
