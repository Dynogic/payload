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
      // Fork #93: NO icon on an error toast — the error level is said by the
      // toast's red surface and its sentence; the circle-✕ read as a second,
      // louder "no". Sonner falls back to its own default glyph for any level
      // missing from this map, so the error level is also hidden in CSS
      // (scss/toasts.scss → `.toast-error .toast-icon`). Other levels keep
      // theirs.
      icons={{
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
