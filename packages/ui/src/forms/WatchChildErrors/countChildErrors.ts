import type { FormState } from 'payload'

import { coveringSubtreeClaim } from '../useClaimFieldPath/claimRegistry.js'

/**
 * ONE FAULT, COUNTED ONCE.
 *
 * Server-built form state marks a CONTAINER invalid beside the leaf that is
 * actually at fault (`addFieldStatePromise` → `addErrorPathToParent`: "if a
 * field is invalid, all its parents are also invalid"). One subtitle track
 * with no name therefore flags both `subtitles.0.name` and `subtitles`, and
 * counting every invalid key in the subtree reads 2 for a single missing
 * value.
 *
 * So: count only the DEEPEST invalid key of each chain. An invalid key that
 * has an invalid descendant is the same fault said twice.
 *
 * A genuinely container-level error is NOT hidden — `minRows` on an array
 * whose rows are all valid, or a group whose own validate failed, has no
 * invalid descendant and still counts. The one lossy case is a container
 * error AND a leaf error at the same time, which reads 1 instead of 2; the
 * badge still says the subtree is in error, which is what it is for, while
 * counting the parent mis-states every single-leaf fault, which is the
 * common one.
 *
 * Fork #98 — A HIDDEN FIELD COUNTS ONLY WHEN CLAIMED. An error on an
 * `admin.hidden` field (form state `hidden: true`) frames no stock control,
 * so it counts only when a component shows it: a mounted component claims
 * the path (`useClaimFieldPath` → `claimedPaths`), or the field declares the
 * claim statically for this document (`claimedByComponent: true`). An
 * unclaimed hidden-field error counts nowhere (the Form toasts it). A
 * hidden-field error still makes its CONTAINER a same-fault duplicate, so an
 * unclaimed hidden leaf does not resurface as its group's error.
 *
 * Fork #100 — SUBTREE CLAIMS. A subtree claim on P covers every key under P
 * (`P.<anything>`): live (`useClaimFieldPath(P, { subtree: true })` →
 * `claimedSubtrees`), or static (P's state carries `claimedByComponent:
 * true` and `claimedSubtree: true`, from `admin.claimedByComponent: {
 * subtree: true }`). A covered key counts, hidden or not.
 *
 * A key UNDER a bare segment (a field with no sub-schema of its own, i.e. a
 * blocks field: `blocks.<row>.<leaf>`) matches that segment too, and counts
 * toward the tab that owns the field. Before this, such a key matched
 * nothing while its (server-flagged) blocks field was dropped as a
 * same-fault duplicate, so a blocks row fault badged nothing. Under a
 * HIDDEN bare field it counts only when a subtree claim covers it, as a
 * hidden field's own error counts only when claimed (#98).
 */
export const isClaimedHiddenError = (
  key: string,
  pathState: { claimedByComponent?: boolean; hidden?: boolean } | undefined,
  claimedPaths: ReadonlySet<string> | undefined,
): boolean =>
  !pathState?.hidden || pathState.claimedByComponent === true || Boolean(claimedPaths?.has(key))

/**
 * Fork #100: a subtree claim covers `key` — live, or static on `key` or an
 * ancestor's form state.
 */
export const isCoveredBySubtreeClaim = (
  key: string,
  formState: FormState,
  claimedSubtrees: ReadonlySet<string> | undefined,
): boolean => {
  if (coveringSubtreeClaim(key, claimedSubtrees) !== undefined) {
    return true
  }
  const segments = key.split('.')
  for (let length = segments.length; length > 0; length -= 1) {
    const pathState = formState[segments.slice(0, length).join('.')]
    if (pathState?.claimedByComponent === true && pathState.claimedSubtree === true) {
      return true
    }
  }
  return false
}

export const countChildErrors = ({
  claimedPaths,
  claimedSubtrees,
  formState,
  parentPath,
  segmentsToMatch,
}: {
  /** Fork #98: the paths claimed by mounted components (`useClaimFieldPath`). */
  claimedPaths?: ReadonlySet<string>
  /** Fork #100: the paths claimed as subtrees by mounted components. */
  claimedSubtrees?: ReadonlySet<string>
  formState: FormState
  /** The host's own path, prefixed onto every segment before matching. */
  parentPath: (number | string)[]
  /** From `buildPathSegments`: a bare name, or a `name.` container prefix. */
  segmentsToMatch: (`${string}.` | string)[] | undefined
}): number => {
  const invalidPaths = new Set<string>()

  for (const key of Object.keys(formState)) {
    const pathState = formState[key]
    if (pathState && 'valid' in pathState && !pathState.valid) {
      invalidPaths.add(key)
    }
  }

  if (invalidPaths.size === 0) {
    return 0
  }

  const hasInvalidDescendant = (key: string): boolean => {
    const prefix = `${key}.`
    for (const other of invalidPaths) {
      if (other.startsWith(prefix)) {
        return true
      }
    }
    return false
  }

  let errorCount = 0

  for (const key of invalidPaths) {
    // `direct`: the key is the field or inside its sub-schema (as before).
    // Fork #100: `underOwner` is the bare field the key lies UNDER.
    let direct = false
    let underOwner: string | undefined

    segmentsToMatch?.forEach((segment) => {
      const segmentToMatch = [...parentPath, segment].join('.')
      // match fields with same parent path
      if (segmentToMatch.endsWith('.')) {
        // Match both nested fields (key starts with segmentToMatch)
        // and the field itself (key equals segmentToMatch without trailing dot)
        const pathWithoutDot = segmentToMatch.slice(0, -1)
        if (key.startsWith(segmentToMatch) || key === pathWithoutDot) {
          direct = true
        }
        return
      }
      // match fields with same path
      if (key === segmentToMatch) {
        direct = true
      } else if (key.startsWith(`${segmentToMatch}.`)) {
        underOwner = segmentToMatch
      }
    })

    if ((!direct && underOwner === undefined) || hasInvalidDescendant(key)) {
      continue
    }

    if (isCoveredBySubtreeClaim(key, formState, claimedSubtrees)) {
      errorCount += 1
      continue
    }

    const ownClaimOk = isClaimedHiddenError(key, formState[key], claimedPaths)

    if (direct ? ownClaimOk : ownClaimOk && !formState[underOwner]?.hidden) {
      errorCount += 1
    }
  }

  return errorCount
}
