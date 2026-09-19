'use client'
import type { ClientField } from 'payload'
import type React from 'react'

import { useThrottledEffect } from '../../hooks/useThrottledEffect.js'
import { useAllFormFields, useFormSubmitted } from '../Form/context.js'
import { buildPathSegments } from './buildPathSegments.js'
import { countChildErrors } from './countChildErrors.js'

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
        setErrorCount(countChildErrors({ formState, parentPath, segmentsToMatch }))
      }
    },
    250,
    [formState, hasSubmitted, fields],
  )

  return null
}
