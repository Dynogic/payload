import type { ClientCollectionConfig, ClientGlobalConfig } from 'payload'

import { createContext, use, useCallback, useEffect, useState } from 'react'

import { formatDocTitle } from '../../utilities/formatDocTitle/index.js'
import { useConfig } from '../Config/index.js'
import { useDocumentInfo } from '../DocumentInfo/index.js'
import { useTranslation } from '../Translation/index.js'

type IDocumentTitleContext = {
  setDocumentTitle: (title: string) => void
  /**
   * FORK (#73): supply a fully-rendered title that WINS over the
   * `useAsTitle`-derived one, for every consumer of `title` (the controls-bar
   * `RenderTitle`, the breadcrumb, the drawer header, the delete/restore
   * modals). Pass `null` to clear it and fall back to the derived title.
   *
   * Unlike `setDocumentTitle`, an override is not clobbered by the
   * `formatDocTitle` recompute that runs whenever `data` or the admin
   * language changes — it is a separate layer read at render time. Use it
   * when the displayed title cannot come from a stored field: e.g. a
   * singleton-ish document whose stored `title` is a fixed internal literal
   * that must render translated per viewer.
   *
   * @example
   * ```tsx
   * const { setTitleOverride } = useDocumentTitle()
   * useEffect(() => {
   *   setTitleOverride(t('myCollection:homeTitle'))
   *   return () => setTitleOverride(null)
   * }, [setTitleOverride, t])
   * ```
   */
  setTitleOverride: React.Dispatch<React.SetStateAction<null | string>>
  /**
   * FORK (#104): make the document's own breadcrumb step (the one
   * `SetDocumentStepNav` pushes for the title) ACT: it renders as a button
   * that calls this (`StepNavItem.onClick`). Pass `null` to clear it and the
   * step is plain text again. Pass a STABLE function (`useCallback`): a new
   * identity rebuilds the trail.
   *
   * It lives on the document, not on the step nav, because the step nav is
   * one per admin page while every document (a drawer's too) has its own
   * provider: a document in a drawer can set it freely and the page's
   * trail never sees it, since `SetDocumentStepNav` mounts only outside
   * drawers. Unmounting the document drops it with the provider.
   *
   * @example
   * ```tsx
   * const { setTitleStepOnClick } = useDocumentTitle()
   * const openRename = useCallback(() => setOpen(true), [])
   * useEffect(() => {
   *   if (!untitled) return undefined
   *   setTitleStepOnClick(openRename)
   *   return () => setTitleStepOnClick(null)
   * }, [untitled, openRename, setTitleStepOnClick])
   * ```
   */
  setTitleStepOnClick: (onClick: (() => void) | null) => void
  title: string
  /** FORK (#104): the handler set through `setTitleStepOnClick`, if any. */
  titleStepOnClick?: () => void
}

const DocumentTitleContext = createContext({} as IDocumentTitleContext)

export const useDocumentTitle = (): IDocumentTitleContext => use(DocumentTitleContext)

export const DocumentTitleProvider: React.FC<{
  children: React.ReactNode
}> = ({ children }) => {
  const { id, collectionSlug, data, docConfig, globalSlug, initialData } = useDocumentInfo()

  const {
    config: {
      admin: { dateFormat },
    },
  } = useConfig()

  const { i18n } = useTranslation()

  // FORK (#73): the app-supplied title layer. `null` (the default) means no
  // override, so every collection that never calls the setter is unchanged.
  const [titleOverride, setTitleOverride] = useState<null | string>(null)

  // FORK (#104): the title step's click handler. Held behind an updater so a
  // function is STORED, never called as a state updater.
  const [titleStepOnClick, setTitleStepOnClickState] = useState<(() => void) | null>(null)
  const setTitleStepOnClick = useCallback(
    (onClick: (() => void) | null) => setTitleStepOnClickState(() => onClick),
    [],
  )

  const [title, setDocumentTitle] = useState(() =>
    formatDocTitle({
      collectionConfig: collectionSlug ? (docConfig as ClientCollectionConfig) : undefined,
      data: { ...(initialData || {}), id },
      dateFormat,
      fallback: id?.toString(),
      globalConfig: globalSlug ? (docConfig as ClientGlobalConfig) : undefined,
      i18n,
    }),
  )

  useEffect(() => {
    setDocumentTitle(
      formatDocTitle({
        collectionConfig: collectionSlug ? (docConfig as ClientCollectionConfig) : undefined,
        data: { ...data, id },
        dateFormat,
        fallback: id?.toString(),
        globalConfig: globalSlug ? (docConfig as ClientGlobalConfig) : undefined,
        i18n,
      }),
    )
  }, [data, dateFormat, i18n, id, collectionSlug, docConfig, globalSlug])

  return (
    <DocumentTitleContext
      value={{
        setDocumentTitle,
        setTitleOverride,
        setTitleStepOnClick,
        title: titleOverride ?? title,
        titleStepOnClick: titleStepOnClick ?? undefined,
      }}
    >
      {children}
    </DocumentTitleContext>
  )
}
