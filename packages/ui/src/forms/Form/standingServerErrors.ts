'use client'
import type { FieldState, FormState } from 'payload'

import { dequal } from 'dequal/lite' // lite: no need for Map and Set support

/**
 * Fork #120 — a server error stands until the user acts on its field.
 *
 * A refused submit puts the server's field errors into form state
 * (`ADD_SERVER_ERRORS`). Before this change the very next server merge took
 * them away: an autosave is a draft submit the server does not validate, and
 * `mergeServerFormState` marks every field it returns `valid` (as does the
 * onChange form-state request), then the successful autosave reset
 * `submitted` (and `showError` is `!valid && submitted`). So an error painted
 * on a field vanished a second later while the field still held the refused
 * value: nothing the user did had answered it.
 *
 * The rule, in one place:
 *
 * - `ADD_SERVER_ERRORS` stamps each field it marks with `serverError`, the
 *   message and the value the field held when the error arrived.
 * - While the stamp stands, every merge and every `UPDATE` that does not
 *   change the value keeps the field invalid with that message.
 * - The stamp goes when the field's VALUE changes (the user touched it), when
 *   the server validates the whole document again (`CLEAR_SERVER_ERRORS`,
 *   dispatched by `Form` before it applies a validated submit's answer, so a
 *   new refusal replaces the old one and an accepted submit clears it), and
 *   with the state itself (`REPLACE_STATE`).
 * - A submit the server does not validate (a draft, unless the collection
 *   validates drafts) leaves `submitted` set while any stamp stands, so the
 *   kept errors stay visible.
 */

/** `undefined` and `null` both mean "no value". */
const normalize = (value: unknown): unknown => (value === undefined ? null : value)

/** The stamp `ADD_SERVER_ERRORS` leaves on a field it marks. */
export function stampServerError(
  field: Partial<FieldState> | undefined,
  message: string,
): FieldState['serverError'] {
  return { message, value: normalize(field?.value) }
}

/** Whether `value` differs from the value the field held when its server
 * error arrived (the user has acted on it). */
export function serverErrorAnswered(
  serverError: NonNullable<FieldState['serverError']>,
  value: unknown,
): boolean {
  return !dequal(normalize(value), serverError.value)
}

/** Whether any field still owes the user a server error. */
export function hasStandingServerErrors(state: FormState | undefined): boolean {
  return Object.values(state || {}).some((field) => Boolean(field?.serverError))
}

/** The parent path of every error path: the same rule `ADD_SERVER_ERRORS`
 * uses to fill `errorPaths` (a parent holds the error paths below it). */
function addErrorPaths(state: FormState, fieldErrorPaths: string[]): FormState {
  const withParents = fieldErrorPaths
    .map((fieldErrorPath) => {
      const segments = fieldErrorPath.split('.')
      return segments.length > 1
        ? { fieldErrorPath, parentPath: segments.slice(0, -1).join('.') }
        : null
    })
    .filter(Boolean) as { fieldErrorPath: string; parentPath: string }[]

  if (withParents.length === 0) {
    return state
  }

  const next = { ...state }

  for (const [path, field] of Object.entries(state)) {
    const owed = withParents
      .filter(({ parentPath }) => parentPath.startsWith(path))
      .map(({ fieldErrorPath }) => fieldErrorPath)
    const current = Array.isArray(field?.errorPaths) ? field.errorPaths : []
    const missing = owed.filter((fieldErrorPath) => !current.includes(fieldErrorPath))

    if (missing.length > 0) {
      next[path] = { ...field, errorPaths: [...current, ...missing] }
    }
  }

  return next
}

/**
 * After a merge: every field whose stamp still stands is invalid with its
 * message again, and its parents list it in `errorPaths` again (a merge
 * empties `errorPaths` the server did not send).
 */
export function holdStandingServerErrors(state: FormState): FormState {
  const standing = Object.entries(state).filter(([, field]) => field?.serverError)

  if (standing.length === 0) {
    return state
  }

  const next = { ...state }

  for (const [path, field] of standing) {
    if (field.valid !== false || field.errorMessage !== field.serverError.message) {
      next[path] = { ...field, errorMessage: field.serverError.message, valid: false }
    }
  }

  return addErrorPaths(
    next,
    standing.map(([path]) => path),
  )
}

/** `CLEAR_SERVER_ERRORS`: every stamp goes, its field is valid again, and no
 * parent lists it any more. */
export function clearServerErrors(state: FormState): FormState {
  const cleared = Object.entries(state || {})
    .filter(([, field]) => field?.serverError)
    .map(([path]) => path)

  if (cleared.length === 0) {
    return state
  }

  const next: FormState = {}

  for (const [path, field] of Object.entries(state)) {
    let nextField = field

    if (cleared.includes(path)) {
      const { errorMessage: _errorMessage, serverError: _serverError, ...rest } = field
      nextField = { ...rest, valid: true }
    }

    if (Array.isArray(nextField?.errorPaths)) {
      const kept = nextField.errorPaths.filter((errorPath) => !cleared.includes(errorPath))
      if (kept.length !== nextField.errorPaths.length) {
        nextField = { ...nextField, errorPaths: kept }
      }
    }

    next[path] = nextField
  }

  return next
}
