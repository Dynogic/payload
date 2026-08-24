import type { FormState } from '../admin/types.js'

import { describe, expect, it } from 'vitest'

import { reduceFieldsToValues } from './reduceFieldsToValues.js'

describe('reduceFieldsToValues', () => {
  const baseFields: FormState = {
    items: {
      disableFormData: true,
      value: 2,
    },
    'items.0.id': {
      value: 'row-1',
    },
    'items.0.title': {
      value: 'First',
    },
    'items.1.id': {
      value: 'row-2',
    },
    'items.1.title': {
      value: 'Second',
    },
    title: {
      value: 'Doc title',
    },
  }

  it('drops keys flagged with disableFormData but keeps their row subfields', () => {
    const data = reduceFieldsToValues(baseFields, true)

    expect(data.title).toBe('Doc title')
    expect(data.items).toEqual([
      { id: 'row-1', title: 'First' },
      { id: 'row-2', title: 'Second' },
    ])
  })

  it('includes disableFormData keys when ignoreDisableFormData is true', () => {
    const data = reduceFieldsToValues(baseFields, false, true)

    expect(data.items).toBe(2)
    expect(data['items.0.title']).toBe('First')
  })

  describe('disableFormDataSubtree', () => {
    const fieldsWithSubtree: FormState = {
      ...baseFields,
      items: {
        disableFormData: true,
        disableFormDataSubtree: true,
        value: 2,
      },
    }

    it('drops the flagged key and its entire subtree from submitted data', () => {
      const data = reduceFieldsToValues(fieldsWithSubtree, true)

      expect(data.title).toBe('Doc title')
      expect(data).not.toHaveProperty('items')
    })

    it('does not drop sibling keys that merely share a name prefix', () => {
      const data = reduceFieldsToValues(
        {
          ...fieldsWithSubtree,
          itemsCount: {
            value: 2,
          },
        },
        true,
      )

      expect(data.itemsCount).toBe(2)
      expect(data).not.toHaveProperty('items')
    })

    it('keeps the subtree when the marker is explicitly false', () => {
      const data = reduceFieldsToValues(
        {
          ...fieldsWithSubtree,
          items: {
            disableFormData: true,
            disableFormDataSubtree: false,
            value: 2,
          },
        },
        true,
      )

      expect(data.items).toEqual([
        { id: 'row-1', title: 'First' },
        { id: 'row-2', title: 'Second' },
      ])
    })

    it('is bypassed entirely when ignoreDisableFormData is true', () => {
      const data = reduceFieldsToValues(fieldsWithSubtree, false, true)

      expect(data.items).toBe(2)
      expect(data['items.0.title']).toBe('First')
    })
  })
})
