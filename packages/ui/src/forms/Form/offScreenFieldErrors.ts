/**
 * Fork change #97 — a server ValidationError for a path with no field on
 * screen toasts the error's OWN message, not the raw path.
 *
 * Payload's `ValidationError` message is "The following field is invalid:
 * <label or path>". For a field on screen that is fine: the field frames
 * itself red (ADD_SERVER_ERRORS) and the toast names it. For a path with no
 * field on screen (a hook-validated virtual path, a field the form does not
 * render), nothing frames and the toast shows the raw path — `items.0.offer`
 * — which the viewer cannot act on. The per-path `message` is the sentence
 * the server wrote for that fault (an app's already-localized sentence), so
 * the toast says that instead.
 */

type FieldStateLike =
  | { claimedByComponent?: boolean; hidden?: boolean; passesCondition?: boolean }
  | undefined

export type ServerFieldError = { message?: unknown; path?: unknown }

/**
 * A path is ON SCREEN when the form holds a field state for it that passes
 * its condition — that field renders, so ADD_SERVER_ERRORS frames it.
 *
 * Fork #98: an `admin.hidden` field (`hidden: true`) renders no stock
 * control, so it is on screen only while a mounted component claims its path
 * (`useClaimFieldPath` → `claimedPaths`). A static `claimedByComponent`
 * declaration does NOT put it on screen — it only badges the tab; while the
 * claiming component is unmounted nothing shows the error, so it toasts.
 */
export const isFieldOnScreen = (
  fields: Record<string, FieldStateLike> | undefined,
  path: string,
  claimedPaths?: ReadonlySet<string>,
): boolean => {
  const field = fields?.[path]
  if (!field || field.passesCondition === false) {
    return false
  }
  return !field.hidden || Boolean(claimedPaths?.has(path))
}

/**
 * Fork #99 (revises #97, #98): true when the entry carries at least one path
 * error and EVERY one of its paths is on screen (per `isFieldOnScreen`, so a
 * claimed hidden field counts as on screen and an unclaimed one does not).
 * Each of those fields frames itself and shows its own message, so the Form
 * toasts the stock "Please correct invalid fields." (the same toast
 * client-side validation uses) instead of `FieldErrorsToast`, which repeats
 * what the frame already says and names an unlabelled path raw.
 */
export const allErrorPathsOnScreen = ({
  claimedPaths,
  errors,
  fields,
}: {
  claimedPaths?: ReadonlySet<string>
  errors: unknown
  fields: Record<string, FieldStateLike> | undefined
}): boolean => {
  if (!Array.isArray(errors)) {
    return false
  }

  let sawPath = false

  for (const error of errors as ServerFieldError[]) {
    if (!error || typeof error.path !== 'string' || !error.path) {
      continue
    }

    sawPath = true

    if (!isFieldOnScreen(fields, error.path, claimedPaths)) {
      return false
    }
  }

  return sawPath
}

export type ServerErrorToast =
  | { kind: 'correctInvalidFields' }
  | { kind: 'offScreen'; messages: string[] }
  | { kind: 'stock' }

/**
 * Fork #99: which toast a 4xx error entry gets.
 *
 * - some paths off screen and they carry messages: those messages (#97);
 * - every path on screen: "Please correct invalid fields." (#99);
 * - otherwise (no path errors, or off-screen paths with no message of their
 *   own): the stock `FieldErrorsToast`.
 */
export const serverErrorToast = (args: {
  claimedPaths?: ReadonlySet<string>
  errors: unknown
  fields: Record<string, FieldStateLike> | undefined
}): ServerErrorToast => {
  const messages = offScreenErrorMessages(args)

  if (messages.length > 0) {
    return { kind: 'offScreen', messages }
  }

  if (allErrorPathsOnScreen(args)) {
    return { kind: 'correctInvalidFields' }
  }

  return { kind: 'stock' }
}

/**
 * The messages of the path errors that have no field on screen, trimmed and
 * de-duplicated, in server order. Empty when every path is on screen (the
 * Form then toasts "Please correct invalid fields.", #99), or when the
 * off-screen entries carry no message of their own (stock toast).
 */
export const offScreenErrorMessages = ({
  claimedPaths,
  errors,
  fields,
}: {
  /** Fork #98: the paths claimed by mounted components. */
  claimedPaths?: ReadonlySet<string>
  errors: unknown
  fields: Record<string, FieldStateLike> | undefined
}): string[] => {
  if (!Array.isArray(errors)) {
    return []
  }

  const messages: string[] = []

  for (const error of errors as ServerFieldError[]) {
    if (!error || typeof error.path !== 'string' || !error.path) {
      continue
    }

    if (isFieldOnScreen(fields, error.path, claimedPaths)) {
      continue
    }

    const message = typeof error.message === 'string' ? error.message.trim() : ''

    if (message && !messages.includes(message)) {
      messages.push(message)
    }
  }

  return messages
}
