import type { FlattenedField } from '../../fields/config/types.js'
import type { CompoundIndex, SanitizedCompoundIndex } from './types.js'

import { InvalidConfiguration } from '../../errors/InvalidConfiguration.js'
import { getFieldByPath } from '../../utilities/getFieldByPath.js'

export const sanitizeCompoundIndexes = ({
  fields,
  indexes,
}: {
  fields: FlattenedField[]
  indexes: CompoundIndex[]
}): SanitizedCompoundIndex[] => {
  const sanitizedCompoundIndexes: SanitizedCompoundIndex[] = []

  for (const index of indexes) {
    const sanitized: SanitizedCompoundIndex = { fields: [], unique: index.unique ?? false }
    for (const path of index.fields) {
      let result = getFieldByPath({ fields, path })

      // Fork change #56: allow paths into the `{ relationTo, value }` shape of a
      // polymorphic relationship/upload field, e.g. `item.relationTo`. These are
      // stored sub-paths in MongoDB but not fields, so getFieldByPath cannot
      // resolve them. Without this, a compound index scoping uniqueness by the
      // related collection (`['store', 'item.relationTo', 'slug']`) is
      // impossible to express. MongoDB adapter only — SQL adapters store
      // polymorphic relationships in a separate rels table and cannot index
      // these paths.
      if (!result) {
        const segments = path.split('.')
        const subPath = segments.pop()
        if (segments.length > 0 && (subPath === 'relationTo' || subPath === 'value')) {
          const parent = getFieldByPath({ fields, path: segments.join('.') })
          if (
            parent &&
            (parent.field.type === 'relationship' || parent.field.type === 'upload') &&
            Array.isArray(parent.field.relationTo)
          ) {
            result = {
              field: parent.field,
              localizedPath: `${parent.localizedPath}.${subPath}`,
              pathHasLocalized: parent.pathHasLocalized,
            }
          }
        }
      }

      // Fork change #130: `id` names the document's own id even when the collection declares no
      // `id` field (a custom ID field is found above, as any field is). The database adapter maps it
      // to its id column: MongoDB's `_id`, and the version document's `parent` in a versions
      // collection. It lets an index end on the id, which every MongoDB sort ends on, so a scoped
      // list sorts on the index (`['store', 'createdAt', 'id']` → `{ store: 1, createdAt: 1, _id: 1 }`).
      if (!result && path === 'id') {
        result = {
          field: { name: 'id', type: 'text' } as FlattenedField,
          localizedPath: 'id',
          pathHasLocalized: false,
        }
      }

      if (!result) {
        throw new InvalidConfiguration(`Field ${path} was not found`)
      }

      const { field, localizedPath, pathHasLocalized } = result

      if (['array', 'blocks', 'group', 'tab'].includes(field.type)) {
        throw new InvalidConfiguration(
          `Compound index on ${field.type} cannot be set. Path: ${localizedPath}`,
        )
      }

      sanitized.fields.push({ field, localizedPath, path, pathHasLocalized })
    }

    sanitizedCompoundIndexes.push(sanitized)
  }

  return sanitizedCompoundIndexes
}
