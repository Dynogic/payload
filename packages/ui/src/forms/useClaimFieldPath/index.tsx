'use client'
import React, { createContext, use, useEffect, useState } from 'react'

import type { ClaimOptions, ClaimRegistry } from './claimRegistry.js'

import { createClaimRegistry, EmptyClaims } from './claimRegistry.js'

/**
 * Fork #98 — a hidden field is OFF SCREEN unless a mounted component claims
 * its path.
 *
 * An `admin.hidden` field renders no stock control, so a server error at its
 * path frames nothing: #97 toasts the error's own message, and the tab badge
 * (#90 `countChildErrors`) leaves it out. A custom component that DOES show
 * the field's error (it reads it with `useField` and paints the frame) calls
 * `useClaimFieldPath(path)`; while it is mounted the path counts as on
 * screen — no toast entry of its own, and it counts toward the badge of the
 * tab the field lives in. `useField` itself is unchanged.
 *
 * The registry lives in the nearest `Form`, so a claim ends when the
 * component unmounts (an inactive tab unmounts its fields). For a badge that
 * must survive that, the field declares `admin.claimedByComponent`.
 *
 * Fork #100 — `useClaimFieldPath(path, { subtree: true })` also claims every
 * path UNDER `path` (`path.<anything>`), and a claimed path counts as on
 * screen even when the form holds no state for it. For a component that
 * shows the errors of a whole structure the form does not hold per row
 * (a form-omitted blocks field whose server errors are keyed by row id).
 * Exact is the default: a claim says "I show THIS path's error", and
 * silently widening it would swallow the toast for descendants the
 * component never shows.
 */

const ClaimRegistryContext = createContext<ClaimRegistry | null>(null)
const ClaimedPathsContext = createContext<ReadonlySet<string>>(EmptyClaims)
const ClaimedSubtreesContext = createContext<ReadonlySet<string>>(EmptyClaims)

/**
 * Owned by `Form`: the registry and the reactive set of claimed paths.
 */
export const useFieldClaimRegistry = (): {
  claimedPaths: ReadonlySet<string>
  claimedSubtrees: ReadonlySet<string>
  registry: ClaimRegistry
} => {
  const [claims, setClaims] = useState<{
    claimedPaths: ReadonlySet<string>
    claimedSubtrees: ReadonlySet<string>
  }>({ claimedPaths: EmptyClaims, claimedSubtrees: EmptyClaims })
  const [registry] = useState(() =>
    createClaimRegistry((claimedPaths, claimedSubtrees) =>
      setClaims({ claimedPaths, claimedSubtrees }),
    ),
  )

  return { ...claims, registry }
}

export const FieldClaimProvider: React.FC<{
  children: React.ReactNode
  claimedPaths: ReadonlySet<string>
  claimedSubtrees: ReadonlySet<string>
  registry: ClaimRegistry
}> = ({ children, claimedPaths, claimedSubtrees, registry }) => (
  <ClaimRegistryContext value={registry}>
    <ClaimedPathsContext value={claimedPaths}>
      <ClaimedSubtreesContext value={claimedSubtrees}>{children}</ClaimedSubtreesContext>
    </ClaimedPathsContext>
  </ClaimRegistryContext>
)

/**
 * Claims a hidden field's path for as long as the calling component is
 * mounted: its errors are then ON SCREEN (the caller shows them) — no toast
 * entry of their own, and they count toward the badge of the tab (or
 * collapsible) the field lives in. Pass `undefined` / `false` to hold no
 * claim (e.g. when the component is not showing the error on this document).
 * A claimed path is on screen even when the form holds no state for it.
 *
 * `{ subtree: true }` (fork #100) also claims every path under `path`
 * (`path.<anything>`); those errors count toward the badge of the tab the
 * CLAIMED field lives in.
 *
 * @example
 * const { errorMessage, showError } = useField({ path: 'checkpointPolicy' })
 * useClaimFieldPath('checkpointPolicy')
 * useClaimFieldPath('curriculumItems', { subtree: true })
 */
export const useClaimFieldPath = (
  path: false | null | string | undefined,
  options?: ClaimOptions,
): void => {
  const registry = use(ClaimRegistryContext)
  const subtree = options?.subtree === true

  useEffect(() => {
    if (!registry || !path) {
      return
    }
    return registry.claim(path, { subtree })
  }, [registry, path, subtree])
}

/** The paths claimed in the nearest `Form`, exact or subtree (reactive). */
export const useClaimedFieldPaths = (): ReadonlySet<string> => use(ClaimedPathsContext)

/** Fork #100: the paths claimed as subtrees in the nearest `Form` (reactive). */
export const useClaimedFieldSubtrees = (): ReadonlySet<string> => use(ClaimedSubtreesContext)
