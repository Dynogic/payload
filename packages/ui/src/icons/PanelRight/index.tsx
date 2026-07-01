import React, { Fragment } from 'react'

import './index.scss'

// PanelRight — a toggleable "side panel" glyph for the Live Preview toggler.
// Inactive (pane closed): outlined rectangle split by a divider line. Active
// (pane open): the right pane is filled, so the icon reads as "panel engaged"
// without colliding with the Eye glyph (now reserved for "open storefront in
// a new tab" in the consuming app). Mirrors EyeIcon's { active } prop shape so
// the Toggler swap is a one-liner.
export const PanelRightIcon: React.FC<{ active?: boolean; className?: string }> = ({
  active = false,
  className,
}) => (
  <svg
    className={[className, 'icon icon--panel-right'].filter(Boolean).join(' ')}
    viewBox="0 0 16 16"
    xmlns="http://www.w3.org/2000/svg"
  >
    {!active ? (
      <Fragment>
        <rect className="stroke" height={12} rx={1.5} width={12} x={2} y={2} />
        <line className="stroke" x1={10} x2={10} y1={2} y2={14} />
      </Fragment>
    ) : (
      <Fragment>
        <rect className="stroke" height={12} rx={1.5} width={12} x={2} y={2} />
        <path
          className="fill"
          d="M10 2 L12.5 2 A1.5 1.5 0 0 1 14 3.5 L14 12.5 A1.5 1.5 0 0 1 12.5 14 L10 14 Z"
        />
      </Fragment>
    )}
  </svg>
)
