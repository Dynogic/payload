import { describe, expect, it } from 'vitest'

import { resolveDrawerSaveMode } from './resolveDrawerSaveMode.js'

/**
 * Fork change #129 — an edit drawer on a drafted collection writes the draft
 * by default ('createEdit'), never the live document through #45's lone Save.
 */
describe('resolveDrawerSaveMode', () => {
  it('an existing document of a drafted collection defaults to createEdit', () => {
    expect(resolveDrawerSaveMode({ draftsEnabled: true, isCreateDrawer: false })).toBe('createEdit')
  })

  it('a create drawer on a drafted collection keeps saveAndAdd (#45 creates a draft)', () => {
    expect(resolveDrawerSaveMode({ draftsEnabled: true, isCreateDrawer: true })).toBe('saveAndAdd')
  })

  it('a collection without drafts keeps saveAndAdd, create or edit', () => {
    expect(resolveDrawerSaveMode({ draftsEnabled: false, isCreateDrawer: false })).toBe(
      'saveAndAdd',
    )
    expect(resolveDrawerSaveMode({ draftsEnabled: false, isCreateDrawer: true })).toBe('saveAndAdd')
  })

  it('an explicit saveMode always wins', () => {
    for (const saveMode of ['createEdit', 'default', 'saveAndAdd'] as const) {
      for (const draftsEnabled of [true, false]) {
        for (const isCreateDrawer of [true, false]) {
          expect(resolveDrawerSaveMode({ draftsEnabled, isCreateDrawer, saveMode })).toBe(saveMode)
        }
      }
    }
  })
})
