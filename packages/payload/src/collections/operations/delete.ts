import { status as httpStatus } from 'http-status'

import type { AccessResult } from '../../config/types.js'
import type { CollectionSlug, FindOptions } from '../../index.js'
import type { PayloadRequest, PopulateType, SelectType, Where } from '../../types/index.js'
import type {
  BulkOperationResult,
  Collection,
  DataFromCollectionSlug,
  SelectFromCollectionSlug,
} from '../config/types.js'

import { executeAccess } from '../../auth/executeAccess.js'
import { combineQueries } from '../../database/combineQueries.js'
import { validateQueryPaths } from '../../database/queryValidation/validateQueryPaths.js'
import { sanitizeWhereQuery } from '../../database/sanitizeWhereQuery.js'
import { APIError, Locked, NotFound } from '../../errors/index.js'
import { afterRead } from '../../fields/hooks/afterRead/index.js'
import { deleteUserPreferences } from '../../preferences/deleteUserPreferences.js'
import { deleteAssociatedFiles } from '../../uploads/deleteAssociatedFiles.js'
import { appendNonTrashedFilter } from '../../utilities/appendNonTrashedFilter.js'
import {
  checkDocumentLockStatus,
  deleteDocumentLocks,
  getLockedDocumentIds,
} from '../../utilities/checkDocumentLockStatus.js'
import { commitTransaction } from '../../utilities/commitTransaction.js'
import { hasScheduledPublishEnabled } from '../../utilities/getVersionsConfig.js'
import { initTransaction } from '../../utilities/initTransaction.js'
import { isErrorPublic } from '../../utilities/isErrorPublic.js'
import { killTransaction } from '../../utilities/killTransaction.js'
import { sanitizeSelect } from '../../utilities/sanitizeSelect.js'
import { deleteCollectionVersions } from '../../versions/deleteCollectionVersions.js'
import { deleteScheduledPublishJobs } from '../../versions/deleteScheduledPublishJobs.js'
import { buildAfterOperation } from './utilities/buildAfterOperation.js'
import { buildBeforeOperation } from './utilities/buildBeforeOperation.js'
import { readDeletedDoc, unreadDeletedDoc } from './utilities/readDeletedDoc.js'

export type Arguments = {
  collection: Collection
  depth?: number
  disableTransaction?: boolean
  overrideAccess?: boolean
  overrideLock?: boolean
  populate?: PopulateType
  req: PayloadRequest
  showHiddenFields?: boolean
  trash?: boolean
  where: Where
} & Pick<FindOptions<string, SelectType>, 'select'>

export const deleteOperation = async <
  TSlug extends CollectionSlug,
  TSelect extends SelectFromCollectionSlug<TSlug>,
>(
  incomingArgs: Arguments,
): Promise<BulkOperationResult<TSlug, TSelect>> => {
  let args = incomingArgs

  if (args.collection.config.disableBulkDelete && !args.overrideAccess) {
    throw new APIError(`Collection ${args.collection.config.slug} has disabled bulk delete`, 403)
  }

  try {
    const shouldCommit =
      !args.disableTransaction &&
      !args.req.payload.db.bulkOperationsSingleTransaction &&
      (await initTransaction(args.req))
    // /////////////////////////////////////
    // beforeOperation - Collection
    // /////////////////////////////////////

    args = await buildBeforeOperation({
      args,
      collection: args.collection.config,
      operation: 'delete',
      overrideAccess: args.overrideAccess!,
    })

    const {
      collection: { config: collectionConfig },
      depth,
      overrideAccess,
      overrideLock,
      populate,
      req: {
        fallbackLocale,
        locale,
        payload: { config },
        payload,
      },
      req,
      select: incomingSelect,
      showHiddenFields,
      trash = false,
      where,
    } = args

    if (!where) {
      throw new APIError("Missing 'where' query of documents to delete.", httpStatus.BAD_REQUEST)
    }

    // /////////////////////////////////////
    // Access
    // /////////////////////////////////////

    let accessResult: AccessResult

    if (!overrideAccess) {
      accessResult = await executeAccess({ req }, collectionConfig.access.delete)
    }

    await validateQueryPaths({
      collectionConfig,
      overrideAccess: overrideAccess!,
      req,
      where,
    })

    let fullWhere = combineQueries(where, accessResult!)

    // Exclude trashed documents when trash: false
    fullWhere = appendNonTrashedFilter({
      enableTrash: collectionConfig.trash,
      trash,
      where: fullWhere,
    })

    sanitizeWhereQuery({ fields: collectionConfig.flattenedFields, payload, where: fullWhere })

    const select = sanitizeSelect({
      fields: collectionConfig.flattenedFields,
      forceSelect: collectionConfig.forceSelect,
      select: incomingSelect,
    })

    // /////////////////////////////////////
    // Retrieve documents
    // /////////////////////////////////////

    const { docs } = await payload.db.find<DataFromCollectionSlug<TSlug>>({
      collection: collectionConfig.slug,
      locale: locale!,
      req,
      select,
      where: fullWhere,
    })

    const errors: BulkOperationResult<TSlug, TSelect>['errors'] = []
    let didBatchDeleteFail = false

    type Doc = DataFromCollectionSlug<TSlug>
    type ResultDoc = BulkOperationResult<TSlug, TSelect>['docs'][number]

    const pushError = (id: number | string, error: unknown, message?: string) => {
      errors.push({
        id,
        isPublic: error instanceof Error ? isErrorPublic(error, config) : false,
        message: message ?? (error instanceof Error ? error.message : 'Unknown error'),
      })
    }

    // /////////////////////////////////////
    // beforeDelete - Collection, and associated files
    // /////////////////////////////////////

    const runBeforeDeleteWork = async (doc: Doc) => {
      if (collectionConfig.hooks?.beforeDelete?.length) {
        for (const hook of collectionConfig.hooks.beforeDelete) {
          await hook({
            id: doc.id,
            collection: collectionConfig,
            context: req.context,
            req,
          })
        }
      }

      await deleteAssociatedFiles({
        collectionConfig,
        config,
        doc,
        overrideDelete: true,
        req,
      })
    }

    // /////////////////////////////////////
    // afterRead - Fields, afterRead - Collection, afterDelete - Collection
    // /////////////////////////////////////

    const runAfterDeleteWork = async (doc: Doc): Promise<ResultDoc> => {
      // The document is gone: a read that throws no longer takes the afterDelete hooks down with
      // it (fork change #125). They run on the stored document, and the answer withholds it.
      const readBack = await readDeletedDoc({
        collectionConfig,
        doc,
        read: async () => {
          let result = await afterRead({
            collection: collectionConfig,
            context: req.context,
            depth: depth!,
            doc,
            // @ts-expect-error - vestiges of when tsconfig was not strict. Feel free to improve
            draft: undefined,
            fallbackLocale: fallbackLocale!,
            global: null,
            locale: locale!,
            overrideAccess: overrideAccess!,
            populate,
            req,
            select,
            showHiddenFields: showHiddenFields!,
          })

          // Add collection property for auth collections
          if (collectionConfig.auth) {
            result = { ...result, collection: collectionConfig.slug }
          }

          if (collectionConfig.hooks?.afterRead?.length) {
            for (const hook of collectionConfig.hooks.afterRead) {
              result =
                (await hook({
                  collection: collectionConfig,
                  context: req.context,
                  doc: result || doc,
                  overrideAccess,
                  req,
                })) || result
            }
          }

          return result
        },
        req,
      })

      let result = readBack.doc

      if (collectionConfig.hooks?.afterDelete?.length) {
        for (const hook of collectionConfig.hooks.afterDelete) {
          result =
            (await hook({
              id: doc.id,
              collection: collectionConfig,
              context: req.context,
              doc: result,
              req,
            })) || result
        }
      }

      if (readBack.readFailed) {
        result = unreadDeletedDoc(result, collectionConfig)
      }

      return result as ResultDoc
    }

    /**
     * One transaction and one set of database calls per document. Only used when
     * `bulkOperationsSingleTransaction` is enabled, which requires each document to be committed
     * on its own and therefore cannot share a batched write with the rest of the operation.
     */
    const deleteDocumentIndividually = async (doc: Doc): Promise<null | ResultDoc> => {
      try {
        const docShouldCommit = await initTransaction(req)

        await checkDocumentLockStatus({
          id: doc.id,
          collectionSlug: collectionConfig.slug,
          lockErrorMessage: `Document with ID ${doc.id} is currently locked and cannot be deleted.`,
          overrideLock,
          req,
        })

        await runBeforeDeleteWork(doc)

        if (collectionConfig.versions) {
          await deleteCollectionVersions({
            id: doc.id,
            slug: collectionConfig.slug,
            payload,
            req,
          })
        }

        if (hasScheduledPublishEnabled(collectionConfig)) {
          await deleteScheduledPublishJobs({
            id: doc.id,
            slug: collectionConfig.slug,
            payload,
            req,
          })
        }

        const deleted = await payload.db.deleteOne({
          collection: collectionConfig.slug,
          req,
          select: { id: true },
          where: {
            id: {
              equals: doc.id,
            },
          },
        })

        // Found above, gone now: another writer deleted it in between. Reported as the NotFound a
        // delete of a missing id raises, with no afterDelete hooks run for a delete that was not
        // this one (fork change #127).
        if (!deleted) {
          throw new NotFound(req.t)
        }

        const result = await runAfterDeleteWork(doc)

        if (docShouldCommit) {
          await commitTransaction(req)
        }

        return result
      } catch (error) {
        await killTransaction(req)
        pushError(doc.id, error)

        return null
      }
    }

    /**
     * Deletes the whole batch using a constant number of database calls, independent of how many
     * documents matched. Hooks still run per document, they just no longer each carry a write.
     */
    const deleteDocumentsInBulk = async (): Promise<(null | ResultDoc)[]> => {
      const results: (null | ResultDoc)[] = new Array(docs.length).fill(null)

      // /////////////////////////////////////
      // Handle potentially locked documents
      // /////////////////////////////////////

      const lockedIds = await getLockedDocumentIds({
        collectionSlug: collectionConfig.slug,
        ids: docs.map(({ id }) => id),
        overrideLock,
        req,
      })

      const unlocked: { doc: Doc; index: number }[] = []

      docs.forEach((doc, index) => {
        if (lockedIds.has(String(doc.id))) {
          pushError(
            doc.id,
            new Locked(`Document with ID ${doc.id} is currently locked and cannot be deleted.`),
          )

          return
        }

        unlocked.push({ doc, index })
      })

      await deleteDocumentLocks({
        collectionSlug: collectionConfig.slug,
        ids: unlocked.map(({ doc }) => doc.id),
        req,
      })

      const deletable: { doc: Doc; index: number }[] = []

      await Promise.all(
        unlocked.map(async (entry) => {
          try {
            await runBeforeDeleteWork(entry.doc)
            deletable.push(entry)
          } catch (error) {
            pushError(entry.doc.id, error)
          }
        }),
      )

      if (!deletable.length) {
        return results
      }

      const ids = deletable.map(({ doc }) => doc.id)

      // /////////////////////////////////////
      // Delete versions
      // /////////////////////////////////////

      if (collectionConfig.versions) {
        await deleteCollectionVersions({
          slug: collectionConfig.slug,
          ids,
          payload,
          req,
        })
      }

      // /////////////////////////////////////
      // Delete scheduled posts
      // /////////////////////////////////////

      if (hasScheduledPublishEnabled(collectionConfig)) {
        await deleteScheduledPublishJobs({
          slug: collectionConfig.slug,
          ids,
          payload,
          req,
        })
      }

      // /////////////////////////////////////
      // Delete documents
      // /////////////////////////////////////

      let removedIDs: null | Set<string> = null

      try {
        const deleted = await payload.db.deleteMany({
          collection: collectionConfig.slug,
          req,
          returnIDs: true,
          where: {
            id: {
              in: ids,
            },
          },
        })

        // An adapter that cannot say which ids it removed resolves nothing: every document in the
        // batch is then taken as removed, as before fork change #128.
        if (deleted) {
          removedIDs = new Set(deleted.ids.map(String))
        }
      } catch (error) {
        didBatchDeleteFail = true

        if (shouldCommit) {
          await killTransaction(req)
        }

        // The delete covers the whole batch, so a failure here belongs to the batch rather than to
        // any single document. Say so explicitly, otherwise one batch failure reads as N unrelated
        // per-document failures.
        const message = `Bulk delete failed for this batch of ${deletable.length} documents: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`

        for (const { doc } of deletable) {
          pushError(doc.id, error, message)
        }

        return results
      }

      await Promise.all(
        deletable.map(async (entry) => {
          // Found above, gone before the batch's delete: another writer removed it, and ran its own
          // hooks. Reported as the NotFound a delete of a missing id raises, with no read and no
          // afterDelete here; afterOperation never sees it either (fork change #128, closing the
          // batched path's gap left by #127).
          if (removedIDs && !removedIDs.has(String(entry.doc.id))) {
            pushError(entry.doc.id, new NotFound(req.t))
            return
          }

          try {
            results[entry.index] = await runAfterDeleteWork(entry.doc)
          } catch (error) {
            pushError(entry.doc.id, error)
          }
        }),
      )

      return results
    }

    let awaitedDocs: (null | ResultDoc)[]

    if (req.payload.db.bulkOperationsSingleTransaction) {
      // Process sequentially so that each document's transaction is isolated from the next
      awaitedDocs = []

      for (const doc of docs) {
        awaitedDocs.push(await deleteDocumentIndividually(doc))
      }
    } else {
      awaitedDocs = await deleteDocumentsInBulk()
    }

    // /////////////////////////////////////
    // Delete Preferences
    // /////////////////////////////////////

    if (!didBatchDeleteFail) {
      await deleteUserPreferences({
        collectionConfig,
        ids: docs.map(({ id }) => id),
        payload,
        req,
      })
    }

    let result = {
      docs: awaitedDocs.filter((doc): doc is ResultDoc => Boolean(doc)),
      errors,
    }

    // /////////////////////////////////////
    // afterOperation - Collection
    // /////////////////////////////////////

    result = await buildAfterOperation({
      args,
      collection: collectionConfig,
      operation: 'delete',
      overrideAccess,
      result,
    })

    if (shouldCommit && !didBatchDeleteFail) {
      await commitTransaction(req)
    }

    return result
  } catch (error: unknown) {
    await killTransaction(args.req)
    throw error
  }
}
