import type { Data, FormState } from 'payload'

import { unflatten as flatleyUnflatten } from 'payload/shared'

type ReturnType = {
  data: Data
  valid: boolean
}

/**
 * Reduce flattened form fields (Fields) to just map to the respective values instead of the full FormField object
 *
 * @param unflatten This also unflattens the data if `unflatten` is true. The unflattened data should match the original data structure
 * @param ignoreDisableFormData - if true, will include fields that have `disableFormData` set to true, for example, blocks or arrays fields.
 *
 */
export const reduceFieldsToValuesWithValidation = (
  fields: FormState,
  unflatten?: boolean,
  ignoreDisableFormData?: boolean,
): ReturnType => {
  const state: ReturnType = {
    data: {},
    valid: true,
  }

  if (!fields) {
    return state
  }

  // Fields whose form state carries `disableFormDataSubtree` (stamped from the
  // `admin.disableFormData` field config) are omitted from submitted data along
  // with their ENTIRE subtree — every `<path>.`-prefixed key, i.e. array/block
  // rows and their subfields, which are otherwise submitted independently of
  // the parent's own `disableFormData` flag. Omitted keys contribute neither
  // values nor validity, mirroring how `disableFormData` keys are handled.
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

      state.data[key] = fields[key]?.value
      if (!fields[key].valid) {
        state.valid = false
      }
    }
  })

  if (unflatten) {
    state.data = flatleyUnflatten(state.data)
  }

  return state
}
