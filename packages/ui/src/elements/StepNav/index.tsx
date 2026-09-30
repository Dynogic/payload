'use client'

import { getTranslation } from '@payloadcms/translations'
import React, { Fragment } from 'react'

import type { StepNavItem } from './types.js'

import { PayloadIcon } from '../../graphics/Icon/index.js'
import { useConfig } from '../../providers/Config/index.js'
import { useTranslation } from '../../providers/Translation/index.js'
import { Link } from '../Link/index.js'
import { RenderCustomComponent } from '../RenderCustomComponent/index.js'
import { StepNavProvider, useStepNav } from './context.js'
import './index.scss'

export { SetStepNav } from './SetStepNav.js'

const baseClass = 'step-nav'

const StepNav: React.FC<{
  readonly className?: string
  readonly CustomIcon?: React.ReactNode
  /**
   * @deprecated
   * This prop is deprecated and will be removed in the next major version.
   * Components now import their own `Link` directly from `next/link`.
   */
  readonly Link?: React.ComponentType
}> = ({ className, CustomIcon }) => {
  const { i18n, t } = useTranslation()
  const { stepNav } = useStepNav()
  const {
    config: {
      routes: { admin },
    },
  } = useConfig()

  return (
    <Fragment>
      {stepNav.length > 0 ? (
        <nav className={[baseClass, className].filter(Boolean).join(' ')}>
          <Link className={`${baseClass}__home`} href={admin} prefetch={false} tabIndex={0}>
            <span title={t('general:dashboard')}>
              <RenderCustomComponent CustomComponent={CustomIcon} Fallback={<PayloadIcon />} />
            </span>
          </Link>
          <span>/</span>
          {stepNav.map((item, i) => {
            const StepLabel = getTranslation(item.label, i18n)
            const isLast = stepNav.length === i + 1

            // FORK (#104): a step with an `onClick` is a button (wherever it
            // sits in the trail) and never a link; the last one keeps its
            // `__last` class so it reads exactly like the plain last step.
            const Action = item.onClick ? (
              <button
                className={[`${baseClass}__action`, isLast && `${baseClass}__last`]
                  .filter(Boolean)
                  .join(' ')}
                key={i}
                onClick={item.onClick}
                type="button"
              >
                <span>{StepLabel}</span>
              </button>
            ) : null

            const Step = isLast ? (
              (Action ??
              (item.url ? (
                <Link className={`${baseClass}__last`} href={item.url} key={i} prefetch={false}>
                  <span>{StepLabel}</span>
                </Link>
              ) : (
                <span className={`${baseClass}__last`} key={i}>
                  {StepLabel}
                </span>
              )))
            ) : (
              <Fragment key={i}>
                {Action ??
                  (item.url ? (
                    <Link href={item.url} prefetch={false}>
                      <span key={i}>{StepLabel}</span>
                    </Link>
                  ) : (
                    <span key={i}>{StepLabel}</span>
                  ))}
                <span>/</span>
              </Fragment>
            )

            return Step
          })}
        </nav>
      ) : (
        <div className={[baseClass, className].filter(Boolean).join(' ')}>
          <div className={`${baseClass}__home`}>
            <span title={t('general:dashboard')}>
              <RenderCustomComponent CustomComponent={CustomIcon} Fallback={<PayloadIcon />} />
            </span>
          </div>
        </div>
      )}
    </Fragment>
  )
}

export { StepNav, StepNavItem, StepNavProvider, useStepNav }
