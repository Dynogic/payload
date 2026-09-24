import { describe, expect, it } from 'vitest'

import {
  claimedErrorPaths,
  isFieldOnScreen,
  offScreenErrorMessages,
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

  it('a claimed hidden-field error gets no toast entry, and is reported as claimed', () => {
    const errors = [{ message: Sentence, path: 'checkpointPolicy' }]
    expect(offScreenErrorMessages({ claimedPaths: Claimed, errors, fields: hiddenFields })).toEqual(
      [],
    )
    expect(claimedErrorPaths({ claimedPaths: Claimed, errors, fields: hiddenFields })).toEqual([
      'checkpointPolicy',
    ])
  })

  it('claimedErrorPaths ignores visible fields, unclaimed hidden ones and duplicates', () => {
    expect(
      claimedErrorPaths({
        claimedPaths: Claimed,
        errors: [
          { message: 'Required', path: 'title' },
          { message: 'x', path: 'declared' },
          { message: Sentence, path: 'checkpointPolicy' },
          { message: Sentence, path: 'checkpointPolicy' },
        ],
        fields: hiddenFields,
      }),
    ).toEqual(['checkpointPolicy'])
    expect(claimedErrorPaths({ errors: undefined, fields: hiddenFields })).toEqual([])
  })
})
