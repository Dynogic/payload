import type { CollectionSlug, JsonObject, Payload } from '../../index.js'
import type { PayloadRequest } from '../../types/index.js'
import type { Collection, DataFromCollectionSlug } from '../config/types.js'

import { APIError } from '../../errors/index.js'
import { beforeChange } from '../../fields/hooks/beforeChange/index.js'
import { beforeValidate } from '../../fields/hooks/beforeValidate/index.js'
import { findByIDOperation } from './findByID.js'

export type ValidateArgs<TSlug extends CollectionSlug> = {
  collection: Collection
  data: Partial<DataFromCollectionSlug<TSlug>>
  /**
   * Required for `operation: 'update'`. Optional for `operation: 'create'`,
   * where there is no stored document to merge the proposed data onto.
   */
  id?: number | string
  operation?: 'create' | 'update'
  overrideAccess?: boolean
  payload: Payload
  req: PayloadRequest
}

/**
 * Dry-run field-level validation for a hypothetical create/update without
 * touching the database. Throws ValidationError on field validation failure;
 * resolves to void on success.
 *
 * Notes:
 * - Runs ONLY field-level beforeChange validation (where required-field and
 *   per-field validators live). Collection-level beforeValidate / beforeChange
 *   hooks are intentionally skipped — they may have side effects unsafe in a
 *   dry run.
 * - `operation: 'update'` reads the original doc (with overrideAccess: true so
 *   callers without read perms can still validate) and validates the proposed
 *   data merged onto it. `operation: 'create'` reads nothing: the submitted
 *   data IS the whole document, exactly as the real create operation sees it,
 *   so a document that does not exist yet can be pre-flighted.
 * - A create additionally runs the FIELD-level beforeValidate step first, the
 *   step the real create operation runs immediately before beforeChange: it
 *   computes default values for undefined fields. Without it every required
 *   field with a defaultValue that the caller did not spell out would read as
 *   missing. An update does not need it — the original doc already carries
 *   every stored value — and is left byte-identical to the original
 *   implementation.
 * - Access control on the validate call itself is enforced via the
 *   `overrideAccess` arg passed through to beforeChange.
 */
export const validateOperation = async <TSlug extends CollectionSlug>({
  id,
  collection,
  data,
  operation = 'update',
  overrideAccess = false,
  req,
}: ValidateArgs<TSlug>): Promise<void> => {
  if (!collection) {
    throw new APIError('Collection is required for validate operation.')
  }

  if (operation === 'update' && id === undefined) {
    throw new APIError('An id is required to validate an update. Validate Operation.')
  }

  // A create has no original document. The real create operation runs
  // beforeChange against an empty doc, so the dry run does the same — no
  // read, no id, and required-field rules see exactly what a create sees.
  const originalDoc: JsonObject =
    operation === 'create'
      ? {}
      : ((await findByIDOperation({
          id: id!,
          collection,
          depth: 0,
          disableErrors: false,
          draft: true,
          overrideAccess: true,
          req,
          showHiddenFields: true,
        })) as JsonObject)

  const dataToValidate =
    operation === 'create'
      ? await beforeValidate({
          collection: collection.config,
          context: req.context,
          data: { ...data } as JsonObject,
          doc: originalDoc,
          global: null,
          operation,
          overrideAccess,
          req,
        })
      : ({ ...originalDoc, ...data, id } as JsonObject)

  await beforeChange({
    id,
    collection: collection.config,
    context: req.context,
    data: dataToValidate,
    doc: originalDoc,
    docWithLocales: originalDoc,
    global: null,
    operation,
    overrideAccess,
    req,
    skipValidation: false,
  })
}
