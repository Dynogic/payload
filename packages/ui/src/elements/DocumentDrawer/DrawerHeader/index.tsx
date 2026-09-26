'use client'

import { useCallback, useEffect, useRef } from 'react'

import { Gutter } from '../../../elements/Gutter/index.js'
import { useModal } from '../../../elements/Modal/index.js'
import { RenderTitle } from '../../../elements/RenderTitle/index.js'
import { useFormModified } from '../../../forms/Form/index.js'
import { XIcon } from '../../../icons/X/index.js'
import { useDocumentInfo } from '../../../providers/DocumentInfo/index.js'
import { useDocumentTitle } from '../../../providers/DocumentTitle/index.js'
import { useTranslation } from '../../../providers/Translation/index.js'
import { IDLabel } from '../../IDLabel/index.js'
import { LeaveWithoutSavingModal } from '../../LeaveWithoutSaving/index.js'
import { documentDrawerBaseClass } from '../index.js'
import './index.scss'

const leaveWithoutSavingModalSlug = 'leave-without-saving-doc-drawer'

export const DocumentDrawerHeader: React.FC<{
  AfterHeader?: React.ReactNode
  drawerSlug: string
  showDocumentID?: boolean
}> = ({ AfterHeader, drawerSlug, showDocumentID = true }) => {
  const { closeModal, openModal } = useModal()
  const { t } = useTranslation()
  const isModified = useFormModified()

  const handleOnClose = useCallback(() => {
    if (isModified) {
      openModal(leaveWithoutSavingModalSlug)
    } else {
      closeModal(drawerSlug)
    }
  }, [isModified, openModal, closeModal, drawerSlug])

  // Fork #101: the ✕ above was the drawer's ONLY guarded exit. Esc
  // (faceless-ui's document-level CLOSE_LATEST_MODAL) and a click on the
  // backdrop (Drawer's full-bleed `.drawer__close` button) both closed a
  // drawer holding unsaved edits without asking, and the edits were gone.
  // Both are intercepted here, where the form's modified state is known:
  //  - Esc: a native bubble listener on the drawer element runs before
  //    faceless-ui's listener on `document`, so stopping propagation keeps the
  //    drawer open. An Esc something inside already consumed
  //    (`defaultPrevented`, e.g. a select closing its menu) is still kept
  //    from faceless-ui but asks nothing; an overlay above the drawer (a
  //    Radix dialog, the leave confirm itself) stops Esc in its own capture
  //    listener, so it never arrives here.
  //  - Backdrop: a capture listener on the button runs before React's
  //    delegated onClick, so the close never dispatches.
  // A pristine form changes nothing: both paths close as they always did.
  const headerRef = useRef<HTMLDivElement>(null)
  const modifiedRef = useRef(isModified)
  modifiedRef.current = isModified

  useEffect(() => {
    const drawer = headerRef.current?.closest('.drawer')
    if (!drawer) {
      return undefined
    }
    const backdrop = drawer.querySelector(':scope > .drawer__close')

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !modifiedRef.current) {
        return
      }
      event.stopPropagation()
      if (!event.defaultPrevented) {
        event.preventDefault()
        openModal(leaveWithoutSavingModalSlug)
      }
    }
    const onBackdropClick = (event: Event) => {
      if (!modifiedRef.current) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      openModal(leaveWithoutSavingModalSlug)
    }

    drawer.addEventListener('keydown', onKeyDown as EventListener)
    backdrop?.addEventListener('click', onBackdropClick, true)
    return () => {
      drawer.removeEventListener('keydown', onKeyDown as EventListener)
      backdrop?.removeEventListener('click', onBackdropClick, true)
    }
  }, [openModal])

  return (
    <Gutter className={`${documentDrawerBaseClass}__header`} ref={headerRef}>
      <div className={`${documentDrawerBaseClass}__header-content`}>
        <h2 className={`${documentDrawerBaseClass}__header-text`}>
          {<RenderTitle element="span" />}
        </h2>
        <button
          aria-label={t('general:close')}
          className={`${documentDrawerBaseClass}__header-close`}
          onClick={handleOnClose}
          type="button"
        >
          <XIcon />
        </button>
      </div>
      {showDocumentID && <DocumentID />}
      {AfterHeader ? (
        <div className={`${documentDrawerBaseClass}__after-header`}>{AfterHeader}</div>
      ) : null}

      <LeaveWithoutSavingModal
        modalSlug={leaveWithoutSavingModalSlug}
        onConfirm={() => closeModal(drawerSlug)}
      />
    </Gutter>
  )
}

const DocumentID: React.FC = () => {
  const { id } = useDocumentInfo()
  const { title } = useDocumentTitle()
  return id && id !== title ? <IDLabel id={id.toString()} /> : null
}
