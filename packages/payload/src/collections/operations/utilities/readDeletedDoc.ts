import type { PayloadRequest } from '../../../types/index.js'
import type { SanitizedCollectionConfig } from '../../config/types.js'

/**
 * The read-back of a document a delete has ALREADY removed (fork change #125).
 *
 * A delete runs: database delete, then the deleted doc's read (field `afterRead` hooks, which is
 * where a storage plugin builds `url`, then collection `afterRead` hooks), then `afterDelete`. The
 * read only shapes the answer, but upstream let it throw out of the operation: the row was gone and
 * every `afterDelete` hook (the place a collection cleans up what the row owned: stored objects,
 * counters, children) never ran, or, inside a transaction, the delete rolled back after work had
 * already happened. A delete that has happened is a delete: when the read throws, the error is
 * logged and the caller carries on with the raw document for its hooks.
 *
 * Upstream behaviour is unchanged when the read succeeds.
 */
export const readDeletedDoc = async <TDoc>({
  collectionConfig,
  doc,
  read,
  req,
}: {
  collectionConfig: SanitizedCollectionConfig
  /** The document as the database adapter returned it, already deleted. */
  doc: TDoc
  /** The read: field and collection `afterRead`, returning the shaped document. */
  read: () => Promise<TDoc>
  req: PayloadRequest
}): Promise<{ doc: TDoc; readFailed: boolean }> => {
  try {
    return { doc: await read(), readFailed: false }
  } catch (error: unknown) {
    req.payload.logger.error({
      err: error,
      msg: `Reading deleted document ${String((doc as { id?: unknown } | undefined)?.id)} of "${collectionConfig.slug}" failed; its afterDelete hooks run with the stored document`,
    })

    return { doc, readFailed: true }
  }
}

/**
 * What a delete whose read failed answers with: the id (and, for an auth collection, the
 * `collection` property the read path adds). Never the stored document itself, which has not
 * been through field read access or `hidden` stripping.
 */
export const unreadDeletedDoc = <TDoc>(
  doc: TDoc,
  collectionConfig: SanitizedCollectionConfig,
): TDoc =>
  ({
    id: (doc as { id: number | string }).id,
    ...(collectionConfig.auth ? { collection: collectionConfig.slug } : {}),
  }) as TDoc
