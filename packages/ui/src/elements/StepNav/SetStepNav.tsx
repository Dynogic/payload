'use client'
// `next` is declared as a peer dep of @payloadcms/ui. Type resolution can fail
// in this monorepo's build context (NodeNext + canary version export quirks),
// but the runtime import resolves cleanly in consuming Next.js projects.
// @ts-expect-error — see comment above
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

import type { StepNavItem } from './types.js'

import { useStepNav } from './context.js'

export const SetStepNav: React.FC<{
  nav: StepNavItem[]
}> = ({ nav }) => {
  const { setStepNav } = useStepNav()
  const pathname = usePathname()

  useEffect(() => {
    setStepNav(nav)
    // `pathname` is part of the dep array so the effect re-fires on every
    // navigation — including browser back/forward where React may preserve
    // component identity (or restore a cached tree) and the original
    // `[setStepNav, nav]` deps wouldn't be considered changed. Without this,
    // back-nav can land on a page with empty / stale breadcrumbs because the
    // previous SetStepNav on the destination page never re-runs.
  }, [setStepNav, nav, pathname])

  return null
}
