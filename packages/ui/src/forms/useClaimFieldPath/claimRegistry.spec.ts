import { describe, expect, it } from 'vitest'

import { coveringSubtreeClaim, createClaimRegistry } from './claimRegistry.js'

/**
 * Fork change #98 — the registry behind `useClaimFieldPath`: ref-counted
 * claims per path, a change notification only when the SET changes.
 */
describe('createClaimRegistry', () => {
  it('claims a path until released', () => {
    const registry = createClaimRegistry()
    const release = registry.claim('checkpointPolicy')
    expect(registry.getClaimedPaths().has('checkpointPolicy')).toBe(true)
    release()
    expect(registry.getClaimedPaths().has('checkpointPolicy')).toBe(false)
  })

  it('keeps a path claimed while any claimant is mounted', () => {
    const registry = createClaimRegistry()
    const releaseA = registry.claim('p')
    const releaseB = registry.claim('p')
    releaseA()
    expect(registry.getClaimedPaths().has('p')).toBe(true)
    releaseB()
    expect(registry.getClaimedPaths().has('p')).toBe(false)
  })

  it('a release is idempotent (a double cleanup cannot drop another claim)', () => {
    const registry = createClaimRegistry()
    const releaseA = registry.claim('p')
    registry.claim('p')
    releaseA()
    releaseA()
    expect(registry.getClaimedPaths().has('p')).toBe(true)
  })

  it('notifies only when the set of claimed paths changes, with a fresh snapshot', () => {
    const snapshots: ReadonlySet<string>[] = []
    const registry = createClaimRegistry((next) => snapshots.push(next))
    const releaseA = registry.claim('p')
    const releaseB = registry.claim('p')
    registry.claim('q')
    releaseB()
    releaseA()
    expect(snapshots.map((s) => [...s].sort())).toEqual([['p'], ['p', 'q'], ['q']])
    expect(snapshots[0]).not.toBe(snapshots[1])
  })

  it('starts empty', () => {
    expect(createClaimRegistry().getClaimedPaths().size).toBe(0)
  })
})

/**
 * Fork change #100 — subtree claims.
 */
describe('createClaimRegistry — subtree claims (#100)', () => {
  it('a subtree claim is in both sets; an exact one only in the paths', () => {
    const registry = createClaimRegistry()
    registry.claim('a')
    registry.claim('b', { subtree: true })
    expect([...registry.getClaimedPaths()].sort()).toEqual(['a', 'b'])
    expect([...registry.getClaimedSubtrees()]).toEqual(['b'])
  })

  it('exact and subtree claims on one path are counted separately', () => {
    const registry = createClaimRegistry()
    const releaseExact = registry.claim('p')
    const releaseSubtree = registry.claim('p', { subtree: true })
    releaseSubtree()
    expect(registry.getClaimedPaths().has('p')).toBe(true)
    expect(registry.getClaimedSubtrees().has('p')).toBe(false)
    releaseExact()
    expect(registry.getClaimedPaths().size).toBe(0)
  })

  it('notifies when the subtree set changes even if the path set does not', () => {
    const calls: [string[], string[]][] = []
    const registry = createClaimRegistry((paths, subtrees) =>
      calls.push([[...paths].sort(), [...subtrees].sort()]),
    )
    registry.claim('p')
    const release = registry.claim('p', { subtree: true })
    release()
    expect(calls).toEqual([
      [['p'], []],
      [['p'], ['p']],
      [['p'], []],
    ])
  })
})

describe('coveringSubtreeClaim (#100)', () => {
  const Subtrees = new Set(['curriculumItems', 'a.b'])

  it('finds the path itself or its nearest claimed ancestor', () => {
    expect(coveringSubtreeClaim('curriculumItems', Subtrees)).toBe('curriculumItems')
    expect(coveringSubtreeClaim('curriculumItems.row1.source', Subtrees)).toBe('curriculumItems')
    expect(coveringSubtreeClaim('a.b.c', Subtrees)).toBe('a.b')
  })

  it('does not match a name prefix, a parent, or with no subtrees', () => {
    expect(coveringSubtreeClaim('curriculumItemsX.row', Subtrees)).toBeUndefined()
    expect(coveringSubtreeClaim('a', Subtrees)).toBeUndefined()
    expect(coveringSubtreeClaim('x', undefined)).toBeUndefined()
  })
})
