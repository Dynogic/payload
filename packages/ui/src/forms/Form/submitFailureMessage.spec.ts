import { describe, expect, it } from 'vitest'

import {
  isNetworkError,
  responseSubmitFailureMessage,
  thrownSubmitFailureMessage,
} from './submitFailureMessage.js'

/**
 * Fork change #94 — localized save-failure sentences instead of the raw
 * "Failed to fetch" / "Internal Server Error".
 */

const t = (key: string) => `<${key}>`
const Reach = '<error:couldNotReachServer>'
const Save = '<error:couldNotSave>'

describe('isNetworkError', () => {
  it.each([
    ['Chrome', 'Failed to fetch'],
    ['Firefox', 'NetworkError when attempting to fetch resource.'],
    ['Safari', 'Load failed'],
  ])('%s fetch TypeError is a network failure', (_browser, message) => {
    expect(isNetworkError(new TypeError(message))).toBe(true)
  })

  it('an abort is a network failure', () => {
    const err = new Error('The operation was aborted.')
    err.name = 'AbortError'
    expect(isNetworkError(err)).toBe(true)
  })

  it('a TypeError from a bug is NOT a network failure', () => {
    expect(isNetworkError(new TypeError("Cannot read properties of undefined (reading 'x')"))).toBe(
      false,
    )
  })

  it('a plain Error is not a network failure', () => {
    expect(isNetworkError(new Error('Failed to fetch'))).toBe(false)
  })

  it('nothing is not a network failure', () => {
    expect(isNetworkError(undefined)).toBe(false)
    expect(isNetworkError('Failed to fetch')).toBe(false)
  })
})

describe('thrownSubmitFailureMessage', () => {
  it('network throw before any response → could not reach the server', () => {
    expect(
      thrownSubmitFailureMessage({
        err: new TypeError('Failed to fetch'),
        responseReceived: false,
        t,
      }),
    ).toBe(Reach)
  })

  it('a throw after a response came back → could not save (not the network)', () => {
    expect(
      thrownSubmitFailureMessage({
        err: new TypeError('Failed to fetch'),
        responseReceived: true,
        t,
      }),
    ).toBe(Save)
  })

  it('a non-network throw → could not save, never the raw message', () => {
    expect(
      thrownSubmitFailureMessage({
        err: new Error('Unexpected token < in JSON'),
        responseReceived: false,
        t,
      }),
    ).toBe(Save)
  })
})

describe('responseSubmitFailureMessage', () => {
  it('500 with statusText only → could not save', () => {
    expect(responseSubmitFailureMessage({ status: 500, t })).toBe(Save)
  })

  it("500 carrying Payload's generic sentence → could not save", () => {
    expect(responseSubmitFailureMessage({ message: 'Something went wrong.', status: 500, t })).toBe(
      Save,
    )
  })

  it('503 → could not save', () => {
    expect(responseSubmitFailureMessage({ message: 'Service Unavailable', status: 503, t })).toBe(
      Save,
    )
  })

  it("a 4xx's own sentence is kept", () => {
    expect(
      responseSubmitFailureMessage({
        message: 'You are not allowed to perform this action.',
        status: 403,
        t,
      }),
    ).toBe('You are not allowed to perform this action.')
  })

  it('a 4xx with no sentence → could not save', () => {
    expect(responseSubmitFailureMessage({ status: 413, t })).toBe(Save)
    expect(responseSubmitFailureMessage({ message: '  ', status: 400, t })).toBe(Save)
  })
})
