import type { DocumentPreferences, Field, PayloadRequest } from 'payload'

import { describe, expect, it } from 'vitest'

import { reduceFieldsToValuesWithValidation } from '../../utilities/reduceFieldsToValuesWithValidation.js'
import { fieldSchemasToFormState } from './index.js'

/**
 * Covers the fork's `admin.disableFormData` field option end-to-end:
 * the option is evaluated server-side at form-state build time and stamped
 * onto form state as `disableFormDataSubtree`, which the reduce utilities
 * then honor by omitting the field AND its row subtree from submitted data
 * while form state itself keeps carrying the rows for rendering.
 */

const mockReq = {
  locale: 'en',
  payload: {
    blocks: {},
    logger: {
      error: () => {},
    },
  },
  t: (key: string) => key,
  user: null,
} as unknown as PayloadRequest

const buildFields = (
  disableFormData?: ((args: { data: Record<string, unknown> }) => boolean) | boolean,
): Field[] => [
  {
    name: 'type',
    type: 'text',
  },
  {
    name: 'curriculumMode',
    type: 'text',
  },
  {
    name: 'items',
    type: 'blocks',
    // Sanitized configs always carry an `admin` object — mirror that here
    admin: disableFormData !== undefined ? { disableFormData } : {},
    blocks: [
      {
        slug: 'lesson',
        fields: [
          {
            name: 'title',
            type: 'text',
          },
        ],
      },
    ],
  } as Field,
]

const slData = {
  curriculumMode: 'structuredLearning',
  items: [{ id: 'row-1', blockType: 'lesson', title: 'Stale row' }],
  type: 'curriculum',
}

const formBuilderData = {
  ...slData,
  curriculumMode: 'formBuilder',
}

const slPredicate = ({ data }: { data: Record<string, unknown> }) =>
  data?.type === 'curriculum' && data?.curriculumMode === 'structuredLearning'

const getFormState = async (fields: Field[], data: Record<string, unknown>) =>
  fieldSchemasToFormState({
    data,
    fields,
    fieldSchemaMap: undefined,
    operation: 'update',
    permissions: true,
    preferences: {} as DocumentPreferences,
    renderAllFields: true,
    req: mockReq,
    schemaPath: '',
    skipValidation: true,
  })

describe('admin.disableFormData option', () => {
  it('stamps disableFormDataSubtree: true when the predicate matches the document', async () => {
    const state = await getFormState(buildFields(slPredicate), slData)

    expect(state.items.disableFormDataSubtree).toBe(true)

    // Form state still carries the rows — rendering is unaffected
    expect(state['items.0.title'].value).toBe('Stale row')
    expect(state.items.rows).toHaveLength(1)

    // ...but the submitted data omits the field and its entire subtree
    const { data } = reduceFieldsToValuesWithValidation(state, true)
    expect(data.type).toBe('curriculum')
    expect(data.curriculumMode).toBe('structuredLearning')
    expect(data).not.toHaveProperty('items')
  })

  it('stamps disableFormDataSubtree: false when the predicate does not match', async () => {
    const state = await getFormState(buildFields(slPredicate), formBuilderData)

    // Explicit false, not absent — so client-side merges track flips
    expect(state.items.disableFormDataSubtree).toBe(false)

    const { data } = reduceFieldsToValuesWithValidation(state, true)
    expect(data.items).toEqual([{ id: 'row-1', blockType: 'lesson', title: 'Stale row' }])
  })

  it('supports a plain boolean config', async () => {
    const state = await getFormState(buildFields(true), formBuilderData)

    expect(state.items.disableFormDataSubtree).toBe(true)

    const { data } = reduceFieldsToValuesWithValidation(state, true)
    expect(data).not.toHaveProperty('items')
  })

  it('leaves form state untouched when the option is not configured', async () => {
    const state = await getFormState(buildFields(), slData)

    expect('disableFormDataSubtree' in state.items).toBe(false)

    const { data } = reduceFieldsToValuesWithValidation(state, true)
    expect(data.items).toEqual([{ id: 'row-1', blockType: 'lesson', title: 'Stale row' }])
  })
})
