import type { FormState } from 'payload'

import { describe, expect, it } from 'vitest'

import { reduceFieldsToValuesWithValidation } from './reduceFieldsToValuesWithValidation.js'

describe('reduceFieldsToValuesWithValidation', () => {
  const baseFields: FormState = {
    items: {
      disableFormData: true,
      valid: true,
      value: 2,
    },
    'items.0.id': {
      valid: true,
      value: 'row-1',
    },
    'items.0.title': {
      valid: true,
      value: 'First',
    },
    'items.1.id': {
      valid: true,
      value: 'row-2',
    },
    'items.1.title': {
      valid: true,
      value: 'Second',
    },
    title: {
      valid: true,
      value: 'Doc title',
    },
  }

  it('drops keys flagged with disableFormData but keeps their row subfields', () => {
    const { data, valid } = reduceFieldsToValuesWithValidation(baseFields, true)

    expect(data.title).toBe('Doc title')
    expect(data.items).toEqual([
      { id: 'row-1', title: 'First' },
      { id: 'row-2', title: 'Second' },
    ])
    expect(valid).toBe(true)
  })

  describe('disableFormDataSubtree', () => {
    const fieldsWithSubtree: FormState = {
      ...baseFields,
      items: {
        disableFormData: true,
        disableFormDataSubtree: true,
        valid: true,
        value: 2,
      },
    }

    it('drops the flagged key and its entire subtree from submitted data', () => {
      const { data } = reduceFieldsToValuesWithValidation(fieldsWithSubtree, true)

      expect(data.title).toBe('Doc title')
      expect(data).not.toHaveProperty('items')
    })

    it('omitted subtree keys do not contribute to validity', () => {
      const { data, valid } = reduceFieldsToValuesWithValidation(
        {
          ...fieldsWithSubtree,
          'items.0.title': {
            valid: false,
            value: 'First',
          },
        },
        true,
      )

      expect(data).not.toHaveProperty('items')
      expect(valid).toBe(true)
    })

    it('included fields still contribute to validity', () => {
      const { valid } = reduceFieldsToValuesWithValidation(
        {
          ...fieldsWithSubtree,
          title: {
            valid: false,
            value: 'Doc title',
          },
        },
        true,
      )

      expect(valid).toBe(false)
    })

    it('is bypassed entirely when ignoreDisableFormData is true', () => {
      const { data } = reduceFieldsToValuesWithValidation(fieldsWithSubtree, false, true)

      expect(data.items).toBe(2)
      expect(data['items.0.title']).toBe('First')
    })
  })
})
