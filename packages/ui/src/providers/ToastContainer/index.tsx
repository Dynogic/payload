'use client'
import type { ClientConfig } from 'payload'

import React from 'react'
import { Toaster } from 'sonner'

import { Info } from './icons/Info.js'
import { Success } from './icons/Success.js'
import { Warning } from './icons/Warning.js'

export const ToastContainer: React.FC<{
  config: ClientConfig
}> = ({ config }) => {
  const { admin: { toast: { duration, expand, limit, position } = {} } = {} } = config

  return (
    <Toaster
      className="payload-toast-container"
      closeButton
      // @ts-expect-error
      dir="undefined"
      duration={duration ?? 4000}
      expand={expand ?? false}
      gap={8}
      // Fork #93 / #95: NO icon on an error toast — the error level is said by
      // the toast's red surface and its sentence; the circle-✕ read as a
      // second, louder "no". Sonner resolves the glyph as
      // `toast.icon || icons[type] || its own default`, so leaving `error` out
      // of this map (#93) made sonner paint ITS default ✕. An empty fragment
      // is truthy, so sonner takes it and renders nothing inside the icon
      // slot; the slot element itself (sonner always renders it for a typed
      // toast) is removed from layout in scss/toasts.scss with `!important`,
      // which is what beats sonner's unlayered `[data-icon] { display: flex }`
      // from inside `@layer payload-default`. Other levels keep theirs.
      icons={{
        error: <React.Fragment />,
        info: <Info />,
        success: <Success />,
        warning: <Warning />,
      }}
      offset="calc(var(--gutter-h) / 2)"
      position={position ?? 'bottom-right'}
      toastOptions={{
        classNames: {
          closeButton: 'payload-toast-close-button',
          content: 'toast-content',
          error: 'toast-error',
          icon: 'toast-icon',
          info: 'toast-info',
          success: 'toast-success',
          title: 'toast-title',
          toast: 'payload-toast-item',
          warning: 'toast-warning',
        },
        unstyled: true,
      }}
      visibleToasts={limit ?? 5}
    />
  )
}
