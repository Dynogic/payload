import type { I18nClient } from '@payloadcms/translations'
import type { ClientField } from 'payload'

import React from 'react'
import { describe, expect, it, vi } from 'vitest'

// Mock react globally so JSX works in combineFieldLabel
vi.stubGlobal('React', React)

import { reduceFieldsToOptions } from './reduceFieldsToOptions.js'

const mockI18n = {
  t: (key: string) => key,
} as unknown as I18nClient

describe('reduceFieldsToOptions', () => {
  describe('array fields with disableListFilter', () => {
    it('should not recurse into array sub-fields when disableListFilter is true', () => {
      const fields: ClientField[] = [
        {
          name: 'myArray',
          type: 'array',
          fields: [
            {
              name: 'subField',
              type: 'text',
              label: 'Sub Field',
            },
          ],
          label: 'My Array',
          admin: {
            disableListFilter: true,
          },
        } as ClientField,
      ]

      const result = reduceFieldsToOptions({
        fieldPermissions: true,
        fields,
        i18n: mockI18n,
      })

      // Should return empty since the array has disableListFilter: true
      // No sub-fields (like 'id' or 'subField') should appear
      expect(result).toEqual([])
    })

    it('should still recurse into array sub-fields when disableListFilter is not set', () => {
      const fields: ClientField[] = [
        {
          name: 'myArray',
          type: 'array',
          fields: [
            {
              name: 'subField',
              type: 'text',
              label: 'Sub Field',
            },
          ],
          label: 'My Array',
        } as ClientField,
      ]

      const result = reduceFieldsToOptions({
        fieldPermissions: true,
        fields,
        i18n: mockI18n,
      })

      // Should recurse and find the sub-field
      expect(result.length).toBeGreaterThan(0)
      expect(result.some((f) => f.value === 'myArray.subField')).toBe(true)
    })
  })
})
