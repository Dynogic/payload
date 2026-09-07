'use client'
import { Modal, useModal } from '@faceless-ui/modal'
import React, { useCallback } from 'react'

import { useConfirmRenderer } from '../../providers/ConfirmRenderer/index.js'
import { useTranslation } from '../../providers/Translation/index.js'
import { Button } from '../Button/index.js'
import { CloseModalButton } from '../CloseModalButton/index.js'
import { drawerZBase, useDrawerDepth } from '../Drawer/index.js'
import './index.scss'

const baseClass = 'confirmation-modal'

export type OnCancel = () => void

export type ConfirmationModalProps = {
  body: React.ReactNode
  cancelLabel?: string
  className?: string
  confirmingLabel?: string
  confirmLabel?: string
  destructive?: boolean
  heading: React.ReactNode
  /**
   * Forced-decision confirm: no Cancel button and no close X — the only way
   * out is the confirm action (e.g. DocumentStaleData's "Reload"). Route
   * changes still close it through the modal bus.
   */
  hideCancel?: boolean
  modalSlug: string
  onCancel?: OnCancel
  onConfirm: () => Promise<void> | void
}

export function ConfirmationModal(props: ConfirmationModalProps) {
  const {
    body,
    cancelLabel,
    className,
    confirmingLabel,
    confirmLabel,
    destructive,
    heading,
    hideCancel,
    modalSlug,
    onCancel: onCancelFromProps,
    onConfirm: onConfirmFromProps,
  } = props

  const editDepth = useDrawerDepth()

  const [confirming, setConfirming] = React.useState(false)

  const { closeModal, isModalOpen } = useModal()
  const { t } = useTranslation()
  const renderCustom = useConfirmRenderer()

  const onConfirm = useCallback(async () => {
    if (!confirming) {
      setConfirming(true)

      if (typeof onConfirmFromProps === 'function') {
        await onConfirmFromProps()
      }

      setConfirming(false)
      closeModal(modalSlug)
    }
  }, [confirming, onConfirmFromProps, closeModal, modalSlug])

  const onCancel = useCallback(() => {
    if (!confirming) {
      closeModal(modalSlug)

      if (typeof onCancelFromProps === 'function') {
        onCancelFromProps()
      }
    }
  }, [confirming, onCancelFromProps, closeModal, modalSlug])

  // FORK-CHANGES.md #82 — an app-registered ConfirmRenderer replaces the
  // stock modal wholesale (it owns open/close through the same modal bus).
  // Delegated BEFORE the open check so the custom overlay can own its own
  // mount/exit lifecycle from `isModalOpen(modalSlug)`.
  if (renderCustom) {
    const custom = renderCustom(props)
    if (custom !== undefined) {
      return custom
    }
  }

  if (!isModalOpen(modalSlug)) {
    return null
  }

  return (
    <Modal
      className={[baseClass, className].filter(Boolean).join(' ')}
      // Fixes https://github.com/payloadcms/payload/issues/13778
      closeOnBlur={false}
      slug={modalSlug}
      style={{
        zIndex: drawerZBase + editDepth,
      }}
    >
      <div className={`${baseClass}__wrapper`}>
        {!hideCancel && (
          <CloseModalButton
            className={`${baseClass}__close`}
            disabled={confirming}
            slug={modalSlug}
          />
        )}
        <div className={`${baseClass}__content`}>
          {typeof heading === 'string' ? <h1>{heading}</h1> : heading}
          {typeof body === 'string' ? <p>{body}</p> : body}
        </div>
        <div className={`${baseClass}__controls`}>
          {!hideCancel && (
            <Button
              buttonStyle="secondary"
              disabled={confirming}
              id="confirm-cancel"
              onClick={onCancel}
              size="large"
              type="button"
            >
              {cancelLabel || t('general:cancel')}
            </Button>
          )}
          <Button
            buttonStyle={destructive ? 'error' : undefined}
            disabled={confirming}
            id="confirm-action"
            onClick={onConfirm}
            size="large"
          >
            {confirming
              ? confirmingLabel || `${t('general:loading')}...`
              : confirmLabel || t('general:confirm')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
