'use client'
import React from 'react'

/**
 * Blocks row-selection capability (fork #74).
 *
 * A consuming app wraps a blocks field in `BlocksSelectionProvider` to put its
 * rows into SELECTION MODE at runtime: each `BlockRow` swaps its drag handle
 * for a checkbox, suppresses row actions and the collapse toggle, and routes
 * header clicks to `toggle(path, rowId)`. Rows are identified by
 * `(path, rowId)` so nested blocks fields (rows inside a section row's own
 * blocks field) participate under one provider without id collisions.
 *
 * The DEFAULT context is inactive, so every blocks field without a provider
 * renders exactly as before this change — the capability is invisible until
 * an app opts a specific field in. Selection STATE lives in the consuming
 * app (this module holds no state); the provider is a pure conduit.
 *
 * Single-instance caution (the focus-trap lesson, fork #54): the provider and
 * `useBlocksSelection` must resolve to the SAME compiled module as the
 * `BlockRow` consuming it — import both from `@payloadcms/ui`, and never let
 * a bundler inline a second copy of this file.
 */
export type BlocksSelectionContextValue = {
  /** Selection mode is on: rows render checkboxes instead of drag handles. */
  active: boolean
  isSelected: (path: string, rowId: string) => boolean
  /**
   * Toggle one row. `options.shiftKey` reports whether the interaction was
   * a shift-click so the app can implement range selection — the row itself
   * stays selection-strategy-agnostic.
   */
  toggle: (path: string, rowId: string, options?: { shiftKey?: boolean }) => void
}

const InactiveSelection: BlocksSelectionContextValue = {
  active: false,
  isSelected: () => false,
  toggle: () => undefined,
}

const BlocksSelectionContext = React.createContext<BlocksSelectionContextValue>(InactiveSelection)

export const BlocksSelectionProvider: React.FC<{
  children: React.ReactNode
  value: BlocksSelectionContextValue
}> = ({ children, value }) => (
  <BlocksSelectionContext value={value}>{children}</BlocksSelectionContext>
)

export const useBlocksSelection = (): BlocksSelectionContextValue =>
  React.use(BlocksSelectionContext)
