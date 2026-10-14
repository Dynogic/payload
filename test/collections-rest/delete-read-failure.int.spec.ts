import type {
  CollectionAfterDeleteHook,
  FieldHook,
  Payload,
  SanitizedCollectionConfig,
} from 'payload'

import path from 'path'
import { fileURLToPath } from 'url'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { initPayloadInt } from '../__helpers/shared/initPayloadInt.js'
import { postsSlug } from './config.js'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

let payload: Payload

/**
 * Fork change #125: once a delete has removed the row, its afterDelete (and afterOperation) hooks
 * run even if the deleted document's read (field or collection afterRead) throws. The hooks get the
 * stored document; the answer is the id only.
 */
describe('Collections REST - a delete whose read-back throws', () => {
  let config: SanitizedCollectionConfig
  let throwOnRead: ((doc: Record<string, unknown>) => boolean) | false
  let afterDeleteDocs: Record<string, unknown>[]
  let afterOperationRuns: string[]
  let restore: (() => void)[]

  beforeAll(async () => {
    ;({ payload } = await initPayloadInt(dirname))
    config = payload.collections[postsSlug].config
  })

  afterAll(async () => {
    await payload.destroy()
  })

  beforeEach(() => {
    throwOnRead = false
    afterDeleteDocs = []
    afterOperationRuns = []
    restore = []

    const afterDelete: CollectionAfterDeleteHook = ({ doc }) => {
      afterDeleteDocs.push(doc)
    }
    config.hooks.afterDelete.push(afterDelete)
    restore.push(() =>
      config.hooks.afterDelete.splice(config.hooks.afterDelete.indexOf(afterDelete), 1),
    )

    const afterOperation = ({ operation, result }: { operation: string; result: unknown }) => {
      afterOperationRuns.push(operation)
      return result
    }
    config.hooks.afterOperation.push(afterOperation as never)
    restore.push(() =>
      config.hooks.afterOperation.splice(
        config.hooks.afterOperation.indexOf(afterOperation as never),
        1,
      ),
    )
  })

  afterEach(() => {
    restore.reverse().forEach((undo) => undo())
    vi.restoreAllMocks()
  })

  const throwFromCollectionAfterRead = () => {
    const hook = ({ doc }: { doc: Record<string, unknown> }) => {
      if (throwOnRead && throwOnRead(doc)) {
        throw new Error('afterRead blew up')
      }
      return doc
    }
    config.hooks.afterRead.push(hook as never)
    restore.push(() =>
      config.hooks.afterRead.splice(config.hooks.afterRead.indexOf(hook as never), 1),
    )
  }

  // Where a storage plugin builds `url`: a FIELD's afterRead.
  const throwFromFieldAfterRead = () => {
    const title = config.fields.find((field) => 'name' in field && field.name === 'title')!
    const hook: FieldHook = ({ siblingData, value }) => {
      if (throwOnRead && throwOnRead(siblingData)) {
        throw new Error('field afterRead blew up')
      }
      return value
    }
    title.hooks = { ...(title.hooks || {}), afterRead: [...(title.hooks?.afterRead || []), hook] }
    restore.push(() => {
      title.hooks!.afterRead = title.hooks!.afterRead!.filter((each) => each !== hook)
    })
  }

  it('deleteByID: a field afterRead that throws still runs afterDelete and afterOperation', async () => {
    throwFromFieldAfterRead()
    const errorSpy = vi.spyOn(payload.logger, 'error')
    const post = await payload.create({
      collection: postsSlug,
      data: { title: 'read-fails-field' },
    })

    throwOnRead = () => true
    const result = await payload.delete({ collection: postsSlug, id: post.id })

    expect(result).toStrictEqual({ id: post.id })
    expect(afterDeleteDocs).toHaveLength(1)
    expect(afterDeleteDocs[0]).toMatchObject({ id: post.id, title: 'read-fails-field' })
    expect(afterOperationRuns).toContain('deleteByID')
    expect(errorSpy).toHaveBeenCalled()
    await expect(payload.findByID({ collection: postsSlug, id: post.id })).rejects.toThrow()
  })

  it('deleteByID: a collection afterRead that throws still runs afterDelete', async () => {
    throwFromCollectionAfterRead()
    const post = await payload.create({ collection: postsSlug, data: { title: 'read-fails-hook' } })

    throwOnRead = () => true
    const result = await payload.delete({ collection: postsSlug, id: post.id })

    expect(result).toStrictEqual({ id: post.id })
    expect(afterDeleteDocs).toHaveLength(1)
    expect(afterDeleteDocs[0]).toMatchObject({ id: post.id, title: 'read-fails-hook' })
    await expect(payload.findByID({ collection: postsSlug, id: post.id })).rejects.toThrow()
  })

  it('deleteByID: a read that succeeds answers and hooks exactly as before', async () => {
    throwFromCollectionAfterRead()
    const post = await payload.create({ collection: postsSlug, data: { title: 'read-ok' } })

    const result = await payload.delete({ collection: postsSlug, id: post.id })

    expect(result).toMatchObject({ id: post.id, title: 'read-ok' })
    expect(afterDeleteDocs).toHaveLength(1)
    expect(afterDeleteDocs[0]).toMatchObject({ id: post.id, title: 'read-ok' })
  })

  it('bulk delete: one document whose read throws is still deleted, hooked and not an error', async () => {
    throwFromFieldAfterRead()
    const title = 'bulk-read-fails'
    const failing = await payload.create({ collection: postsSlug, data: { title } })
    const fine = await payload.create({ collection: postsSlug, data: { title } })

    throwOnRead = (doc) => doc.id === failing.id
    const result = await payload.delete({
      collection: postsSlug,
      where: { title: { equals: title } },
    })

    expect(result.errors).toHaveLength(0)
    expect(result.docs).toHaveLength(2)
    expect(result.docs).toContainEqual({ id: failing.id })
    expect(result.docs.find((doc) => doc.id === fine.id)).toMatchObject({ title })
    expect(afterDeleteDocs.map((doc) => doc.id).sort()).toStrictEqual([failing.id, fine.id].sort())
    expect(afterDeleteDocs.find((doc) => doc.id === failing.id)).toMatchObject({ title })
    expect(afterOperationRuns).toContain('delete')

    const remaining = await payload.find({
      collection: postsSlug,
      where: { title: { equals: title } },
    })
    expect(remaining.docs).toHaveLength(0)
  })
})
