/**
 * Fork #98 — the claim registry behind `useClaimFieldPath`, framework-free.
 *
 * Claims are ref-counted per path (two mounted components may claim the same
 * path; the path stays claimed until both release). `onChange` fires with a
 * fresh snapshot only when the SET of claimed paths changes.
 */
export type ClaimRegistry = {
  /** Registers a claim on `path`; returns the release (idempotent). */
  claim: (path: string) => () => void
  /** The paths claimed right now. */
  getClaimedPaths: () => ReadonlySet<string>
}

export const EmptyClaims: ReadonlySet<string> = new Set()

export const createClaimRegistry = (
  onChange?: (claimedPaths: ReadonlySet<string>) => void,
): ClaimRegistry => {
  const counts = new Map<string, number>()
  let snapshot: ReadonlySet<string> = EmptyClaims

  const publish = () => {
    snapshot = new Set(counts.keys())
    onChange?.(snapshot)
  }

  return {
    claim: (path) => {
      const before = counts.get(path) ?? 0
      counts.set(path, before + 1)
      if (before === 0) {
        publish()
      }

      let released = false

      return () => {
        if (released) {
          return
        }
        released = true
        const current = counts.get(path) ?? 0
        if (current <= 1) {
          counts.delete(path)
          publish()
        } else {
          counts.set(path, current - 1)
        }
      }
    },
    getClaimedPaths: () => snapshot,
  }
}
