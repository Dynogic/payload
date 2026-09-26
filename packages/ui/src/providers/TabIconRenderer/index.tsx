'use client'
import React, { createContext, use } from 'react'

/**
 * App-supplied renderer for a tab's `icon` (FORK-CHANGES.md #102).
 *
 * A tab's `icon` is a plain string (it has to survive the client-config
 * boundary), so Payload has no idea what it draws. The app registers a
 * renderer through a provider (`admin.components.providers`) that maps the
 * name to a node; the tab button renders that node before its label. With
 * no renderer, or a renderer that returns `undefined`, the tab renders
 * exactly as before: label only.
 */
export type TabIconRenderer = (icon: string) => React.ReactNode | undefined

const TabIconRendererContext = createContext<TabIconRenderer | undefined>(undefined)

export const TabIconRendererProvider: React.FC<{
  children: React.ReactNode
  renderer: TabIconRenderer
}> = ({ children, renderer }) => (
  <TabIconRendererContext value={renderer}>{children}</TabIconRendererContext>
)

export const useTabIconRenderer = (): TabIconRenderer | undefined => use(TabIconRendererContext)
