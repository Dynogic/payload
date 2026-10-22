import type {
  CollectionAfterDeleteHook,
  CollectionBeforeDeleteHook,
  Payload,
  SanitizedCollectionConfig,
} from 'payload'

import path from 'path'
import { commitTransaction, createLocalReq, initTransaction, killTransaction } from 'payload'
import { fileURLToPath } from 'url'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { initPayloadInt } from '../__helpers/shared/initPayloadInt.js'
import { postsSlug } from './config.js'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

let payload: Payload

type IDDoc = { id: number | string }

/**
 * Fork change #127: a delete reads the row, and another writer removes it before this delete's own
 * database delete. The database delete then finds nothing. That delete is not this one: it answers
 * NotFound (as a delete of a missing id does), and no afterRead or afterDelete hook runs on nothing.
 *
 * Fork change #128 closes the batched bulk path: the adapter's `deleteMany({ returnIDs: true })`
 * names the ids it removed, and only those are hooked and reported as deleted.
 *
 * The concurrent writer is simulated by a beforeDelete hook (which runs after the read and before
 * the database delete) removing the row straight through the adapter, with no hooks of its own.
 */
describe('Collections REST - a delete whose row another writer removed first', () => {
  let config: SanitizedCollectionConfig
  let removeFirst: Set<number | string>
  let removeOutside: Set<number | string>
  let afterDeleteDocs: unknown[]
  let afterReadDocs: unknown[]
  let restore: (() => void)[]

  beforeAll(async () => {
    ;({ payload } = await initPayloadInt(dirname))
    config = payload.collections[postsSlug].config
  })

  afterAll(async () => {
    await payload.destroy()
  })

  beforeEach(() => {
    removeFirst = new Set()
    removeOutside = new Set()
    afterDeleteDocs = []
    afterReadDocs = []
    restore = []

    const beforeDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
      if (removeFirst.has(id) || removeOutside.has(id)) {
        await req.payload.db.deleteOne({
          collection: postsSlug,
          // Without `req`, outside this delete's transaction (where there is one).
          req: removeOutside.has(id) ? undefined : req,
          returning: false,
          where: { id: { equals: id } },
        })
      }
    }
    config.hooks.beforeDelete.push(beforeDelete)
    restore.push(() =>
      config.hooks.beforeDelete.splice(config.hooks.beforeDelete.indexOf(beforeDelete), 1),
    )

    const afterDelete: CollectionAfterDeleteHook = ({ doc }) => {
      afterDeleteDocs.push(doc)
    }
    config.hooks.afterDelete.push(afterDelete)
    restore.push(() =>
      config.hooks.afterDelete.splice(config.hooks.afterDelete.indexOf(afterDelete), 1),
    )
  })

  afterEach(() => {
    restore.reverse().forEach((undo) => undo())
  })

  // Registered only once the documents exist, so it records the delete's read alone.
  const recordAfterRead = () => {
    const afterRead = ({ doc }: { doc: unknown }) => {
      afterReadDocs.push(doc)
      return doc
    }
    config.hooks.afterRead.push(afterRead as never)
    restore.push(() =>
      config.hooks.afterRead.splice(config.hooks.afterRead.indexOf(afterRead as never), 1),
    )
  }

  // Whether this database runs operations in transactions (a MongoDB replica set does; a standalone
  // MongoDB and the default SQLite adapter do not). The simulated writer removes the row inside the
  // delete's own transaction, so where a NotFound rolls that transaction back, the row comes back
  // with it: the rollback is the point there, not the row's absence.
  const usesTransactions = async () => {
    const req = await createLocalReq({}, payload)
    const started = await initTransaction(req)
    if (started) {
      await killTransaction(req)
    }
    return started
  }

  it('deleteByID: answers NotFound and runs no read or afterDelete hook', async () => {
    const post = await payload.create({ collection: postsSlug, data: { title: 'gone-first' } })
    recordAfterRead()

    removeFirst.add(post.id)

    await expect(payload.delete({ id: post.id, collection: postsSlug })).rejects.toMatchObject({
      name: 'NotFound',
      status: 404,
    })
    expect(afterDeleteDocs).toHaveLength(0)
    expect(afterReadDocs).toHaveLength(0)

    const { totalDocs } = await payload.count({
      collection: postsSlug,
      where: { id: { equals: post.id } },
    })
    expect(totalDocs).toBe((await usesTransactions()) ? 1 : 0)
  })

  it('deleteByID: the same NotFound as a delete of an id that never existed', async () => {
    const post = await payload.create({ collection: postsSlug, data: { title: 'gone-compare' } })
    removeFirst.add(post.id)

    const raced = await payload.delete({ id: post.id, collection: postsSlug }).catch((e) => e)
    const missing = await payload.delete({ id: post.id, collection: postsSlug }).catch((e) => e)

    expect(raced.constructor).toBe(missing.constructor)
    expect(raced.message).toBe(missing.message)
    expect(raced.status).toBe(missing.status)
  })

  it('bulk delete, one transaction per document: the removed row is a NotFound error and runs no hook', async () => {
    const original = payload.db.bulkOperationsSingleTransaction
    payload.db.bulkOperationsSingleTransaction = true

    try {
      const title = 'bulk-gone-first-single'
      const gone = await payload.create({ collection: postsSlug, data: { title } })
      const fine = await payload.create({ collection: postsSlug, data: { title } })
      recordAfterRead()

      removeFirst.add(gone.id)
      const result = await payload.delete({
        collection: postsSlug,
        where: { title: { equals: title } },
      })

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toMatchObject({ id: gone.id })
      expect(result.docs.map((doc) => doc.id)).toStrictEqual([fine.id])
      expect(afterDeleteDocs).toHaveLength(1)
      expect(afterDeleteDocs[0]).toMatchObject({ id: fine.id })
      expect(afterReadDocs.every(Boolean)).toBe(true)

      const { totalDocs } = await payload.count({
        collection: postsSlug,
        where: { title: { equals: title } },
      })
      expect(totalDocs).toBe((await usesTransactions()) ? 1 : 0)
    } finally {
      payload.db.bulkOperationsSingleTransaction = original
    }
  })

  it('bulk delete, batched: the removed row is a NotFound error and runs no hook; the others are deleted and hooked once', async () => {
    const title = 'bulk-gone-first-batched'
    const first = await payload.create({ collection: postsSlug, data: { title } })
    const gone = await payload.create({ collection: postsSlug, data: { title } })
    const last = await payload.create({ collection: postsSlug, data: { title } })
    recordAfterRead()

    const afterOperationDocs: unknown[] = []
    const afterOperation = ({
      operation,
      result,
    }: {
      operation: string
      result: { docs: unknown[] }
    }) => {
      if (operation === 'delete') {
        afterOperationDocs.push(...result.docs)
      }
      return result
    }
    config.hooks.afterOperation.push(afterOperation as never)
    restore.push(() =>
      config.hooks.afterOperation.splice(
        config.hooks.afterOperation.indexOf(afterOperation as never),
        1,
      ),
    )

    removeFirst.add(gone.id)
    const result = await payload.delete({
      collection: postsSlug,
      where: { title: { equals: title } },
    })

    // The same message a delete of a missing id answers with.
    const notFound = await payload
      .delete({ id: gone.id, collection: postsSlug })
      .catch((error) => error)
    expect(notFound.name).toBe('NotFound')

    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toMatchObject({
      id: gone.id,
      isPublic: true,
      message: notFound.message,
    })
    expect(result.docs.map((doc) => doc.id).sort()).toStrictEqual([first.id, last.id].sort())

    // Each removed row's afterDelete ran exactly once; the gone row's never ran.
    const hooked = afterDeleteDocs.map((doc) => (doc as IDDoc).id)
    expect(hooked.sort()).toStrictEqual([first.id, last.id].sort())
    expect(afterReadDocs.every(Boolean)).toBe(true)
    expect(afterReadDocs.map((doc) => (doc as IDDoc).id)).not.toContain(gone.id)
    expect(afterOperationDocs.map((doc) => (doc as IDDoc).id).sort()).toStrictEqual(
      [first.id, last.id].sort(),
    )

    const { totalDocs } = await payload.count({
      collection: postsSlug,
      where: { title: { equals: title } },
    })
    expect(totalDocs).toBe(0)
  })

  it('bulk delete, batched, the other writer outside this transaction: the gone row is never hooked', async () => {
    const title = 'bulk-gone-first-outside'
    const first = await payload.create({ collection: postsSlug, data: { title } })
    const gone = await payload.create({ collection: postsSlug, data: { title } })
    recordAfterRead()

    removeOutside.add(gone.id)
    const result = await payload.delete({
      collection: postsSlug,
      where: { title: { equals: title } },
    })

    const hooked = afterDeleteDocs.map((doc) => (doc as IDDoc).id)
    expect(hooked).not.toContain(gone.id)
    expect(result.docs.map((doc) => doc.id)).not.toContain(gone.id)
    expect(result.errors.map(({ id }) => id)).toContain(gone.id)

    const { totalDocs: firstLeft } = await payload.count({
      collection: postsSlug,
      where: { id: { equals: first.id } },
    })
    await payload.delete({ collection: postsSlug, where: { title: { equals: title } } })

    // No transaction, or one that lets the batch through (Postgres, READ COMMITTED): the other row
    // is deleted and hooked once, the gone one is the one error. A MongoDB transaction instead: the
    // batch's delete hits a write conflict on the row the other writer took after this
    // transaction's snapshot, so the whole batch fails, rolls back, and nothing is hooked.
    const batchFailed = result.docs.length === 0
    expect({
      docs: result.docs.map((doc) => doc.id),
      errorIDs: result.errors.map(({ id }) => String(id)).sort(),
      firstLeft,
      hooked,
    }).toStrictEqual(
      batchFailed
        ? {
            docs: [],
            errorIDs: [String(first.id), String(gone.id)].sort(),
            firstLeft: 1,
            hooked: [],
          }
        : { docs: [first.id], errorIDs: [String(gone.id)], firstLeft: 0, hooked: [first.id] },
    )
  })

  it('bulk delete, batched: nothing raced, every row is deleted and hooked once with no errors', async () => {
    const title = 'bulk-batched-no-race'
    const a = await payload.create({ collection: postsSlug, data: { title } })
    const b = await payload.create({ collection: postsSlug, data: { title } })

    const result = await payload.delete({
      collection: postsSlug,
      where: { title: { equals: title } },
    })

    expect(result.errors).toHaveLength(0)
    expect(result.docs.map((doc) => doc.id).sort()).toStrictEqual([a.id, b.id].sort())
    expect(afterDeleteDocs.map((doc) => (doc as IDDoc).id).sort()).toStrictEqual(
      [a.id, b.id].sort(),
    )
  })

  describe('adapter deleteMany({ returnIDs })', () => {
    it('resolves exactly the ids it removed, never one already gone', async () => {
      const title = 'adapter-return-ids'
      const a = await payload.create({ collection: postsSlug, data: { title } })
      const gone = await payload.create({ collection: postsSlug, data: { title } })
      const b = await payload.create({ collection: postsSlug, data: { title } })

      await payload.db.deleteOne({
        collection: postsSlug,
        returning: false,
        where: { id: { equals: gone.id } },
      })

      const deleted = await payload.db.deleteMany({
        collection: postsSlug,
        returnIDs: true,
        where: { id: { in: [a.id, gone.id, b.id] } },
      })

      expect(deleted).toBeTruthy()
      expect(deleted!.ids.map(String).sort()).toStrictEqual([String(a.id), String(b.id)].sort())
      // The ids come back as a read returns them, so they compare to a document's id directly.
      expect(deleted!.ids).toContain(a.id)
    })

    it('resolves an empty list when nothing matched', async () => {
      const deleted = await payload.db.deleteMany({
        collection: postsSlug,
        returnIDs: true,
        where: { title: { equals: 'adapter-return-ids-nothing' } },
      })

      expect(deleted).toStrictEqual({ ids: [] })
    })

    it('resolves nothing without returnIDs, as before', async () => {
      const title = 'adapter-no-return-ids'
      await payload.create({ collection: postsSlug, data: { title } })

      const deleted = await payload.db.deleteMany({
        collection: postsSlug,
        where: { title: { equals: title } },
      })

      expect(deleted).toBeUndefined()

      const { totalDocs } = await payload.count({
        collection: postsSlug,
        where: { title: { equals: title } },
      })
      expect(totalDocs).toBe(0)
    })

    it('inside a transaction (as the bulk delete calls it): a row removed earlier in it is not reported', async () => {
      const title = 'adapter-return-ids-in-transaction'
      const a = await payload.create({ collection: postsSlug, data: { title } })
      const b = await payload.create({ collection: postsSlug, data: { title } })

      // Inside a transaction, as the bulk delete operation calls it.
      const req = await createLocalReq({}, payload)
      await initTransaction(req)

      try {
        await payload.db.deleteOne({
          collection: postsSlug,
          req,
          returning: false,
          where: { id: { equals: b.id } },
        })

        const deleted = await payload.db.deleteMany({
          collection: postsSlug,
          req,
          returnIDs: true,
          where: { title: { equals: title } },
        })

        expect(deleted!.ids.map(String)).toStrictEqual([String(a.id)])
        await commitTransaction(req)
      } catch (error) {
        await killTransaction(req)
        throw error
      }
    })
  })
})
