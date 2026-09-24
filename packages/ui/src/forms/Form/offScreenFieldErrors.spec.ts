import { describe, expect, it } from 'vitest'

import { isFieldOnScreen, offScreenErrorMessages } from './offScreenFieldErrors.js'

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
