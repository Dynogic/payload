import { describe, expect, it } from 'vitest'

import { submitDraftWithVersionMark } from './markDraftVersion.js'

/** DocumentInfo's two version facts, as plain state. */
function docInfo(initial: {
  mostRecentVersionIsAutosaved: boolean
  unpublishedVersionCount: number
}) {
  const state = { ...initial }
  return {
    state,
    marks: {
      mostRecentVersionIsAutosaved: initial.mostRecentVersionIsAutosaved,
      setMostRecentVersionIsAutosaved: (value: boolean) => {
        state.mostRecentVersionIsAutosaved = value
      },
      setUnpublishedVersionCount: (update: (prev: number) => number) => {
        state.unpublishedVersionCount = update(state.unpublishedVersionCount)
      },
    },
  }
}

describe('submitDraftWithVersionMark (#123): the counters never lag the form reset', () => {
  it('a published document reads "a draft is pending" while its first autosave is in flight', async () => {
    const { marks, state } = docInfo({
      mostRecentVersionIsAutosaved: false,
      unpublishedVersionCount: 0,
    })
    let seenWhileSending: typeof state | undefined
    // The moment Form.submit clears `modified` is inside the send: the
    // counters must already say a draft is pending.
    await submitDraftWithVersionMark(marks, async () => {
      seenWhileSending = { ...state }
      return { res: { ok: true } }
    })
    expect(seenWhileSending).toEqual({
      mostRecentVersionIsAutosaved: true,
      unpublishedVersionCount: 1,
    })
    expect(state).toEqual({ mostRecentVersionIsAutosaved: true, unpublishedVersionCount: 1 })
  })

  it('an autosave over an autosaved version writes no new version', async () => {
    const { marks, state } = docInfo({
      mostRecentVersionIsAutosaved: true,
      unpublishedVersionCount: 1,
    })
    await submitDraftWithVersionMark(marks, async () => ({ res: { ok: true } }))
    expect(state).toEqual({ mostRecentVersionIsAutosaved: true, unpublishedVersionCount: 1 })
  })

  it('a refused draft takes the mark back', async () => {
    const { marks, state } = docInfo({
      mostRecentVersionIsAutosaved: false,
      unpublishedVersionCount: 0,
    })
    await submitDraftWithVersionMark(marks, async () => ({ res: { ok: false } }))
    expect(state).toEqual({ mostRecentVersionIsAutosaved: false, unpublishedVersionCount: 0 })
  })

  it('a submit that sends nothing (invalid form) takes the mark back', async () => {
    const { marks, state } = docInfo({
      mostRecentVersionIsAutosaved: false,
      unpublishedVersionCount: 2,
    })
    await submitDraftWithVersionMark(marks, async () => undefined)
    expect(state).toEqual({ mostRecentVersionIsAutosaved: false, unpublishedVersionCount: 2 })
  })

  it('a throw takes the mark back and rethrows', async () => {
    const { marks, state } = docInfo({
      mostRecentVersionIsAutosaved: false,
      unpublishedVersionCount: 0,
    })
    await expect(
      submitDraftWithVersionMark(marks, async () => {
        throw new Error('network')
      }),
    ).rejects.toThrow('network')
    expect(state).toEqual({ mostRecentVersionIsAutosaved: false, unpublishedVersionCount: 0 })
  })
})
