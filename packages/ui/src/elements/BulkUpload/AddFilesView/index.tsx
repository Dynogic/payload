'use client'

import React from 'react'

import { useTranslation } from '../../../providers/Translation/index.js'
import { Button } from '../../Button/index.js'
import { Dropzone } from '../../Dropzone/index.js'
import { DrawerHeader } from '../Header/index.js'
import './index.scss'

const baseClass = 'bulk-upload--add-files'

type Props = {
  readonly acceptMimeTypes?: string
  readonly onCancel: () => void
  readonly onDrop: (acceptedFiles: FileList) => void
}
export function AddFilesView({ acceptMimeTypes, onCancel, onDrop }: Props) {
  const { t } = useTranslation()

  const inputRef = React.useRef(null)

  return (
    <div className={baseClass}>
      <DrawerHeader onClose={onCancel} title={t('upload:addFiles')} />
      <div className={`${baseClass}__dropArea`}>
        <Dropzone multipleFiles onChange={onDrop}>
          <div className={`${baseClass}__content`}>
            {/* lucide-react `cloud-upload` glyph, inlined (the fork can't import lucide) */}
            <div aria-hidden="true" className={`${baseClass}__icon`}>
              <svg
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M12 13v8" />
                <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
                <path d="m8 17 4-4 4 4" />
              </svg>
            </div>
            <p className={`${baseClass}__headline`}>{t('upload:dragAndDrop')}</p>
            <Button
              buttonStyle="subtle"
              iconPosition="left"
              onClick={() => {
                if (inputRef.current) {
                  inputRef.current.click()
                }
              }}
              size="small"
            >
              {t('upload:selectFile')}
            </Button>
          </div>
          <input
            accept={acceptMimeTypes}
            aria-hidden="true"
            className={`${baseClass}__hidden-input`}
            hidden
            multiple
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                onDrop(e.target.files)
              }
            }}
            ref={inputRef}
            type="file"
          />
        </Dropzone>
      </div>
    </div>
  )
}
