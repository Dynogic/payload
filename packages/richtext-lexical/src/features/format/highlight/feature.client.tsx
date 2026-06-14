'use client'

import { $isTableSelection } from '@lexical/table'
import { $isRangeSelection, FORMAT_TEXT_COMMAND } from 'lexical'

import { HighlightIcon } from '../../../lexical/ui/icons/Highlight/index.js'
import { createClientFeature } from '../../../utilities/createClientFeature.js'
import { toolbarFormatGroupWithItems } from '../shared/toolbarFormatGroup.js'
import { HIGHLIGHT } from './markdownTransformers.js'

const toolbarGroups = [
  toolbarFormatGroupWithItems([
    {
      ChildComponent: HighlightIcon,
      isActive: ({ selection }) => {
        if ($isRangeSelection(selection) || $isTableSelection(selection)) {
          return selection.hasFormat('highlight')
        }
        return false
      },
      key: 'highlight',
      onSelect: ({ editor }) => {
        editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'highlight')
      },
      order: 5,
    },
  ]),
]

export const HighlightFeatureClient = createClientFeature({
  enableFormats: ['highlight'],
  markdownTransformers: [HIGHLIGHT],
  toolbarFixed: {
    groups: toolbarGroups,
  },
  toolbarInline: {
    groups: toolbarGroups,
  },
})
