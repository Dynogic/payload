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

type FieldStateLike = { passesCondition?: boolean } | undefined

export type ServerFieldError = { message?: unknown; path?: unknown }

/**
 * A path is ON SCREEN when the form holds a field state for it that passes
 * its condition — that field renders, so ADD_SERVER_ERRORS frames it.
 */
export const isFieldOnScreen = (
  fields: Record<string, FieldStateLike> | undefined,
  path: string,
): boolean => {
  const field = fields?.[path]
  return Boolean(field) && field.passesCondition !== false
}

/**
 * The messages of the path errors that have no field on screen, trimmed and
 * de-duplicated, in server order. Empty when every path is on screen (the
 * stock "The following field is invalid: …" toast then stays), or when the
 * off-screen entries carry no message of their own.
 */
export const offScreenErrorMessages = ({
  errors,
  fields,
}: {
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

    if (isFieldOnScreen(fields, error.path)) {
      continue
    }

    const message = typeof error.message === 'string' ? error.message.trim() : ''

    if (message && !messages.includes(message)) {
      messages.push(message)
    }
  }

  return messages
}
