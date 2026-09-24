import { describe, expect, it } from 'vitest'

import { createClaimRegistry } from './claimRegistry.js'

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
