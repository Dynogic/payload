'use client'
import React, { createContext, use } from 'react'

/**
 * App-supplied renderer for every `Drawer` (FORK-CHANGES.md #111).
 *
 * The same shape as #82's `ConfirmRendererProvider` and #102's
 * `TabIconRendererProvider`: Payload ships no overlay primitive of the app's
 * choosing, so the app registers a renderer through a provider
 * (`admin.components.providers`) and `Drawer` hands it the frame. Return a
 * node to draw the drawer yourself; return `undefined` to fall through to
 * the stock faceless-ui `Modal` for that call. With no renderer registered
 * every drawer renders exactly as before.
 *
 * Open state stays on the modal bus: `isOpen` is `modalState[slug].isOpen`,
 * so `openModal` / `closeModal` / `toggleModal`, `useDocumentDrawer`'s
 * `openDrawer` / `closeDrawer` / `isDrawerOpen` and the route-change close
 * are unchanged. Unlike the stock drawer (which renders nothing while
 * closed) the renderer is called while CLOSED too, so it can run an exit
 * animation; it must not mount `children` while `isOpen` is false (a
 * DocumentDrawer's content fetches the document on mount).
 */
export type DrawerRendererProps = {
  readonly children: React.ReactNode
  /** The drawer's class (`doc-drawer` for a document drawer). */
  readonly className?: string
  /** Closes the drawer unconditionally (`closeModal(slug)`). */
  readonly close: () => void
  /**
   * 1 for a drawer opened from a page, 2 for one opened from inside that
   * drawer, and so on (the stock `useDrawerDepth()` read outside the
   * drawer's own `DrawerDepthProvider`).
   */
  readonly depth: number
  readonly gutter: boolean
  /** `null`: the content draws its own header (a document drawer). `undefined`: the stock title + ✕ header is expected. */
  readonly Header?: React.ReactNode
  readonly hoverTitle?: boolean
  readonly isOpen: boolean
  /**
   * The ONE way the frame's own exits (its ✕, Escape, a scrim click) close
   * the drawer: it asks the content's close guard first (a document drawer
   * with unsaved edits opens the leave-without-saving confirm instead), and
   * closes only when nothing intercepts.
   */
  readonly requestClose: () => void
  readonly slug: string
  /** The stock `title` prop. A document drawer has none (its title is in the content). */
  readonly title?: string
}

export type DrawerRenderer = (props: DrawerRendererProps) => React.ReactNode | undefined

const DrawerRendererContext = createContext<DrawerRenderer | undefined>(undefined)

export const DrawerRendererProvider: React.FC<{
  children: React.ReactNode
  renderer: DrawerRenderer
}> = ({ children, renderer }) => (
  <DrawerRendererContext value={renderer}>{children}</DrawerRendererContext>
)

export const useDrawerRenderer = (): DrawerRenderer | undefined => use(DrawerRendererContext)

/**
 * What a drawer's content knows about the frame it renders in.
 *
 * - `appRendered`: the app's renderer drew this drawer. A document drawer
 *   then has no header band of its own: the controls bar carries the title,
 *   and the frame carries the ✕.
 * - `setCloseGuard`: the content registers the guard `requestClose` asks.
 *   The guard returns `true` when it took the close over (it opened a
 *   confirm), `false` to let the drawer close. One guard per drawer; pass
 *   `null` to clear it.
 */
export type DrawerFrame = {
  readonly appRendered: boolean
  readonly setCloseGuard: (guard: (() => boolean) | null) => void
}

const noop = () => undefined

const DrawerFrameContext = createContext<DrawerFrame>({
  appRendered: false,
  setCloseGuard: noop,
})

export const DrawerFrameProvider: React.FC<{
  children: React.ReactNode
  value: DrawerFrame
}> = ({ children, value }) => <DrawerFrameContext value={value}>{children}</DrawerFrameContext>

export const useDrawerFrame = (): DrawerFrame => use(DrawerFrameContext)
