import type { FormState } from 'payload'

import { describe, expect, it } from 'vitest'

import { fieldReducer } from './fieldReducer.js'
import { hasStandingServerErrors } from './standingServerErrors.js'

/**
 * Fork change #120 — a server error stands until the user acts on its field.
 *
 * The scene: a refused publish puts "Name this offer first" on an empty
 * name, the user types in ANOTHER field, and the autosave that follows (a
 * draft the server does not validate) merges the server's form state back.
 * Upstream's merge marks every returned field `valid`, so the error vanished
 * while the name was still empty.
 */

const refused = (): FormState => {
  const before: FormState = {
    name: { initialValue: '', valid: true, value: '' },
    'payment.priceCents': { initialValue: null, valid: true, value: null },
    payment: { valid: true, value: undefined },
    tagline: { initialValue: '', valid: true, value: '' },
  }
  return fieldReducer(before, {
    type: 'ADD_SERVER_ERRORS',
    errors: [
      { message: 'Name this offer first', path: 'name' },
      { message: 'Enter a price', path: 'payment.priceCents' },
    ],
  })
}

/** What an autosave (or the onChange form-state request) sends back: every
 * field valid, no error paths. */
const serverSaysValid = (state: FormState): FormState =>
  Object.fromEntries(
    Object.entries(state).map(([path, field]) => [
      path,
      { initialValue: field.value, valid: true, value: field.value },
    ]),
  )

const merge = (state: FormState, acceptValues: unknown = { overrideLocalChanges: false }) =>
  fieldReducer(state, {
    type: 'MERGE_SERVER_STATE',
    acceptValues: acceptValues as never,
    prevStateRef: { current: {} },
    serverState: serverSaysValid(state),
  })

describe('a refused submit', () => {
  it('stamps each field it marks with the message and the value it held', () => {
    const state = refused()
    expect(state.name.serverError).toEqual({ message: 'Name this offer first', value: '' })
    expect(state['payment.priceCents'].serverError).toEqual({
      message: 'Enter a price',
      value: null,
    })
    expect(state.payment.errorPaths).toEqual(['payment.priceCents'])
    expect(hasStandingServerErrors(state)).toBe(true)
  })
})

describe('an autosave merge', () => {
  it('KEEPS the error on a field the user has not touched (fails without #120)', () => {
    let state = refused()
    state = fieldReducer(state, { type: 'UPDATE', path: 'tagline', value: 'Something else' })
    state = merge(state)
    expect(state.name.valid).toBe(false)
    expect(state.name.errorMessage).toBe('Name this offer first')
    expect(state['payment.priceCents'].valid).toBe(false)
    expect(state['payment.priceCents'].errorMessage).toBe('Enter a price')
  })

  it("keeps the parent's error path, so a tab or group still counts the error", () => {
    const state = merge(refused())
    expect(state.payment.errorPaths).toEqual(['payment.priceCents'])
  })

  it('keeps it through an explicit-values merge too (the onChange request, a Save Draft)', () => {
    const state = merge(refused(), true)
    expect(state.name.valid).toBe(false)
  })

  it("lets the error go once the user changes the field's value", () => {
    let state = refused()
    state = fieldReducer(state, { type: 'UPDATE', path: 'name', value: 'Lifetime Access' })
    expect(state.name.serverError).toBeUndefined()
    state = merge(state)
    expect(state.name.valid).toBe(true)
    // The untouched field still owes its error.
    expect(state['payment.priceCents'].valid).toBe(false)
  })

  it('a field typed into and back to the refused value has still been answered', () => {
    let state = refused()
    state = fieldReducer(state, { type: 'UPDATE', path: 'name', value: 'L' })
    state = fieldReducer(state, { type: 'UPDATE', path: 'name', value: '' })
    state = merge(state)
    expect(state.name.valid).toBe(true)
  })
})

describe('an update that keeps the value', () => {
  it('cannot validate the error away (a client validation pass)', () => {
    let state = refused()
    state = fieldReducer(state, {
      type: 'UPDATE',
      errorMessage: undefined,
      path: 'name',
      valid: true,
      value: '',
    })
    expect(state.name.valid).toBe(false)
    expect(state.name.errorMessage).toBe('Name this offer first')
  })

  it('treats null and undefined as the same empty value', () => {
    let state = refused()
    state = fieldReducer(state, { type: 'UPDATE', path: 'payment.priceCents', value: undefined })
    expect(state['payment.priceCents'].serverError).toBeDefined()
  })
})

describe('the server judging again', () => {
  it('CLEAR_SERVER_ERRORS drops every standing error and its error paths', () => {
    const state = fieldReducer(refused(), { type: 'CLEAR_SERVER_ERRORS' })
    expect(state.name.serverError).toBeUndefined()
    expect(state.name.valid).toBe(true)
    expect(state.name.errorMessage).toBeUndefined()
    expect(state.payment.errorPaths).toEqual([])
    expect(hasStandingServerErrors(state)).toBe(false)
  })

  it('a new refusal after the clear stands on its own fields only', () => {
    let state = fieldReducer(refused(), { type: 'CLEAR_SERVER_ERRORS' })
    state = fieldReducer(state, {
      type: 'ADD_SERVER_ERRORS',
      errors: [{ message: 'Enter a price', path: 'payment.priceCents' }],
    })
    state = merge(state)
    expect(state.name.valid).toBe(true)
    expect(state['payment.priceCents'].valid).toBe(false)
  })

  it('REPLACE_STATE (a reset, a revert) takes the errors with the state', () => {
    const state = fieldReducer(refused(), {
      type: 'REPLACE_STATE',
      state: serverSaysValid(refused()),
    })
    expect(hasStandingServerErrors(state)).toBe(false)
    expect(merge(state).name.valid).toBe(true)
  })
})
