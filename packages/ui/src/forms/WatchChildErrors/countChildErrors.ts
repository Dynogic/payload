import type { FormState } from 'payload'

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
 */
export const isClaimedHiddenError = (
  key: string,
  pathState: { claimedByComponent?: boolean; hidden?: boolean } | undefined,
  claimedPaths: ReadonlySet<string> | undefined,
): boolean =>
  !pathState?.hidden || pathState.claimedByComponent === true || Boolean(claimedPaths?.has(key))

export const countChildErrors = ({
  claimedPaths,
  formState,
  parentPath,
  segmentsToMatch,
}: {
  /** Fork #98: the paths claimed by mounted components (`useClaimFieldPath`). */
  claimedPaths?: ReadonlySet<string>
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
    const matchingSegment = segmentsToMatch?.some((segment) => {
      const segmentToMatch = [...parentPath, segment].join('.')
      // match fields with same parent path
      if (segmentToMatch.endsWith('.')) {
        // Match both nested fields (key starts with segmentToMatch)
        // and the field itself (key equals segmentToMatch without trailing dot)
        const pathWithoutDot = segmentToMatch.slice(0, -1)
        return key.startsWith(segmentToMatch) || key === pathWithoutDot
      }
      // match fields with same path
      return key === segmentToMatch
    })

    if (
      matchingSegment &&
      !hasInvalidDescendant(key) &&
      isClaimedHiddenError(key, formState[key], claimedPaths)
    ) {
      errorCount += 1
    }
  }

  return errorCount
}
