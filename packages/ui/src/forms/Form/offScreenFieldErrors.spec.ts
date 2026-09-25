import { describe, expect, it } from 'vitest'

import {
  allErrorPathsOnScreen,
  isFieldOnScreen,
  offScreenErrorMessages,
  serverErrorToast,
} from './offScreenFieldErrors.js'

/**
 * Fork change #97 — a server path error with no field on screen toasts its
 * own message instead of "The following field is invalid: <raw path>".
 */

const fields = {
  title: { value: 'x' },
  'items.0.product': { value: null },
  hiddenByCondition: { passesCondition: false, value: null },
}

describe('isFieldOnScreen', () => {
  it('is true for a path the form holds', () => {
    expect(isFieldOnScreen(fields, 'title')).toBe(true)
    expect(isFieldOnScreen(fields, 'items.0.product')).toBe(true)
  })

  it('is false for a path the form does not hold', () => {
    expect(isFieldOnScreen(fields, 'items.0.offer')).toBe(false)
  })

  it('is false for a field whose condition hides it', () => {
    expect(isFieldOnScreen(fields, 'hiddenByCondition')).toBe(false)
  })

  it('is false with no form state at all', () => {
    expect(isFieldOnScreen(undefined, 'title')).toBe(false)
  })
})

describe('offScreenErrorMessages', () => {
  it('is empty when every path is on screen (the stock toast stays)', () => {
    expect(
      offScreenErrorMessages({
        errors: [
          { message: 'Required', path: 'title' },
          { message: 'Pick a product first', path: 'items.0.product' },
        ],
        fields,
      }),
    ).toEqual([])
  })

  it("returns an off-screen error's own message", () => {
    expect(
      offScreenErrorMessages({
        errors: [{ message: 'This offer is no longer on sale', path: 'items.0.offer' }],
        fields,
      }),
    ).toEqual(['This offer is no longer on sale'])
  })

  it('keeps only the off-screen ones when on- and off-screen errors mix', () => {
    expect(
      offScreenErrorMessages({
        errors: [
          { message: 'Required', path: 'title' },
          { message: 'Slug already taken', path: 'slug' },
        ],
        fields,
      }),
    ).toEqual(['Slug already taken'])
  })

  it('returns several messages in server order, trimmed and de-duplicated', () => {
    expect(
      offScreenErrorMessages({
        errors: [
          { message: ' First sentence ', path: 'a' },
          { message: 'Second sentence', path: 'b' },
          { message: 'First sentence', path: 'c' },
        ],
        fields,
      }),
    ).toEqual(['First sentence', 'Second sentence'])
  })

  it('treats a condition-hidden field as off screen', () => {
    expect(
      offScreenErrorMessages({
        errors: [{ message: 'Needed when shown', path: 'hiddenByCondition' }],
        fields,
      }),
    ).toEqual(['Needed when shown'])
  })

  it('skips an off-screen entry with no message (falls back to the stock toast)', () => {
    expect(
      offScreenErrorMessages({ errors: [{ message: '  ', path: 'a' }, { path: 'b' }], fields }),
    ).toEqual([])
  })

  it('ignores entries without a path, and a non-array', () => {
    expect(offScreenErrorMessages({ errors: [{ message: 'No path' }, null], fields })).toEqual([])
    expect(offScreenErrorMessages({ errors: undefined, fields })).toEqual([])
  })
})

/**
 * Fork change #98 — an `admin.hidden` field is off screen unless a mounted
 * component claims its path.
 */
describe('hidden fields (#98)', () => {
  const hiddenFields = {
    title: { value: 'x' },
    checkpointPolicy: { hidden: true, value: 'required' },
    declared: { claimedByComponent: true, hidden: true, value: null },
    hiddenAndConditioned: { hidden: true, passesCondition: false, value: null },
  }
  const Claimed = new Set(['checkpointPolicy'])
  const Sentence = 'Required checkpoints cannot be on a free course'

  it('an unclaimed hidden field is off screen', () => {
    expect(isFieldOnScreen(hiddenFields, 'checkpointPolicy')).toBe(false)
    expect(isFieldOnScreen(hiddenFields, 'checkpointPolicy', new Set())).toBe(false)
  })

  it('a claimed hidden field is on screen', () => {
    expect(isFieldOnScreen(hiddenFields, 'checkpointPolicy', Claimed)).toBe(true)
  })

  it('a static claim alone does not put it on screen (nothing mounted shows it)', () => {
    expect(isFieldOnScreen(hiddenFields, 'declared')).toBe(false)
    expect(isFieldOnScreen(hiddenFields, 'declared', new Set(['declared']))).toBe(true)
  })

  it('a claim does not override a false condition', () => {
    expect(
      isFieldOnScreen(hiddenFields, 'hiddenAndConditioned', new Set(['hiddenAndConditioned'])),
    ).toBe(false)
  })

  it('a claim on a visible field changes nothing', () => {
    expect(isFieldOnScreen(hiddenFields, 'title', new Set(['title']))).toBe(true)
  })

  it('an unclaimed hidden-field error toasts its own sentence', () => {
    expect(
      offScreenErrorMessages({
        errors: [{ message: Sentence, path: 'checkpointPolicy' }],
        fields: hiddenFields,
      }),
    ).toEqual([Sentence])
  })

  it('a claimed hidden-field error gets no toast entry, and counts as on screen', () => {
    const errors = [{ message: Sentence, path: 'checkpointPolicy' }]
    expect(offScreenErrorMessages({ claimedPaths: Claimed, errors, fields: hiddenFields })).toEqual(
      [],
    )
    expect(allErrorPathsOnScreen({ claimedPaths: Claimed, errors, fields: hiddenFields })).toBe(
      true,
    )
  })
})

/**
 * Fork change #99 — every path on screen toasts "Please correct invalid
 * fields.", not the stock `FieldErrorsToast`.
 */
describe('serverErrorToast (#99)', () => {
  const toastFields = {
    title: { value: 'x' },
    'items.0.product': { value: null },
    hiddenByCondition: { passesCondition: false, value: null },
    checkpointPolicy: { hidden: true, value: 'required' },
  }
  const Claimed = new Set(['checkpointPolicy'])

  it('every path on a visible field → correctInvalidFields', () => {
    expect(
      serverErrorToast({
        errors: [
          { message: 'Required', path: 'title' },
          { message: 'Pick a product first', path: 'items.0.product' },
        ],
        fields: toastFields,
      }),
    ).toEqual({ kind: 'correctInvalidFields' })
  })

  it('a path with no label (raw path in the stock sentence) → correctInvalidFields', () => {
    expect(
      serverErrorToast({
        errors: [{ message: 'The following field is invalid: title', path: 'title' }],
        fields: toastFields,
      }),
    ).toEqual({ kind: 'correctInvalidFields' })
  })

  it('a claimed hidden path counts as on screen → correctInvalidFields', () => {
    expect(
      serverErrorToast({
        claimedPaths: Claimed,
        errors: [
          { message: 'x', path: 'checkpointPolicy' },
          { message: 'Required', path: 'title' },
        ],
        fields: toastFields,
      }),
    ).toEqual({ kind: 'correctInvalidFields' })
  })

  it('an unclaimed hidden path is off screen → its own message', () => {
    expect(
      serverErrorToast({
        errors: [
          { message: 'Required', path: 'title' },
          { message: 'Policy sentence', path: 'checkpointPolicy' },
        ],
        fields: toastFields,
      }),
    ).toEqual({ kind: 'offScreen', messages: ['Policy sentence'] })
  })

  it('mixed on and off screen → only the off-screen messages (#97)', () => {
    expect(
      serverErrorToast({
        errors: [
          { message: 'Required', path: 'title' },
          { message: 'Slug already taken', path: 'slug' },
          { message: 'Needed when shown', path: 'hiddenByCondition' },
        ],
        fields: toastFields,
      }),
    ).toEqual({ kind: 'offScreen', messages: ['Slug already taken', 'Needed when shown'] })
  })

  it('all off screen → their messages (#97)', () => {
    expect(
      serverErrorToast({
        errors: [{ message: 'This offer is no longer on sale', path: 'items.0.offer' }],
        fields: toastFields,
      }),
    ).toEqual({ kind: 'offScreen', messages: ['This offer is no longer on sale'] })
  })

  it('off-screen paths with no message of their own → stock', () => {
    expect(
      serverErrorToast({
        errors: [{ path: 'a' }, { message: ' ', path: 'b' }],
        fields: toastFields,
      }),
    ).toEqual({ kind: 'stock' })
    // one on screen does not make it "all on screen"
    expect(
      serverErrorToast({
        errors: [{ message: 'Required', path: 'title' }, { path: 'a' }],
        fields: toastFields,
      }),
    ).toEqual({ kind: 'stock' })
  })

  it('no path errors at all → stock', () => {
    expect(serverErrorToast({ errors: undefined, fields: toastFields })).toEqual({ kind: 'stock' })
    expect(serverErrorToast({ errors: [], fields: toastFields })).toEqual({ kind: 'stock' })
    expect(
      serverErrorToast({ errors: [{ message: 'No path' }, null], fields: toastFields }),
    ).toEqual({ kind: 'stock' })
  })
})

/**
 * Fork change #100 — a claim covers its subtree when asked
 * (`{ subtree: true }`), and a claimed path is on screen even when the form
 * holds no state for it. Unclaimed paths are decided exactly as before.
 */
describe('subtree claims (#100)', () => {
  // varig's curriculum: a hidden, form-omitted blocks field — its own state
  // exists, its rows (refused by row id) have none.
  const curriculumFields = {
    title: { value: 'x' },
    curriculumItems: { hidden: true, value: null },
    conditioned: { hidden: true, passesCondition: false, value: null },
  }
  const Subtrees = new Set(['curriculumItems'])
  const Paths = new Set(['curriculumItems'])
  const RowSentence = 'This lesson has no video yet'

  it('an unclaimed row path under the field is off screen (unchanged)', () => {
    expect(isFieldOnScreen(curriculumFields, 'curriculumItems.row1.source')).toBe(false)
  })

  it('an EXACT claim on the field does not cover its rows', () => {
    expect(isFieldOnScreen(curriculumFields, 'curriculumItems.row1.source', Paths)).toBe(false)
    expect(isFieldOnScreen(curriculumFields, 'curriculumItems', Paths)).toBe(true)
  })

  it('a subtree claim covers the field and every path under it', () => {
    expect(isFieldOnScreen(curriculumFields, 'curriculumItems', Paths, Subtrees)).toBe(true)
    expect(isFieldOnScreen(curriculumFields, 'curriculumItems.row1.source', Paths, Subtrees)).toBe(
      true,
    )
    expect(isFieldOnScreen(curriculumFields, 'curriculumItems.row1', Paths, Subtrees)).toBe(true)
  })

  it('a subtree claim does not cover a name-prefix sibling', () => {
    expect(
      isFieldOnScreen(
        { curriculumItemsExtra: { hidden: true } },
        'curriculumItemsExtra.x',
        Paths,
        Subtrees,
      ),
    ).toBe(false)
  })

  it('a claimed path with no form state is on screen', () => {
    expect(isFieldOnScreen(curriculumFields, 'virtual.path', new Set(['virtual.path']))).toBe(true)
    expect(isFieldOnScreen(undefined, 'virtual.path', new Set(['virtual.path']))).toBe(true)
  })

  it("a subtree claim does not beat the claimed field's false condition", () => {
    expect(
      isFieldOnScreen(
        curriculumFields,
        'conditioned.row1',
        new Set(['conditioned']),
        new Set(['conditioned']),
      ),
    ).toBe(false)
  })

  it('row-id errors under a subtree claim → correctInvalidFields (N13b)', () => {
    expect(
      serverErrorToast({
        claimedPaths: Paths,
        claimedSubtrees: Subtrees,
        errors: [
          { message: RowSentence, path: 'curriculumItems.row1.source' },
          { message: RowSentence, path: 'curriculumItems.row7.source' },
        ],
        fields: curriculumFields,
      }),
    ).toEqual({ kind: 'correctInvalidFields' })
  })

  it('the same errors with only an exact claim still toast the sentence (unchanged)', () => {
    expect(
      serverErrorToast({
        claimedPaths: Paths,
        errors: [{ message: RowSentence, path: 'curriculumItems.row1.source' }],
        fields: curriculumFields,
      }),
    ).toEqual({ kind: 'offScreen', messages: [RowSentence] })
  })

  it('an off-screen path beside covered rows still toasts its own message (#97)', () => {
    expect(
      serverErrorToast({
        claimedPaths: Paths,
        claimedSubtrees: Subtrees,
        errors: [
          { message: RowSentence, path: 'curriculumItems.row1.source' },
          { message: 'Slug already taken', path: 'slug' },
        ],
        fields: curriculumFields,
      }),
    ).toEqual({ kind: 'offScreen', messages: ['Slug already taken'] })
  })
})
