/**
 * Fork #98 — the claim registry behind `useClaimFieldPath`, framework-free.
 *
 * Claims are ref-counted per path (two mounted components may claim the same
 * path; the path stays claimed until both release). `onChange` fires with a
 * fresh snapshot only when the SET of claimed paths (or of claimed subtrees)
 * changes.
 *
 * Fork #100 — a claim may cover a SUBTREE (`{ subtree: true }`): the path P
 * and every path under it (`P.<anything>`). A subtree claim is ref-counted
 * separately from an exact claim on the same path; `getClaimedPaths()` holds
 * every claimed path, exact or subtree, and `getClaimedSubtrees()` the subset
 * claimed as subtrees.
 */
export type ClaimOptions = {
  /** Fork #100: also claim every path under `path` (`path.<anything>`). */
  subtree?: boolean
}

export type ClaimRegistry = {
  /** Registers a claim on `path`; returns the release (idempotent). */
  claim: (path: string, options?: ClaimOptions) => () => void
  /** The paths claimed right now (exact and subtree claims). */
  getClaimedPaths: () => ReadonlySet<string>
  /** Fork #100: the paths claimed as subtrees right now. */
  getClaimedSubtrees: () => ReadonlySet<string>
}

export const EmptyClaims: ReadonlySet<string> = new Set()

export const createClaimRegistry = (
  onChange?: (claimedPaths: ReadonlySet<string>, claimedSubtrees: ReadonlySet<string>) => void,
): ClaimRegistry => {
  const exactCounts = new Map<string, number>()
  const subtreeCounts = new Map<string, number>()
  let pathsSnapshot: ReadonlySet<string> = EmptyClaims
  let subtreesSnapshot: ReadonlySet<string> = EmptyClaims

  const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) =>
    a.size === b.size && [...a].every((path) => b.has(path))

  const publish = () => {
    const paths = new Set([...exactCounts.keys(), ...subtreeCounts.keys()])
    const subtrees = new Set(subtreeCounts.keys())
    if (sameSet(paths, pathsSnapshot) && sameSet(subtrees, subtreesSnapshot)) {
      return
    }
    pathsSnapshot = paths
    subtreesSnapshot = subtrees
    onChange?.(pathsSnapshot, subtreesSnapshot)
  }

  return {
    claim: (path, options) => {
      const counts = options?.subtree ? subtreeCounts : exactCounts
      counts.set(path, (counts.get(path) ?? 0) + 1)
      publish()

      let released = false

      return () => {
        if (released) {
          return
        }
        released = true
        const current = counts.get(path) ?? 0
        if (current <= 1) {
          counts.delete(path)
        } else {
          counts.set(path, current - 1)
        }
        publish()
      }
    },
    getClaimedPaths: () => pathsSnapshot,
    getClaimedSubtrees: () => subtreesSnapshot,
  }
}

/**
 * Fork #100: the claimed subtree (a path in `claimedSubtrees`) that covers
 * `path` — `path` itself or its nearest claimed ancestor — or `undefined`.
 */
export const coveringSubtreeClaim = (
  path: string,
  claimedSubtrees: ReadonlySet<string> | undefined,
): string | undefined => {
  if (!claimedSubtrees || claimedSubtrees.size === 0) {
    return undefined
  }
  const segments = path.split('.')
  for (let length = segments.length; length > 0; length -= 1) {
    const candidate = segments.slice(0, length).join('.')
    if (claimedSubtrees.has(candidate)) {
      return candidate
    }
  }
  return undefined
}
