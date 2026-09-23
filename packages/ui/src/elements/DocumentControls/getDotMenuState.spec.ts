import { describe, expect, it } from 'vitest'

import { getDotMenuState } from './getDotMenuState.js'

/**
 * Fork change #91 — a read-only viewer sees the ⋯ menu inert, not hidden.
 */

const collection = {
  id: 'doc-1',
  isCollection: true,
  isGlobal: false,
}

const global = {
  hasVersionsOrLocalization: true,
  isCollection: false,
  isGlobal: true,
}

describe('getDotMenuState', () => {
  it('collection, full permissions: shown and live (stock)', () => {
    expect(
      getDotMenuState({
        ...collection,
        hasCreatePermission: true,
        hasDeletePermission: true,
        hasSavePermission: true,
      }),
    ).toEqual({ inert: false, show: true })
  })

  it('collection, read-only viewer (no update/create/delete): shown INERT', () => {
    expect(getDotMenuState({ ...collection, hasSavePermission: false })).toEqual({
      inert: true,
      show: true,
    })
  })

  it('collection, no update but can duplicate: shown and live', () => {
    expect(
      getDotMenuState({ ...collection, hasCreatePermission: true, hasSavePermission: false }),
    ).toEqual({ inert: false, show: true })
  })

  it('collection, no update but can delete: shown and live', () => {
    expect(
      getDotMenuState({ ...collection, hasDeletePermission: true, hasSavePermission: false }),
    ).toEqual({ inert: false, show: true })
  })

  it('collection, update only (no create, no delete): hidden, as stock', () => {
    expect(getDotMenuState({ ...collection, hasSavePermission: true })).toEqual({
      inert: false,
      show: false,
    })
  })

  it('collection create view (no id): hidden even for a read-only viewer', () => {
    expect(getDotMenuState({ ...collection, id: undefined, hasSavePermission: false })).toEqual({
      inert: false,
      show: false,
    })
  })

  it('create drawer: hidden (#45)', () => {
    expect(
      getDotMenuState({ ...collection, hasSavePermission: false, isCreateDrawer: true }),
    ).toEqual({ inert: false, show: false })
  })

  it('disableActions: hidden', () => {
    expect(
      getDotMenuState({ ...collection, disableActions: true, hasSavePermission: false }),
    ).toEqual({ inert: false, show: false })
  })

  it('global with update permission: shown and live (stock)', () => {
    expect(getDotMenuState({ ...global, hasSavePermission: true })).toEqual({
      inert: false,
      show: true,
    })
  })

  it('global, read-only viewer: shown INERT', () => {
    expect(getDotMenuState({ ...global, hasSavePermission: false })).toEqual({
      inert: true,
      show: true,
    })
  })

  it('global without drafts or localization: hidden, as stock', () => {
    expect(
      getDotMenuState({ ...global, hasSavePermission: false, hasVersionsOrLocalization: false }),
    ).toEqual({ inert: false, show: false })
  })
})
