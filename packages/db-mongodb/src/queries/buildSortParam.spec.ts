import type { Config, SanitizedConfig } from 'payload'
import { describe, beforeAll, it, expect } from 'vitest'

import { sanitizeConfig } from 'payload'

import { buildSortParam, toMongoSort } from './buildSortParam.js'
import { MongooseAdapter } from '../index.js'

let config: SanitizedConfig

describe('builds sort params', () => {
  beforeAll(async () => {
    config = await sanitizeConfig({
      localization: {
        defaultLocale: 'en',
        fallback: true,
        locales: ['en', 'es'],
      },
    } as Config)
  })
  it('adds a fallback on non-unique field', () => {
    const result = buildSortParam({
      config,
      parentIsLocalized: false,
      fields: [
        {
          name: 'title',
          type: 'text',
        },
        {
          name: 'order',
          type: 'number',
        },
      ],
      locale: 'en',
      sort: 'order',
      timestamps: true,
      adapter: {
        disableFallbackSort: false,
      } as MongooseAdapter,
    })

    expect(result).toStrictEqual({ order: 'asc', createdAt: 'desc', _id: 'desc' })
  })

  it('adds a fallback when sort isnt provided', () => {
    const result = buildSortParam({
      config,
      parentIsLocalized: false,
      fields: [
        {
          name: 'title',
          type: 'text',
        },
        {
          name: 'order',
          type: 'number',
        },
      ],
      locale: 'en',
      sort: undefined,
      timestamps: true,
      adapter: {
        disableFallbackSort: false,
      } as MongooseAdapter,
    })

    expect(result).toStrictEqual({ createdAt: 'desc', _id: 'desc' })
  })

  it('does not add a fallback on non-unique field when disableFallbackSort is true', () => {
    const result = buildSortParam({
      config,
      parentIsLocalized: false,
      fields: [
        {
          name: 'title',
          type: 'text',
        },
        {
          name: 'order',
          type: 'number',
        },
      ],
      locale: 'en',
      sort: 'order',
      timestamps: true,
      adapter: {
        disableFallbackSort: true,
      } as MongooseAdapter,
    })

    expect(result).toStrictEqual({ order: 'asc' })
  })

  // This test should be true even when disableFallbackSort is false
  it('does not add a fallback on unique field', () => {
    const result = buildSortParam({
      config,
      parentIsLocalized: false,
      fields: [
        {
          name: 'title',
          type: 'text',
        },
        {
          name: 'order',
          type: 'number',
          unique: true, // Marking this field as unique
        },
      ],
      locale: 'en',
      sort: 'order',
      timestamps: true,
      adapter: {
        disableFallbackSort: false,
      } as MongooseAdapter,
    })

    // Fork #130: no `createdAt` fallback, but still the `_id` tiebreak (a sparse unique index lets
    // every document without the value tie on null).
    expect(result).toStrictEqual({ order: 'asc', _id: 'asc' })
  })
})

// Fork #130: every sort ends on `_id`, so tied rows (a folder upload's files, created in the same
// millisecond) keep one order between page loads.
describe('ends every sort on _id (fork #130)', () => {
  const fields = [
    { name: 'title', type: 'text' },
    { name: 'order', type: 'number' },
  ] as const

  const build = ({
    disableFallbackSort = false,
    sort,
    timestamps = true,
  }: {
    disableFallbackSort?: boolean
    sort?: string | string[]
    timestamps?: boolean
  }) =>
    buildSortParam({
      adapter: { disableFallbackSort } as MongooseAdapter,
      config,
      fields: fields as any,
      locale: 'en',
      parentIsLocalized: false,
      sort,
      timestamps,
    })

  beforeAll(async () => {
    config = await sanitizeConfig({
      localization: { defaultLocale: 'en', fallback: true, locales: ['en', 'es'] },
    } as Config)
  })

  it('ends the default timestamp sort on _id, descending like createdAt', () => {
    expect(Object.entries(build({}))).toStrictEqual([
      ['createdAt', 'desc'],
      ['_id', 'desc'],
    ])
  })

  it('an explicit createdAt sort gets _id in its direction', () => {
    expect(build({ sort: 'createdAt' })).toStrictEqual({ createdAt: 'asc', _id: 'asc' })
    expect(build({ sort: '-createdAt' })).toStrictEqual({ createdAt: 'desc', _id: 'desc' })
  })

  it('takes the direction of the LAST sort key', () => {
    expect(Object.entries(build({ sort: ['-order', 'title'] }))).toStrictEqual([
      ['order', 'desc'],
      ['title', 'asc'],
      ['createdAt', 'desc'],
      ['_id', 'desc'],
    ])
    expect(Object.entries(build({ sort: ['order', 'createdAt'] }))).toStrictEqual([
      ['order', 'asc'],
      ['createdAt', 'asc'],
      ['_id', 'asc'],
    ])
  })

  it('a sort on id is left alone (one _id key, in its own direction and place)', () => {
    expect(build({ sort: 'id' })).toStrictEqual({ _id: 'asc', createdAt: 'desc' })
    expect(build({ sort: '-id' })).toStrictEqual({ _id: 'desc', createdAt: 'desc' })
    expect(Object.entries(build({ sort: ['-id', 'order'] }))).toStrictEqual([
      ['_id', 'desc'],
      ['order', 'asc'],
      ['createdAt', 'desc'],
    ])
  })

  it('a collection without timestamps keeps its -id fallback, with no second _id', () => {
    expect(build({ timestamps: false })).toStrictEqual({ _id: 'desc' })
    expect(build({ sort: 'order', timestamps: false })).toStrictEqual({
      order: 'asc',
      _id: 'desc',
    })
  })

  it('a draft sort (queryDrafts maps id to parent) still ends on the version _id', () => {
    expect(build({ sort: '-parent' })).toStrictEqual({
      parent: 'desc',
      createdAt: 'desc',
      _id: 'desc',
    })
  })

  it('disableFallbackSort turns the tiebreak off too', () => {
    expect(build({ disableFallbackSort: true })).toStrictEqual({ createdAt: 'desc' })
    expect(build({ disableFallbackSort: true, sort: 'order' })).toStrictEqual({ order: 'asc' })
  })

  it('a relationship sort ends on the root document _id', () => {
    const sortAggregation: any[] = []
    const result = buildSortParam({
      adapter: {
        collections: {
          authors: { collection: { name: 'authors' } },
        },
        disableFallbackSort: false,
        payload: {
          collections: {
            authors: {
              config: { slug: 'authors', flattenedFields: [{ name: 'name', type: 'text' }] },
            },
          },
        },
      } as unknown as MongooseAdapter,
      config,
      fields: [{ name: 'author', type: 'relationship', relationTo: 'authors' }] as any,
      locale: 'en',
      sort: '-author.name',
      sortAggregation,
      timestamps: true,
    })

    expect(sortAggregation).toHaveLength(1)
    expect(Object.entries(result)).toStrictEqual([
      ['__author.name', 'desc'],
      ['createdAt', 'desc'],
      ['_id', 'desc'],
    ])
  })
})

describe('toMongoSort (fork #130)', () => {
  it('keeps every key in order, as numeric directions', () => {
    expect(
      Object.entries(toMongoSort({ order: 'asc', createdAt: 'desc', _id: 'desc' })),
    ).toStrictEqual([
      ['order', 1],
      ['createdAt', -1],
      ['_id', -1],
    ])
  })
})
