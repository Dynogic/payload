import { describe, expect, it } from 'vitest'

import type { CollectionConfig } from '../collections/config/types.js'
import type { Config } from '../config/types.js'
import type { Field } from '../fields/config/types.js'

import { getBaseUploadFields } from './getBaseFields.js'

const mockCollection: CollectionConfig = {
  slug: 'media',
  upload: true,
  fields: [],
} as unknown as CollectionConfig

const mockConfig = {} as Config

describe('getBaseUploadFields', () => {
  describe('width and height fields', () => {
    it('should have disableListColumn on width field', () => {
      const fields = getBaseUploadFields({ collection: mockCollection, config: mockConfig })

      const widthField = fields.find((f) => 'name' in f && f.name === 'width') as Field & {
        admin: Record<string, unknown>
      }

      expect(widthField).toBeDefined()
      expect(widthField.admin.disableListColumn).toBe(true)
    })

    it('should have disableListFilter on width field', () => {
      const fields = getBaseUploadFields({ collection: mockCollection, config: mockConfig })

      const widthField = fields.find((f) => 'name' in f && f.name === 'width') as Field & {
        admin: Record<string, unknown>
      }

      expect(widthField).toBeDefined()
      expect(widthField.admin.disableListFilter).toBe(true)
    })

    it('should have disableListColumn on height field', () => {
      const fields = getBaseUploadFields({ collection: mockCollection, config: mockConfig })

      const heightField = fields.find((f) => 'name' in f && f.name === 'height') as Field & {
        admin: Record<string, unknown>
      }

      expect(heightField).toBeDefined()
      expect(heightField.admin.disableListColumn).toBe(true)
    })

    it('should have disableListFilter on height field', () => {
      const fields = getBaseUploadFields({ collection: mockCollection, config: mockConfig })

      const heightField = fields.find((f) => 'name' in f && f.name === 'height') as Field & {
        admin: Record<string, unknown>
      }

      expect(heightField).toBeDefined()
      expect(heightField.admin.disableListFilter).toBe(true)
    })
  })
})
