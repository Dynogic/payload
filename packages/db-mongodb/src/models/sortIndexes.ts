import type { Schema, SchemaType } from 'mongoose'

/**
 * Fork #130: the indexes a timestamped collection's DEFAULT sorts walk.
 *
 * Every sort ends on `_id` (`buildSortParam`), so a default sort is never one key: a collection's
 * list sorts `{ createdAt: -1, _id: -1 }`, `findVersions` / `findGlobalVersions` sort
 * `{ updatedAt: -1, createdAt: -1, _id: -1 }` (upstream's `createdAt` fallback, then `_id`), and
 * `queryDrafts` sorts `{ 'version.createdAt': -1, createdAt: -1, _id: -1 }`. A single-field index
 * cannot serve a sort with more keys after it, so an unfiltered page would scan the whole
 * collection and sort it in memory. Each of these sorts gets the compound index it walks (in either
 * direction), which REPLACES the single-field `index: true` Payload declares on its first key: the
 * compound serves every query the single-field index served (its first key is the same).
 */
export type SortIndex = {
  /** The path whose single-field `index: true` the compound replaces (its first key). */
  path: string
  /** The keys after it, in sort order. */
  then: string[]
}

/** A collection with timestamps: its list's default sort. */
export const CollectionSortIndexes: SortIndex[] = [{ path: 'createdAt', then: ['_id'] }]

/** A versions collection (a collection's or a global's): `findVersions`' default sort, and its own `createdAt`. */
export const VersionSortIndexes: SortIndex[] = [
  { path: 'updatedAt', then: ['createdAt', '_id'] },
  { path: 'createdAt', then: ['_id'] },
]

/** A drafts collection's versions with timestamps: `queryDrafts`' default sort. */
export const DraftSortIndexes: SortIndex[] = [
  { path: 'version.createdAt', then: ['createdAt', '_id'] },
]

/**
 * `index: true` as Mongoose holds it: `true`, or an options object with nothing set (`formatBaseSchema`
 * also passes `unique: false`, which Mongoose records as `{ unique: false }`).
 */
const isPlainIndex = (index: unknown): boolean => {
  if (index === true) {
    return true
  }

  if (index && typeof index === 'object') {
    return Object.values(index).every((value) => value === false || value === undefined)
  }

  return false
}

/**
 * Replaces each path's plain single-field index with its compound sort index. A path that is not
 * in the schema, or whose index is anything but a plain `index: true` (unique, sparse, a direction,
 * an index type, or none), is left as it is.
 */
export const applySortIndexes = ({
  indexes,
  schema,
}: {
  indexes: SortIndex[]
  schema: Schema
}): void => {
  for (const { path, then } of indexes) {
    const schemaType = schema.path(path) as ({ _index?: unknown } & SchemaType) | undefined

    if (!schemaType || !isPlainIndex(schemaType._index)) {
      continue
    }

    schemaType.index(false)

    const definition: Record<string, 1> = { [path]: 1 }

    for (const key of then) {
      definition[key] = 1
    }

    schema.index(definition)
  }
}
