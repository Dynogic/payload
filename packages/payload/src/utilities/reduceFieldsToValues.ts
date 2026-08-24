import type { Data, FormState } from '../admin/types.js'

import { unflatten as flatleyUnflatten } from './unflatten.js'
/**
 * Reduce flattened form fields (Fields) to just map to the respective values instead of the full FormField object
 *
 * @param unflatten This also unflattens the data if `unflatten` is true. The unflattened data should match the original data structure
 * @param ignoreDisableFormData - if true, will include fields that have `disableFormData` set to true, for example, blocks or arrays fields.
 *
 */
export const reduceFieldsToValues = (
  fields: FormState,
  unflatten?: boolean,
  ignoreDisableFormData?: boolean,
): Data => {
  let data: Record<string, any> = {}

  if (!fields) {
    return data
  }

  // Fields whose form state carries `disableFormDataSubtree` (stamped from the
  // `admin.disableFormData` field config) are omitted from submitted data along
  // with their ENTIRE subtree — every `<path>.`-prefixed key, i.e. array/block
  // rows and their subfields, which are otherwise submitted independently of
  // the parent's own `disableFormData` flag.
  let omittedSubtrees: null | string[] = null

  if (ignoreDisableFormData !== true) {
    for (const key of Object.keys(fields)) {
      if (fields[key]?.disableFormDataSubtree) {
        if (!omittedSubtrees) {
          omittedSubtrees = []
        }
        omittedSubtrees.push(key)
      }
    }
  }

  Object.keys(fields).forEach((key) => {
    if (ignoreDisableFormData === true || !fields[key]?.disableFormData) {
      if (
        omittedSubtrees &&
        omittedSubtrees.some((subtree) => key === subtree || key.startsWith(subtree + '.'))
      ) {
        return
      }

      data[key] = fields[key]?.value
    }
  })

  if (unflatten) {
    data = flatleyUnflatten(data)
  }

  return data
}
