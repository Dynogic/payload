'use client'
import React, { useEffect } from 'react'

import { useRouteCache } from '../../providers/RouteCache/index.js'
import { useTranslation } from '../../providers/Translation/index.js'
import { ConfirmationModal } from '../ConfirmationModal/index.js'
import { useModal } from '../Modal/index.js'

const modalSlug = 'document-stale-data'

const baseClass = 'document-stale-data'

/**
 * "Document modified — reload" prompt. Built on `ConfirmationModal` (FORK-
 * CHANGES.md #82) so an app-registered ConfirmRenderer draws it too; it is a
 * forced decision (`hideCancel`): one primary Reload, no Cancel, no X.
 */
export const DocumentStaleData: React.FC<{
  isActive: boolean
  onReload: () => Promise<void> | void
}> = ({ isActive, onReload }) => {
  const { closeModal, openModal } = useModal()
  const { clearRouteCache } = useRouteCache()
  const { t } = useTranslation()

  useEffect(() => {
    if (isActive) {
      openModal(modalSlug)
    } else {
      closeModal(modalSlug)
    }
  }, [isActive, openModal, closeModal])

  return (
    <ConfirmationModal
      body={t('general:documentOutOfDate')}
      className={baseClass}
      confirmLabel={t('general:reloadDocument')}
      heading={t('general:documentModified')}
      hideCancel
      modalSlug={modalSlug}
      onConfirm={async () => {
        clearRouteCache()
        await onReload()
      }}
    />
  )
}
