import type { DeleteOptions } from 'mongodb'

import { type DeleteMany } from 'payload'

import type { MongooseAdapter } from './index.js'

import { buildQuery } from './queries/buildQuery.js'
import { getCollection } from './utilities/getEntity.js'
import { getSession } from './utilities/getSession.js'
import { isObjectID } from './utilities/isObjectID.js'

export const deleteMany: DeleteMany = async function deleteMany(
  this: MongooseAdapter,
  { collection: collectionSlug, req, returnIDs, where },
) {
  const { collectionConfig, Model } = getCollection({ adapter: this, collectionSlug })

  const query = await buildQuery({
    adapter: this,
    collectionSlug,
    fields: collectionConfig.flattenedFields,
    where,
  })

  const session = await getSession(this, req)

  const options: DeleteOptions = {
    session,
  }

  if (!returnIDs) {
    await Model.deleteMany(query, options)
    return
  }

  // Fork change #128: name exactly the documents THIS call removed. MongoDB has no
  // `DELETE … RETURNING`, and a `deleteMany`'s `deletedCount` says how many, never which: once a
  // count falls short, the documents another writer took are indistinguishable from ours.
  const candidates = await Model.find(query, { _id: 1 }, { lean: true, session })

  if (!candidates.length) {
    return { ids: [] }
  }

  // The id as a read returns it (see `transform`).
  const toID = (_id: unknown): number | string => {
    if (isObjectID(_id)) {
      return _id.toHexString()
    }
    if (typeof _id === 'bigint') {
      return Number(_id)
    }
    return _id as number | string
  }

  if (session) {
    // Inside a transaction: one read, one write. The read sees the transaction's snapshot, and a
    // document another writer removes or changes after that snapshot makes this `deleteMany` fail
    // with a write conflict (the whole transaction rolls back) instead of skipping it. So every
    // candidate is removed by this statement, or the statement throws. A short count can only mean
    // that guarantee did not hold (a compatibility layer without snapshot write conflicts): which
    // ids were someone else's is then unknowable, so it answers "unknown" (no `ids`) and the caller
    // falls back to treating every candidate as removed, as before #128.
    const result = await Model.deleteMany(
      { $and: [query, { _id: { $in: candidates.map(({ _id }) => _id) } }] },
      options,
    )

    if (result.deletedCount !== candidates.length) {
      this.payload.logger.warn(
        `deleteMany on "${collectionSlug}" removed ${result.deletedCount} of ${candidates.length} matched documents inside a transaction; cannot tell which, so the removed ids are not reported`,
      )
      return
    }

    return { ids: candidates.map(({ _id }) => toID(_id)) }
  }

  // No transaction (a standalone server, or transactions disabled): one `deleteOne` per document,
  // sent together. Each one's `deletedCount` (0 or 1) says whether THIS call removed that document,
  // so there is no race window: a document another writer removed at any point before its own
  // `deleteOne` is reported as not removed. The cost is one write per document instead of one per
  // batch. MongoDB 8's client-level `bulkWrite` with `verboseResults` could do it in one command;
  // it is not used because older servers and the compatibility layers lack it.
  const removed = await Promise.all(
    candidates.map(async ({ _id }) => {
      const result = await Model.deleteOne({ $and: [query, { _id }] })
      return result.deletedCount === 1 ? toID(_id) : null
    }),
  )

  return { ids: removed.filter((id): id is number | string => id !== null) }
}
