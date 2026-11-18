import type { Config, Payload, SanitizedConfig } from 'payload'

import { buildVersionCollectionFields, buildVersionCompoundIndexes, sanitizeConfig } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { buildCollectionSchema } from './buildCollectionSchema.js'
import { buildSchema } from './buildSchema.js'
import {
  applySortIndexes,
  CollectionSortIndexes,
  DraftSortIndexes,
  VersionSortIndexes,
} from './sortIndexes.js'

// Fork #130: every sort ends on `_id`, so a default sort walks a compound index, never the single
// `createdAt` / `updatedAt` index Payload declares; and a collection's `indexes` can end on `id`.

let config: SanitizedConfig

const keysOf = (schema: ReturnType<typeof buildSchema>) =>
  schema.indexes().map(([definition]) => Object.entries(definition))

const collection = (slug: string) => config.collections.find((each) => each.slug === slug)!

const buildCollection = (slug: string) => {
  const schema = buildCollectionSchema(collection(slug), {
    collections: {},
    config,
  } as unknown as Payload)
  applySortIndexes({ indexes: CollectionSortIndexes, schema })
  return schema
}

const buildVersions = (slug: string) => {
  const sanitized = collection(slug)
  const schema = buildSchema({
    buildSchemaOptions: {
      disableUnique: true,
      draftsEnabled: true,
      options: { minimize: false, timestamps: false },
    },
    compoundIndexes: buildVersionCompoundIndexes({ indexes: sanitized.sanitizedIndexes }),
    configFields: buildVersionCollectionFields(config, sanitized),
    payload: { collections: {}, config } as unknown as Payload,
  })
  applySortIndexes({ indexes: [...VersionSortIndexes, ...DraftSortIndexes], schema })
  return schema
}

describe('sort indexes (fork #130)', () => {
  beforeAll(async () => {
    config = await sanitizeConfig({
      collections: [
        {
          slug: 'files',
          fields: [
            { name: 'store', type: 'text' },
            { name: 'title', type: 'text' },
          ],
          indexes: [{ fields: ['store', 'createdAt', 'id'] }, { fields: ['store', 'title'] }],
        },
        {
          slug: 'pages',
          fields: [{ name: 'store', type: 'text' }],
          indexes: [{ fields: ['store', 'createdAt', 'id'] }],
          versions: { drafts: true },
        },
        {
          slug: 'custom-ids',
          fields: [
            { name: 'id', type: 'text' },
            { name: 'store', type: 'text' },
          ],
          indexes: [{ fields: ['store', 'id'], unique: true }],
        },
        {
          slug: 'no-timestamps',
          fields: [{ name: 'title', type: 'text' }],
          timestamps: false,
        },
      ],
    } as unknown as Config)
  })

  it("replaces a collection's single createdAt index with { createdAt: 1, _id: 1 }", () => {
    const indexes = keysOf(buildCollection('files'))

    expect(indexes).toContainEqual([
      ['createdAt', 1],
      ['_id', 1],
    ])
    expect(indexes).not.toContainEqual([['createdAt', 1]])
    // updatedAt is no default sort's first key: its single index stays
    expect(indexes).toContainEqual([['updatedAt', 1]])
  })

  it('gives a versions collection the findVersions and queryDrafts sort indexes', () => {
    const indexes = keysOf(buildVersions('pages'))

    expect(indexes).toContainEqual([
      ['updatedAt', 1],
      ['createdAt', 1],
      ['_id', 1],
    ])
    expect(indexes).toContainEqual([
      ['createdAt', 1],
      ['_id', 1],
    ])
    expect(indexes).toContainEqual([
      ['version.createdAt', 1],
      ['createdAt', 1],
      ['_id', 1],
    ])
    expect(indexes).not.toContainEqual([['updatedAt', 1]])
    expect(indexes).not.toContainEqual([['createdAt', 1]])
    expect(indexes).not.toContainEqual([['version.createdAt', 1]])
  })

  it('leaves a path alone that is missing or not a plain index: true', () => {
    const schema = buildCollection('no-timestamps')
    expect(keysOf(schema)).not.toContainEqual([
      ['createdAt', 1],
      ['_id', 1],
    ])

    const unique = buildCollectionSchema(collection('files'), {
      collections: {},
      config,
    } as unknown as Payload)
    unique.path('createdAt').index({ unique: true })
    applySortIndexes({ indexes: CollectionSortIndexes, schema: unique })
    expect(keysOf(unique)).toContainEqual([['createdAt', 1]])
    expect(keysOf(unique)).not.toContainEqual([
      ['createdAt', 1],
      ['_id', 1],
    ])
  })

  it("lets a collection's indexes name id: _id on the collection, parent on its versions", () => {
    expect(keysOf(buildCollection('files'))).toContainEqual([
      ['store', 1],
      ['createdAt', 1],
      ['_id', 1],
    ])
    expect(keysOf(buildCollection('files'))).toContainEqual([
      ['store', 1],
      ['title', 1],
    ])
    expect(keysOf(buildVersions('pages'))).toContainEqual([
      ['version.store', 1],
      ['version.createdAt', 1],
      ['parent', 1],
    ])
  })

  it('maps a custom id field to _id, keeping the index options', () => {
    const schema = buildCollection('custom-ids')
    const index = schema
      .indexes()
      .find(([definition]) => 'store' in definition && '_id' in definition)

    expect(index).toBeDefined()
    expect(Object.entries(index![0])).toStrictEqual([
      ['store', 1],
      ['_id', 1],
    ])
    expect(index![1]).toMatchObject({ unique: true })
  })

  it('still refuses a path that is neither a field nor id', async () => {
    await expect(
      sanitizeConfig({
        collections: [{ slug: 'bad', fields: [], indexes: [{ fields: ['nope', 'id'] }] }],
      } as unknown as Config),
    ).rejects.toThrow('Field nope was not found')
  })
})
