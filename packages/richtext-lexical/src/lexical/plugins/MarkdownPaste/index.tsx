'use client'

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $isRootNode,
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_HIGH,
  KEY_DOWN_COMMAND,
  type LexicalNode,
  PASTE_COMMAND,
} from 'lexical'
import * as React from 'react'

import { $convertFromMarkdownString } from '../../../packages/@lexical/markdown/index.js'
import { useEditorConfigContext } from '../../config/client/EditorConfigProvider.js'

// Track if we should skip markdown processing on next paste
let skipMarkdownOnNextPaste = false

/**
 * Simple heuristic to detect if text looks like markdown.
 * We check for common markdown patterns to avoid false positives
 * on regular text that happens to contain special characters.
 */
function looksLikeMarkdown(text: string): boolean {
  const markdownPatterns = [
    /^#{1,6}\s/m, // Headings: # Heading
    /\*\*[^*]+\*\*/, // Bold: **text**
    /__[^_]+__/, // Bold: __text__
    /(?<!\*)\*[^*]+\*(?!\*)/, // Italic: *text* (not **)
    /(?<!_)_[^_]+_(?!_)/, // Italic: _text_ (not __)
    /^[-*+]\s/m, // Unordered list: - item
    /^\d+\.\s/m, // Ordered list: 1. item
    /^>\s/m, // Blockquote: > quote
    /`[^`]+`/, // Inline code: `code`
    /^```/m, // Code block: ```
    /\[.+\]\(.+\)/, // Links: [text](url)
    /^---$/m, // Horizontal rule
    /~~[^~]+~~/, // Strikethrough: ~~text~~
  ]

  return markdownPatterns.some((pattern) => pattern.test(text))
}

export const MarkdownPastePlugin: React.FC = () => {
  const { editorConfig } = useEditorConfigContext()
  const [editor] = useLexicalComposerContext()

  React.useEffect(() => {
    const transformers = editorConfig.features.markdownTransformers ?? []

    // Don't register if no transformers available
    if (transformers.length === 0) {
      return
    }

    // Handle Cmd+Shift+V (or Ctrl+Shift+V) for paste without markdown formatting
    const unregisterKeyDown = editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event: KeyboardEvent) => {
        const isModifier = event.metaKey || event.ctrlKey
        if (isModifier && event.shiftKey && event.key.toLowerCase() === 'v') {
          // Set flag to skip markdown processing on the upcoming paste
          skipMarkdownOnNextPaste = true
          // Let the paste event proceed naturally
          return false
        }
        return false
      },
      COMMAND_PRIORITY_CRITICAL,
    )

    const unregisterPaste = editor.registerCommand(
      PASTE_COMMAND,
      (event: ClipboardEvent) => {
        // Check if we should skip markdown processing (Cmd+Shift+V was pressed)
        if (skipMarkdownOnNextPaste) {
          skipMarkdownOnNextPaste = false
          return false // Let default paste handling take over
        }

        const clipboardData = event.clipboardData

        // Skip if HTML present - let browser handle rich paste via importDOM
        if (clipboardData?.types?.includes('text/html')) {
          return false
        }

        // Skip if files present - let upload handler deal with it
        if (clipboardData?.files?.length) {
          return false
        }

        // Get plain text content
        const text = clipboardData?.getData('text/plain')
        if (!text) {
          return false
        }

        // Only process if text looks like markdown
        if (!looksLikeMarkdown(text)) {
          return false
        }

        // Prevent default paste behavior
        event.preventDefault()

        // Convert markdown to Lexical nodes and insert at selection
        editor.update(() => {
          const selection = $getSelection()
          const root = $getRoot()

          if (!$isRangeSelection(selection)) {
            // No proper selection, fall back to replacing root
            $convertFromMarkdownString(text, transformers, undefined, true)
            return
          }

          // Remove selected content first (this is what was missing!)
          if (!selection.isCollapsed()) {
            selection.removeText()
          }

          // Get the anchor node and find the top-level element
          const anchorNode = selection.anchor.getNode()
          let topLevelElement: LexicalNode | null = anchorNode

          // Walk up to find the direct child of root
          while (topLevelElement) {
            const parent: LexicalNode | null = topLevelElement.getParent()
            if (!parent || $isRootNode(parent)) {
              break
            }
            topLevelElement = parent
          }

          // Get the index of the current element in root
          const insertIndex = topLevelElement
            ? root.getChildren().indexOf(topLevelElement) + 1
            : root.getChildrenSize()

          // Store original root children
          const originalChildren = root.getChildren()

          // Convert markdown - this replaces root content
          $convertFromMarkdownString(text, transformers, undefined, true)

          // Get the newly created nodes (clone them before we clear)
          const newChildren = root.getChildren().map((child) => child)

          // Restore original content
          root.clear()
          for (const child of originalChildren) {
            root.append(child)
          }

          // Insert new nodes at the correct position
          const rootChildren = root.getChildren()
          let currentIndex = insertIndex

          for (const newChild of newChildren) {
            if (currentIndex >= rootChildren.length) {
              root.append(newChild)
            } else {
              const nodeAtIndex = rootChildren[currentIndex]
              if (nodeAtIndex) {
                nodeAtIndex.insertBefore(newChild)
              } else {
                root.append(newChild)
              }
            }
            currentIndex++
          }

          // Move selection to end of inserted content
          const lastChild = newChildren[newChildren.length - 1]
          if (lastChild) {
            lastChild.selectEnd()
          }
        })

        return true
      },
      COMMAND_PRIORITY_HIGH,
    )

    // Cleanup both command registrations
    return () => {
      unregisterKeyDown()
      unregisterPaste()
    }
  }, [editor, editorConfig.features.markdownTransformers])

  return null
}
