import type { JsonArray, JsonObject } from '../../../types/index.js'

import { deepCopyObjectSimple } from '../../../utilities/deepCopyObject.js'

/**
 * The value an update falls back to when its data leaves a field out: the stored
 * document's value, copied at EVERY depth (fork #131).
 *
 * The traversal goes on into this copy as the incoming data, with the stored value
 * beside it as `siblingDoc`, and field access refuses a value by deleting it from
 * the data. A one-level copy left every nested object (a group in an array row, a
 * group in a group) shared between the two, so a refusal two levels down deleted
 * the stored value too, the fall-back to it found nothing, and the save wrote the
 * field away. A field hook mutating its sibling data reached the stored document
 * the same way. Only the omitted field's own value is copied, never the whole doc.
 */
export const cloneDataFromOriginalDoc = (
  originalDocData: JsonArray | JsonObject,
): JsonArray | JsonObject => {
  if (typeof originalDocData === 'object' && originalDocData !== null) {
    return deepCopyObjectSimple(originalDocData)
  }

  return originalDocData
}
