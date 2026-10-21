import type {
  CollectionAfterDeleteHook,
  CollectionBeforeDeleteHook,
  Payload,
  SanitizedCollectionConfig,
} from 'payload'

import path from 'path'
import { fileURLToPath } from 'url'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { initPayloadInt } from '../__helpers/shared/initPayloadInt.js'
import { postsSlug } from './config.js'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

let payload: Payload

/**
 * Fork change #127: a delete reads the row, and another writer removes it before this delete's own
 * database delete. The database delete then finds nothing. That delete is not this one: it answers
 * NotFound (as a delete of a missing id does), and no afterRead or afterDelete hook runs on nothing.
 *
 * The concurrent writer is simulated by a beforeDelete hook (which runs after the read and before
 * the database delete) removing the row straight through the adapter, with no hooks of its own.
 */
describe('Collections REST - a delete whose row another writer removed first', () => {
  let config: SanitizedCollectionConfig
  let removeFirst: Set<number | string>
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
    afterDeleteDocs = []
    afterReadDocs = []
    restore = []

    const beforeDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
      if (removeFirst.has(id)) {
        await req.payload.db.deleteOne({
          collection: postsSlug,
          req,
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
    expect(totalDocs).toBe(0)
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
      expect(totalDocs).toBe(0)
    } finally {
      payload.db.bulkOperationsSingleTransaction = original
    }
  })

  it('bulk delete, batched: no hook ever sees a null document', async () => {
    const title = 'bulk-gone-first-batched'
    const gone = await payload.create({ collection: postsSlug, data: { title } })
    const fine = await payload.create({ collection: postsSlug, data: { title } })
    recordAfterRead()

    removeFirst.add(gone.id)
    const result = await payload.delete({
      collection: postsSlug,
      where: { title: { equals: title } },
    })

    expect(result.docs.map((doc) => doc.id)).toContain(fine.id)
    expect(afterDeleteDocs.every(Boolean)).toBe(true)
    expect(afterReadDocs.every(Boolean)).toBe(true)

    const { totalDocs } = await payload.count({
      collection: postsSlug,
      where: { title: { equals: title } },
    })
    expect(totalDocs).toBe(0)
  })
})
