import type { LabelFunction, StaticLabel } from 'payload'
import type React from 'react'

export type StepNavItem = {
  label: LabelFunction | React.JSX.Element | StaticLabel
  /**
   * FORK (#104): the step ACTS instead of navigating. When set, the step
   * renders as a `<button type="button">` that calls it (click, Enter,
   * Space), and `url` is ignored. The last step keeps its `step-nav__last`
   * class and its look, plus the underline on hover / focus-visible every
   * clickable step wears.
   */
  onClick?: () => void
  url?: string
}

export type ContextType = {
  setStepNav: (items: StepNavItem[]) => void
  stepNav: StepNavItem[]
}
