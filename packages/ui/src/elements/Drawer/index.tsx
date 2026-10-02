'use client'
import { Modal, useModal } from '@faceless-ui/modal'
import React, {
  createContext,
  use,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import type { Props, TogglerProps } from './types.js'

import { XIcon } from '../../icons/X/index.js'
import {
  type DrawerFrame,
  DrawerFrameProvider,
  useDrawerRenderer,
} from '../../providers/DrawerRenderer/index.js'
import { useTranslation } from '../../providers/Translation/index.js'
import { Gutter } from '../Gutter/index.js'
import './index.scss'

const baseClass = 'drawer'

export const drawerZBase = 100

export const formatDrawerSlug = ({ slug, depth }: { depth: number; slug: string }): string =>
  `drawer_${depth}_${slug}`

export { useDrawerSlug } from './useDrawerSlug.js'

export const DrawerToggler: React.FC<TogglerProps> = ({
  slug,
  children,
  className,
  disabled,
  onClick,
  ...rest
}) => {
  const { openModal } = useModal()

  const handleClick = useCallback(
    (e) => {
      openModal(slug)
      if (typeof onClick === 'function') {
        onClick(e)
      }
    },
    [openModal, slug, onClick],
  )

  return (
    <button className={className} disabled={disabled} onClick={handleClick} type="button" {...rest}>
      {children}
    </button>
  )
}

export const Drawer: React.FC<Props> = ({
  slug,
  children,
  className,
  gutter = true,
  Header,
  hoverTitle,
  title,
}) => {
  const { t } = useTranslation()
  const { closeModal, modalState } = useModal()
  const drawerDepth = useDrawerDepth()

  const isOpen = !!modalState[slug]?.isOpen

  const [animateIn, setAnimateIn] = useState(isOpen)

  useLayoutEffect(() => {
    setAnimateIn(isOpen)
  }, [isOpen])

  // Fork #111: an app-registered renderer draws the frame. The content's
  // close guard (a document drawer's unsaved-edits check) registers through
  // the frame context and is asked by `requestClose`, which the renderer
  // wires to its own exits (✕, Escape, scrim). No renderer, or a renderer
  // that returns `undefined`: the stock drawer below, unchanged.
  const renderer = useDrawerRenderer()
  const closeGuardRef = useRef<(() => boolean) | null>(null)
  const close = useCallback(() => closeModal(slug), [closeModal, slug])
  const requestClose = useCallback(() => {
    if (closeGuardRef.current?.()) {
      return
    }
    closeModal(slug)
  }, [closeModal, slug])
  const appFrame = useMemo<DrawerFrame>(
    () => ({
      appRendered: true,
      setCloseGuard: (guard) => {
        closeGuardRef.current = guard
      },
    }),
    [],
  )
  const rendered = renderer?.({
    slug,
    children,
    className,
    close,
    depth: drawerDepth,
    gutter,
    Header,
    hoverTitle,
    isOpen,
    requestClose,
    title,
  })

  if (rendered !== undefined) {
    return (
      <DrawerDepthProvider>
        <DrawerFrameProvider value={appFrame}>{rendered}</DrawerFrameProvider>
      </DrawerDepthProvider>
    )
  }

  if (isOpen) {
    // IMPORTANT: do not render the drawer until it is explicitly open, this is to avoid large html trees especially when nesting drawers
    return (
      <DrawerDepthProvider>
        <Modal
          className={[
            className,
            baseClass,
            animateIn && `${baseClass}--is-open`,
            drawerDepth > 1 && `${baseClass}--nested`,
          ]
            .filter(Boolean)
            .join(' ')}
          // Fixes https://github.com/payloadcms/payload/issues/13778
          closeOnBlur={false}
          slug={slug}
          style={{
            zIndex: drawerZBase + drawerDepth,
          }}
        >
          {(!drawerDepth || drawerDepth === 1) && <div className={`${baseClass}__blur-bg`} />}
          <button
            aria-label={t('general:close')}
            className={`${baseClass}__close`}
            id={`close-drawer__${slug}`}
            onClick={() => closeModal(slug)}
            tabIndex={-1}
            type="button"
          />
          <div
            className={`${baseClass}__content`}
            style={{
              width: `calc(100% - (${drawerDepth} * var(--gutter-h)))`,
            }}
          >
            <div className={`${baseClass}__blur-bg-content`} />
            <Gutter className={`${baseClass}__content-children`} left={gutter} right={gutter}>
              {Header}
              {Header === undefined && (
                <div className={`${baseClass}__header`}>
                  <h2 className={`${baseClass}__header__title`} title={hoverTitle ? title : null}>
                    {title}
                  </h2>
                  {/* TODO: the `button` HTML element breaks CSS transitions on the drawer for some reason...
                    i.e. changing to a `div` element will fix the animation issue but will break accessibility
                  */}
                  <button
                    aria-label={t('general:close')}
                    className={`${baseClass}__header__close`}
                    id={`close-drawer__${slug}`}
                    onClick={() => closeModal(slug)}
                    tabIndex={-1}
                    type="button"
                  >
                    <XIcon />
                  </button>
                </div>
              )}
              {children}
            </Gutter>
          </div>
        </Modal>
      </DrawerDepthProvider>
    )
  }

  return null
}

export const DrawerDepthContext = createContext(1)

// Fork #111: every drawer level starts with no app frame, so a stock drawer
// nested inside an app-rendered one does not inherit its frame; the
// app-rendered path provides its own frame inside this provider.
const stockFrame: DrawerFrame = { appRendered: false, setCloseGuard: () => undefined }

export const DrawerDepthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const parentDepth = useDrawerDepth()
  const depth = parentDepth + 1

  return (
    <DrawerDepthContext value={depth}>
      <DrawerFrameProvider value={stockFrame}>{children}</DrawerFrameProvider>
    </DrawerDepthContext>
  )
}

export const useDrawerDepth = (): number => use(DrawerDepthContext)
