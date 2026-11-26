import type { SanitizedCollectionConfig } from '../../../collections/config/types.js'
import type { JsonObject, PayloadRequest } from '../../../types/index.js'
import type { Field } from '../../config/types.js'

import { describe, expect, it } from 'vitest'

import { beforeValidate } from './index.js'

type FieldAccessResult = {
  accessResult: boolean
  path: string
}

const runBeforeValidate = async ({
  fields,
  overrideAccess = false,
}: {
  fields: Field[]
  overrideAccess?: boolean
}): Promise<FieldAccessResult[]> => {
  const fieldAccessResults: FieldAccessResult[] = []

  await beforeValidate({
    collection: { fields } as SanitizedCollectionConfig,
    context: {},
    data: Object.fromEntries(fields.map((field) => ['name' in field ? field.name : '', 'value'])),
    doc: {} as JsonObject,
    global: null,
    onFieldAccess: (fieldAccessResult) => {
      fieldAccessResults.push(fieldAccessResult)
    },
    operation: 'create',
    overrideAccess,
    req: { context: {}, payload: {} } as PayloadRequest,
  })

  return fieldAccessResults
}

describe('beforeValidate field access results', () => {
  it('should report explicit and implicit field access results', async () => {
    const fieldAccessResults = await runBeforeValidate({
      fields: [
        {
          name: 'explicitlyAllowed',
          type: 'text',
          access: { create: () => true },
        },
        {
          name: 'explicitlyDenied',
          type: 'text',
          access: { create: () => false },
        },
        {
          name: 'implicitlyAllowed',
          type: 'text',
        },
      ],
    })

    expect(fieldAccessResults).toHaveLength(3)
    expect(fieldAccessResults).toEqual(
      expect.arrayContaining([
        { accessResult: true, path: 'explicitlyAllowed' },
        { accessResult: false, path: 'explicitlyDenied' },
        { accessResult: true, path: 'implicitlyAllowed' },
      ]),
    )
  })

  it('should report access as allowed when access control is overridden', async () => {
    const fieldAccessResults = await runBeforeValidate({
      fields: [
        {
          name: 'overridden',
          type: 'text',
          access: { create: () => false },
        },
      ],
      overrideAccess: true,
    })

    expect(fieldAccessResults).toEqual([{ accessResult: true, path: 'overridden' }])
  })
})

describe('beforeValidate fallback from the stored document (fork #131)', () => {
  // An array of rows, each holding a group whose `design` an update may not write.
  const lockedNestedFields: Field[] = [
    {
      name: 'items',
      type: 'array',
      fields: [
        { name: 'title', type: 'text' },
        {
          name: 'image',
          type: 'group',
          fields: [
            { name: 'state', type: 'text' },
            {
              name: 'design',
              type: 'group',
              access: { update: () => false },
              fields: [{ name: 'template', type: 'text' }],
            },
          ],
        },
      ],
    },
  ]

  const storedDoc = (): JsonObject => ({
    id: 'doc-1',
    items: [
      {
        id: 'row-1',
        image: { design: { template: 'band' }, state: 'auto' },
        title: 'Lesson 1',
      },
      {
        id: 'row-2',
        image: { design: { template: 'frame' }, state: 'yours' },
        title: 'Lesson 2',
      },
    ],
  })

  const runUpdate = async ({ data, doc }: { data: JsonObject; doc: JsonObject }) =>
    beforeValidate({
      id: 'doc-1',
      collection: { fields: lockedNestedFields } as SanitizedCollectionConfig,
      context: {},
      data,
      doc,
      global: null,
      operation: 'update',
      overrideAccess: false,
      req: { context: {}, payload: {} } as PayloadRequest,
    })

  it('keeps an access-locked value two levels deep when the update omits its array', async () => {
    const doc = storedDoc()
    const result = await runUpdate({ data: {}, doc })

    expect(result.items).toEqual(storedDoc().items)
  })

  it('never edits the stored document it falls back to', async () => {
    const doc = storedDoc()
    const result = await runUpdate({ data: {}, doc })

    expect(doc).toEqual(storedDoc())
    // The fallback is the data's own copy, at every depth.
    expect(result.items).not.toBe(doc.items)
    expect(result.items[0].image).not.toBe(doc.items[0].image)
    expect(result.items[0].image.design).not.toBe(doc.items[0].image.design)
  })

  it('still keeps the stored value when the update sends a refused one', async () => {
    const doc = storedDoc()
    const result = await runUpdate({
      data: {
        items: [
          { id: 'row-1', image: { design: { template: 'tampered' }, state: 'auto' } },
          { id: 'row-2', image: { state: 'yours' }, title: 'Renamed' },
        ],
      },
      doc,
    })

    expect(result.items[0].image.design).toEqual({ template: 'band' })
    expect(result.items[1].image.design).toEqual({ template: 'frame' })
    expect(result.items[1].title).toBe('Renamed')
    expect(doc).toEqual(storedDoc())
  })
})
