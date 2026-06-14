import type { CollectionSlug, JsonObject, Payload } from '../../index.js'
import type { PayloadRequest } from '../../types/index.js'
import type { Collection, DataFromCollectionSlug } from '../config/types.js'

import { APIError } from '../../errors/index.js'
import { beforeChange } from '../../fields/hooks/beforeChange/index.js'
import { findByIDOperation } from './findByID.js'

export type ValidateArgs<TSlug extends CollectionSlug> = {
  collection: Collection
  data: Partial<DataFromCollectionSlug<TSlug>>
  id: number | string
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
 * - The original doc is read with overrideAccess: true so callers without
 *   read perms can still validate; access control on the validate call
 *   itself is enforced via the `overrideAccess` arg passed through to
 *   beforeChange.
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

  const originalDoc = (await findByIDOperation({
    id,
    collection,
    depth: 0,
    disableErrors: false,
    draft: true,
    overrideAccess: true,
    req,
    showHiddenFields: true,
  })) as JsonObject

  await beforeChange({
    id,
    collection: collection.config,
    context: req.context,
    data: { ...originalDoc, ...data, id } as JsonObject,
    doc: originalDoc,
    docWithLocales: originalDoc,
    global: null,
    operation,
    overrideAccess,
    req,
    skipValidation: false,
  })
}
