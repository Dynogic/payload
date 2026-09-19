import type { FormState } from 'payload'

import { describe, expect, it } from 'vitest'

import { countChildErrors } from './countChildErrors.js'

/**
 * Fork change #90 — the tab/collapsible error badge counts one fault once.
 *
 * Server-built form state marks every parent of an invalid leaf invalid too
 * (`addFieldStatePromise` → `addErrorPathToParent`), so the old "count every
 * invalid key in the subtree" read 2 for a single nameless array row. These
 * cases pin the new rule AND the behavior it must not break: a genuinely
 * container-level error (minRows) still counts.
 */

const field = (valid: boolean): FormState[string] =>
  ({ initialValue: null, valid, value: null }) as unknown as FormState[string]

const state = (entries: Record<string, boolean>): FormState =>
  Object.fromEntries(
    Object.entries(entries).map(([path, valid]) => [path, field(valid)]),
  ) as FormState

// What a tab holding `poster` and the `subtitles` array asks for.
const PlaybackSegments = ['poster', 'subtitles.']

describe('countChildErrors', () => {
  it('counts ONE fault once: a nameless array row, with its parent array flagged beside it', () => {
    expect(
      countChildErrors({
        formState: state({
          poster: true,
          subtitles: false,
          'subtitles.0.id': true,
          'subtitles.0.name': false,
        }),
        parentPath: [],
        segmentsToMatch: PlaybackSegments,
      }),
    ).toBe(1)
  })

  it('counts two leaves in one row as two', () => {
    expect(
      countChildErrors({
        formState: state({
          subtitles: false,
          'subtitles.0.file': false,
          'subtitles.0.name': false,
        }),
        parentPath: [],
        segmentsToMatch: PlaybackSegments,
      }),
    ).toBe(2)
  })

  it('counts one leaf per faulty row across rows', () => {
    expect(
      countChildErrors({
        formState: state({
          subtitles: false,
          'subtitles.0.name': false,
          'subtitles.1.name': true,
          'subtitles.2.name': false,
        }),
        parentPath: [],
        segmentsToMatch: PlaybackSegments,
      }),
    ).toBe(2)
  })

  it('does NOT hide a container-level error: minRows on an array whose rows are all valid', () => {
    expect(
      countChildErrors({
        formState: state({
          subtitles: false,
          'subtitles.0.name': true,
        }),
        parentPath: [],
        segmentsToMatch: PlaybackSegments,
      }),
    ).toBe(1)
  })

  it('counts a plain sibling field beside an array fault', () => {
    expect(
      countChildErrors({
        formState: state({
          poster: false,
          subtitles: false,
          'subtitles.0.name': false,
        }),
        parentPath: [],
        segmentsToMatch: PlaybackSegments,
      }),
    ).toBe(2)
  })

  it('counts nothing when everything is valid', () => {
    expect(
      countChildErrors({
        formState: state({ poster: true, subtitles: true, 'subtitles.0.name': true }),
        parentPath: [],
        segmentsToMatch: PlaybackSegments,
      }),
    ).toBe(0)
  })

  it('ignores faults outside the subtree it was asked about', () => {
    expect(
      countChildErrors({
        formState: state({ name: false, subtitles: true }),
        parentPath: [],
        segmentsToMatch: PlaybackSegments,
      }),
    ).toBe(0)
  })

  it('honors the host path: a tab inside an array row counts only its own row', () => {
    expect(
      countChildErrors({
        formState: state({
          'rows.0.tab.title': false,
          'rows.1.tab.title': false,
        }),
        parentPath: ['rows', 0, 'tab'],
        segmentsToMatch: ['title'],
      }),
    ).toBe(1)
  })

  it('does not treat a name-prefix sibling as a descendant', () => {
    // `subtitlesExtra` is not inside `subtitles`, so neither swallows the other.
    expect(
      countChildErrors({
        formState: state({ subtitles: false, subtitlesExtra: false }),
        parentPath: [],
        segmentsToMatch: ['subtitles.', 'subtitlesExtra'],
      }),
    ).toBe(2)
  })
})
