/**
 * FORK (#123): an autosave marks its new draft version BEFORE the request, not
 * after `submit()` resolves.
 *
 * `Form.submit` clears `modified` the moment the server answers, then awaits
 * the form-level `onSuccess` (the Edit view's `onSave`, which fetches a fresh
 * form state) before it returns. Autosave used to bump `unpublishedVersionCount`
 * and set `mostRecentVersionIsAutosaved` only after that return, so on the first
 * autosave after a publish there was a window, as long as the form-state round
 * trip, in which a published document read `modified: false` with
 * `unpublishedVersionCount: 0`: "nothing to publish" while a draft had just been
 * written. A Publish control keyed on those facts vanished (or went inert) and
 * came back. Marked first, the counters say "a draft is pending" from the
 * moment the draft is sent; a refused or failed draft takes the mark back (the
 * form stays modified then, so the pending state holds either way).
 *
 * Pure, so the ordering is unit-tested without a React harness.
 */
export type DraftVersionMarks = {
  mostRecentVersionIsAutosaved: boolean
  setMostRecentVersionIsAutosaved: (value: boolean) => void
  setUnpublishedVersionCount: (update: (prev: number) => number) => void
}

export async function submitDraftWithVersionMark<R extends { res?: { ok?: boolean } } | void>(
  marks: DraftVersionMarks,
  send: () => Promise<R>,
): Promise<R> {
  // An autosave on top of an autosaved version updates that version in place;
  // only the first one after a publish (or a manual save) writes a new one.
  const writesNewVersion = !marks.mostRecentVersionIsAutosaved

  if (writesNewVersion) {
    marks.setMostRecentVersionIsAutosaved(true)
    marks.setUnpublishedVersionCount((prev) => prev + 1)
  }

  let result: R
  try {
    result = await send()
  } catch (error) {
    if (writesNewVersion) {
      marks.setMostRecentVersionIsAutosaved(false)
      marks.setUnpublishedVersionCount((prev) => Math.max(0, prev - 1))
    }
    throw error
  }

  if (writesNewVersion && !(result && result.res?.ok)) {
    marks.setMostRecentVersionIsAutosaved(false)
    marks.setUnpublishedVersionCount((prev) => Math.max(0, prev - 1))
  }

  return result
}
