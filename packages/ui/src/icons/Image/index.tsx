import React from 'react'

import './index.scss'

export const ImageIcon = () => {
  return (
    <svg
      className="icon icon--image"
      fill="none"
      height="16"
      viewBox="0 0 24 24"
      width="16"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform="translate(0, -1)">
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9" cy="9" r="2" stroke="currentColor" strokeWidth="2" />
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  )
}