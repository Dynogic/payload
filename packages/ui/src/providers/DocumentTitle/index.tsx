import type { ClientCollectionConfig, ClientGlobalConfig } from 'payload'

import { createContext, use, useEffect, useState } from 'react'

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
  title: string
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
      value={{ setDocumentTitle, setTitleOverride, title: titleOverride ?? title }}
    >
      {children}
    </DocumentTitleContext>
  )
}
