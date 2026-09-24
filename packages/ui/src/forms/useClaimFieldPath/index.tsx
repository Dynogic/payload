'use client'
import React, { createContext, use, useEffect, useState } from 'react'

import type { ClaimRegistry } from './claimRegistry.js'

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
 */

const ClaimRegistryContext = createContext<ClaimRegistry | null>(null)
const ClaimedPathsContext = createContext<ReadonlySet<string>>(EmptyClaims)

/**
 * Owned by `Form`: the registry and the reactive set of claimed paths.
 */
export const useFieldClaimRegistry = (): {
  claimedPaths: ReadonlySet<string>
  registry: ClaimRegistry
} => {
  const [claimedPaths, setClaimedPaths] = useState<ReadonlySet<string>>(EmptyClaims)
  const [registry] = useState(() => createClaimRegistry(setClaimedPaths))

  return { claimedPaths, registry }
}

export const FieldClaimProvider: React.FC<{
  children: React.ReactNode
  claimedPaths: ReadonlySet<string>
  registry: ClaimRegistry
}> = ({ children, claimedPaths, registry }) => (
  <ClaimRegistryContext value={registry}>
    <ClaimedPathsContext value={claimedPaths}>{children}</ClaimedPathsContext>
  </ClaimRegistryContext>
)

/**
 * Claims a hidden field's path for as long as the calling component is
 * mounted: its errors are then ON SCREEN (the caller shows them) — no toast
 * entry of their own, and they count toward the badge of the tab (or
 * collapsible) the field lives in. Pass `undefined` / `false` to hold no
 * claim (e.g. when the component is not showing the error on this document).
 *
 * @example
 * const { errorMessage, showError } = useField({ path: 'checkpointPolicy' })
 * useClaimFieldPath('checkpointPolicy')
 */
export const useClaimFieldPath = (path: false | null | string | undefined): void => {
  const registry = use(ClaimRegistryContext)

  useEffect(() => {
    if (!registry || !path) {
      return
    }
    return registry.claim(path)
  }, [registry, path])
}

/** The paths claimed in the nearest `Form` (reactive). */
export const useClaimedFieldPaths = (): ReadonlySet<string> => use(ClaimedPathsContext)
