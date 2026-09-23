/**
 * Fork change #94 — a failed save says what happened in the admin's own
 * language, never the transport's raw English.
 *
 * Before: a dropped connection painted the browser's `TypeError` message
 * ("Failed to fetch" / "NetworkError when attempting to fetch resource." /
 * "Load failed"), and a server fault painted whatever the 500 carried
 * ("Internal Server Error" from `statusText`, "Something went wrong.", or in
 * debug a raw exception message). Now:
 *
 *  - no response at all, and the throw is the network's → `error:couldNotReachServer`
 *  - a 5xx, or a failure response with no sentence of its own → `error:couldNotSave`
 *  - a 4xx that carries its own sentence (an `APIError` an app threw on
 *    purpose, a 403's "not allowed") → that sentence, unchanged
 *
 * Validation errors never reach this: the per-field path (ADD_SERVER_ERRORS +
 * `FieldErrorsToast`) is untouched.
 */

type Translate = (key: 'error:couldNotReachServer' | 'error:couldNotSave') => string

const NetworkMessagePattern = /fetch|network|load failed/i

/**
 * True when `err` is what `fetch` throws for a request that never got a
 * response: a `TypeError` whose message is one of the browsers' network
 * sentences (Chrome "Failed to fetch", Firefox "NetworkError when attempting
 * to fetch resource.", Safari "Load failed"), or an abort. A `TypeError` from
 * a bug ("Cannot read properties of undefined") is NOT a network failure.
 */
export const isNetworkError = (err: unknown): boolean => {
  if (!err || typeof err !== 'object') {
    return false
  }

  const { name, message } = err as { message?: unknown; name?: unknown }

  if (name === 'AbortError') {
    return true
  }

  return name === 'TypeError' && typeof message === 'string' && NetworkMessagePattern.test(message)
}

/** The sentence for a submit that THREW (no usable response). */
export const thrownSubmitFailureMessage = ({
  err,
  responseReceived,
  t,
}: {
  err: unknown
  /** A response came back before the throw — the failure is not the network's. */
  responseReceived: boolean
  t: Translate
}): string =>
  !responseReceived && isNetworkError(err)
    ? t('error:couldNotReachServer')
    : t('error:couldNotSave')

/** The sentence for a failure RESPONSE (status >= 400) that is not a validation error. */
export const responseSubmitFailureMessage = ({
  message,
  status,
  t,
}: {
  /** The response's own sentence, if it carried one. */
  message?: unknown
  status: number
  t: Translate
}): string => {
  if (status >= 500) {
    return t('error:couldNotSave')
  }

  return typeof message === 'string' && message.trim() ? message : t('error:couldNotSave')
}
