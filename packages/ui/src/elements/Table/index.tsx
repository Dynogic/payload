'use client'

import type { Column } from 'payload'

import { useRouter } from 'next/navigation.js'
import React, { useCallback } from 'react'

import { useConfig } from '../../providers/Config/index.js'
import { formatAdminURL } from '../../utilities/formatAdminURL.js'
import { useListDrawerContext } from '../ListDrawer/Provider.js'
import './index.scss'

const baseClass = 'table'

export type Props = {
  readonly appearance?: 'condensed' | 'default'
  readonly BeforeTable?: React.ReactNode
  readonly collectionSlug?: string
  readonly columns?: Column[]
  readonly data: Record<string, unknown>[]
}

const interactiveSelector = 'a, button, input, label, select, textarea, [role="button"]'

export const Table: React.FC<Props> = ({
  appearance,
  BeforeTable,
  collectionSlug,
  columns,
  data,
}) => {
  const activeColumns = columns?.filter((col) => col?.active)
  const router = useRouter()
  const { drawerSlug, onSelect } = useListDrawerContext()

  const {
    config: {
      routes: { admin: adminRoute },
    },
  } = useConfig()

  const handleRowClick = useCallback(
    (e: React.MouseEvent<HTMLTableRowElement>, row: Record<string, unknown>) => {
      if (!collectionSlug) {
        return
      }

      // Don't navigate if clicking on interactive elements
      const target = e.target as HTMLElement
      if (target.closest(interactiveSelector)) {
        return
      }

      // Don't navigate if clicking on select or drag handle columns
      if (target.closest('.cell-_select, .cell-_dragHandle')) {
        return
      }

      if (drawerSlug && typeof onSelect === 'function') {
        onSelect({
          collectionSlug,
          doc: row,
          docID: row.id as string,
        })
      } else {
        const href = formatAdminURL({
          adminRoute,
          path: `/collections/${collectionSlug}/${encodeURIComponent(String(row.id))}`,
        })
        router.push(href)
      }
    },
    [adminRoute, collectionSlug, drawerSlug, onSelect, router],
  )

  if (!activeColumns || activeColumns.length === 0) {
    return <div>No columns selected</div>
  }

  return (
    <div
      className={[baseClass, appearance && `${baseClass}--appearance-${appearance}`]
        .filter(Boolean)
        .join(' ')}
    >
      {BeforeTable}
      <table cellPadding="0" cellSpacing="0">
        <thead>
          <tr>
            {activeColumns.map((col, i) => (
              <th id={`heading-${col.accessor.replace(/\./g, '__')}`} key={i}>
                {col.Heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data &&
            data?.map((row, rowIndex) => {
              return (
                <tr
                  className={`row-${rowIndex + 1}`}
                  data-id={row.id}
                  key={
                    typeof row.id === 'string' || typeof row.id === 'number'
                      ? String(row.id)
                      : rowIndex
                  }
                  onClick={collectionSlug ? (e) => handleRowClick(e, row) : undefined}
                >
                  {activeColumns.map((col, colIndex) => {
                    const { accessor } = col

                    return (
                      <td className={`cell-${accessor.replace(/\./g, '__')}`} key={colIndex}>
                        {col.renderedCells[rowIndex]}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
        </tbody>
      </table>
    </div>
  )
}
