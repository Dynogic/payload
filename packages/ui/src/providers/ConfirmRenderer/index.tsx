'use client'
import React, { createContext, use } from 'react'

import type { ConfirmationModalProps } from '../../elements/ConfirmationModal/index.js'

/**
 * App-supplied renderer for `ConfirmationModal` (FORK-CHANGES.md #82).
 *
 * Return a node to replace the stock confirm entirely; return `undefined` to
 * fall through to the default `Modal`-based render for that call. The
 * renderer receives the full `ConfirmationModalProps` — including
 * `modalSlug` — and is expected to keep the modal bus semantics
 * (`isModalOpen(modalSlug)` / `closeModal(modalSlug)`) so callers that drive
 * the slug externally (`openModal`, `toggleModal`, route changes) keep
 * working. Prefer returning a component element (`<MyConfirm {...props} />`)
 * so any hooks the custom confirm needs live in their own render.
 */
export type ConfirmRenderer = (props: ConfirmationModalProps) => React.ReactNode | undefined

const ConfirmRendererContext = createContext<ConfirmRenderer | undefined>(undefined)

export const ConfirmRendererProvider: React.FC<{
  children: React.ReactNode
  renderer: ConfirmRenderer
}> = ({ children, renderer }) => (
  <ConfirmRendererContext value={renderer}>{children}</ConfirmRendererContext>
)

export const useConfirmRenderer = (): ConfirmRenderer | undefined => use(ConfirmRendererContext)
