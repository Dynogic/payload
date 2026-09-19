'use client'
import type { ClientField } from 'payload'
import type React from 'react'

import { useThrottledEffect } from '../../hooks/useThrottledEffect.js'
import { useAllFormFields, useFormSubmitted } from '../Form/context.js'
import { buildPathSegments } from './buildPathSegments.js'

type TrackSubSchemaErrorCountProps = {
  fields?: ClientField[]
  /**
   * This path should only include path segments that affect data
   * i.e. it should not include _index-0 type segments
   *
   * For collapsibles and tabs you can simply pass their parent path
   */
  path: (number | string)[]
  setErrorCount: (count: number) => void
}
export const WatchChildErrors: React.FC<TrackSubSchemaErrorCountProps> = ({
  fields,
  path: parentPath,
  setErrorCount,
}) => {
  const [formState] = useAllFormFields()
  const hasSubmitted = useFormSubmitted()

  const segmentsToMatch = buildPathSegments(fields)

  useThrottledEffect(
    () => {
      if (hasSubmitted) {
        // ONE FAULT, COUNTED ONCE. Server form state marks a container invalid
        // beside the leaf that is actually at fault — one nameless subtitle
        // track flags both `subtitles.0.name` and `subtitles` — so counting
        // every invalid key reads 2 for a single missing value. Count only the
        // deepest invalid key of each chain: an invalid container that has an
        // invalid descendant is the same fault, said twice.
        //
        // A genuinely container-level error (minRows on an otherwise valid
        // array, a group whose own validate failed) has no invalid descendant
        // and is still counted. The one lossy case is a container error AND a
        // leaf error at the same time, which reads 1 instead of 2 — the badge
        // still shows the tab is in error, which is what it is for.
        const invalidPaths = new Set<string>()

        for (const key of Object.keys(formState)) {
          const pathState = formState[key]
          if (pathState && 'valid' in pathState && !pathState.valid) {
            invalidPaths.add(key)
          }
        }

        const hasInvalidDescendant = (key: string): boolean => {
          const prefix = `${key}.`
          for (const other of invalidPaths) {
            if (other.startsWith(prefix)) {
              return true
            }
          }
          return false
        }

        let errorCount = 0
        Object.entries(formState).forEach(([key]) => {
          const matchingSegment = segmentsToMatch?.some((segment) => {
            const segmentToMatch = [...parentPath, segment].join('.')
            // match fields with same parent path
            if (segmentToMatch.endsWith('.')) {
              // Match both nested fields (key starts with segmentToMatch)
              // and the field itself (key equals segmentToMatch without trailing dot)
              const pathWithoutDot = segmentToMatch.slice(0, -1)
              return key.startsWith(segmentToMatch) || key === pathWithoutDot
            }
            // match fields with same path
            return key === segmentToMatch
          })

          if (matchingSegment && invalidPaths.has(key) && !hasInvalidDescendant(key)) {
            errorCount += 1
          }
        })
        setErrorCount(errorCount)
      }
    },
    250,
    [formState, hasSubmitted, fields],
  )

  return null
}
