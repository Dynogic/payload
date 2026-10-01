'use client'
import React from 'react'

import { useTranslation } from '../../../providers/Translation/index.js'
import { useNav } from '../context.js'
import { useNavToggle } from '../useNavToggle.js'
import './index.scss'

const baseClass = 'nav-toggler'

export const NavToggler: React.FC<{
  children?: React.ReactNode
  className?: string
  id?: string
  tabIndex?: number
}> = (props) => {
  const { id, children, className, tabIndex = 0 } = props

  const { t } = useTranslation()

  const { navOpen } = useNav()

  const toggleNav = useNavToggle()

  return (
    <button
      aria-label={`${navOpen ? t('general:close') : t('general:open')} ${t('general:menu')}`}
      className={[baseClass, navOpen && `${baseClass}--is-open`, className]
        .filter(Boolean)
        .join(' ')}
      id={id}
      onClick={async () => {
        await toggleNav()
      }}
      tabIndex={tabIndex}
      type="button"
    >
      {children}
    </button>
  )
}
