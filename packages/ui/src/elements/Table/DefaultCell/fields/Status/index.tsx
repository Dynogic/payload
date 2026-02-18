'use client'

import type { OptionObject, SelectFieldClient } from 'payload'

import { getTranslation } from '@payloadcms/translations'
import { optionsAreObjects } from 'payload/shared'
import React from 'react'

import { useTranslation } from '../../../../../providers/Translation/index.js'
import './index.scss'

type Props = {
  cellData: string
  field: SelectFieldClient
}

export const StatusCell: React.FC<Props> = ({ cellData, field: { options } }) => {
  const { i18n } = useTranslation()

  if (!cellData) {
    return null
  }

  let label: React.ReactNode = cellData

  if (optionsAreObjects(options)) {
    const found = options.find((opt) => opt.value === cellData)

    if (found) {
      label = getTranslation(found.label, i18n)
    }
  }

  return <span className={`status-badge status-badge--${cellData}`}>{label}</span>
}
