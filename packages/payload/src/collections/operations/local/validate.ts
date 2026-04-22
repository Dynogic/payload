import type { CollectionSlug, Payload, RequestContext, TypedLocale } from '../../../index.js'
import type { Document, PayloadRequest } from '../../../types/index.js'
import type { CreateLocalReqOptions } from '../../../utilities/createLocalReq.js'
import type { DataFromCollectionSlug } from '../../config/types.js'

import { APIError } from '../../../errors/index.js'
import { createLocalReq } from '../../../utilities/createLocalReq.js'
import { validateOperation } from '../validate.js'

export type Options<TSlug extends CollectionSlug> = {
  /** the Collection slug to operate against. */
  collection: TSlug
  /** Hook context (merged onto req.context). */
  context?: RequestContext
  /** Proposed data — merged onto the existing doc before validation. */
  data: Partial<DataFromCollectionSlug<TSlug>>
  /** ID of the document to validate against. */
  id: number | string
  /** Locale for any localized field validation. */
  locale?: 'all' | TypedLocale
  /** Which operation's validation rules to apply. Defaults to 'update'. */
  operation?: 'create' | 'update'
  /** Skip access control on the validation. Defaults to false. */
  overrideAccess?: boolean
  /** Pass an existing PayloadRequest to share transaction / user / locale. */
  req?: Partial<PayloadRequest>
  /**
   * If overrideAccess is false, the user to authorize against. Same shape as
   * the user prop on every other local-API method.
   */
  user?: Document
}

/**
 * Dry-run validation for a hypothetical update on a document. Pure CPU — no
 * database mutation, no hooks with side effects, no transaction.
 *
 * Throws `ValidationError` on field validation failure; resolves to void on
 * success. Catch and inspect `err.data.errors` for field-level details
 * (`{ path, message, label? }[]`).
 *
 * @example
 * try {
 *   await payload.validate({
 *     collection: 'products',
 *     id: productId,
 *     data: { _status: 'published' },
 *     overrideAccess: false,
 *     user,
 *   })
 *   // would publish cleanly
 * } catch (err) {
 *   if (err instanceof ValidationError) {
 *     // err.data.errors is [{ path, message, label? }, ...]
 *   }
 * }
 */
export async function validateLocal<TSlug extends CollectionSlug>(
  payload: Payload,
  options: Options<TSlug>,
): Promise<void> {
  const {
    id,
    collection: collectionSlug,
    data,
    operation = 'update',
    overrideAccess = false,
  } = options

  const collection = payload.collections[collectionSlug]

  if (!collection) {
    throw new APIError(
      `The collection with slug ${String(collectionSlug)} can't be found. Validate Operation.`,
    )
  }

  return validateOperation<TSlug>({
    id,
    collection,
    data,
    operation,
    overrideAccess,
    payload,
    req: await createLocalReq(options as CreateLocalReqOptions, payload),
  })
}
