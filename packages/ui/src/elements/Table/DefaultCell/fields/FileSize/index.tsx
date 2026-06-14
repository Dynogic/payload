'use client'

import React from 'react'

import { useTranslation } from '../../../../../providers/Translation/index.js'

type Props = {
  cellData: number
}

export const FileSizeCell: React.FC<Props> = ({ cellData }) => {
  const { i18n } = useTranslation()

  if (typeof cellData !== 'number') {
    return null
  }

  const locale = i18n.language

  let value: number
  let unit: string
  let fractionDigits: number

  if (cellData === 0) {
    return <span>0 B</span>
  } else if (cellData < 1024) {
    value = cellData
    unit = 'B'
    fractionDigits = 0
  } else if (cellData < 1024 * 1024) {
    value = cellData / 1024
    unit = 'KB'
    fractionDigits = 1
  } else if (cellData < 1024 * 1024 * 1024) {
    value = cellData / (1024 * 1024)
    unit = 'MB'
    fractionDigits = 1
  } else {
    value = cellData / (1024 * 1024 * 1024)
    unit = 'GB'
    fractionDigits = 2
  }

  const formatted = new Intl.NumberFormat(locale, {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: 0,
  }).format(value)

  return <span>{`${formatted} ${unit}`}</span>
}
