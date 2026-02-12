'use client'

import type { Data, ViewTypes } from 'payload'

import { formatAdminURL } from 'payload/shared'
import React, { useEffect } from 'react'

import { useTranslation } from '../../../providers/Translation/index.js'
import { Link } from '../../Link/index.js'
import { useListDrawerContext } from '../../ListDrawer/Provider.js'

type Props = {
  readonly adminRoute: string
  readonly apiRoute: string
  readonly collectionSlug: string
  readonly data: Data
  readonly docTitle: string
  readonly folderCollectionSlug: string
  readonly folderFieldName: string
  readonly viewType?: ViewTypes
}

export const FolderTableCellClient = ({
  adminRoute,
  apiRoute,
  collectionSlug,
  data,
  folderCollectionSlug,
  folderFieldName,
}: Props) => {
  const folderID = data?.[folderFieldName]

  const { t } = useTranslation()
  const [folderName, setFolderName] = React.useState(() =>
    folderID ? `${t('general:loading')}...` : null,
  )

  const lastLoadedFolderID = React.useRef<null | number | string>(null)

  useEffect(() => {
    const loadFolderName = async () => {
      try {
        const req = await fetch(
          formatAdminURL({
            apiRoute,
            path: `/${folderCollectionSlug}/${folderID}`,
          }),
          {
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            method: 'GET',
          },
        )

        const res = await req.json()
        setFolderName(res?.name || null)
        lastLoadedFolderID.current = folderID
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error loading folder name', error)
        setFolderName(null)
      }
    }

    // Re-fetch if folderID changed or hasn't been loaded yet
    if (folderID && lastLoadedFolderID.current !== folderID) {
      void loadFolderName()
    } else if (!folderID) {
      setFolderName(null)
      lastLoadedFolderID.current = null
    }
  }, [apiRoute, folderCollectionSlug, folderID])

  const { drawerSlug, onSelect } = useListDrawerContext()

  if (!folderID) {
    return <span style={{ opacity: 0.5 }}>—</span>
  }

  const displayName = folderName || '...'

  // In drawer/picker mode, use onSelect for selection
  if (drawerSlug && typeof onSelect === 'function') {
    return (
      <button
        onClick={() => onSelect({ collectionSlug, doc: data, docID: data?.id as string })}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          textAlign: 'left',
        }}
        type="button"
      >
        {displayName}
      </button>
    )
  }

  const href = formatAdminURL({
    adminRoute,
    path: `/collections/${collectionSlug}/folders/${folderID}`,
  })

  return (
    <Link href={href} prefetch={false}>
      {displayName}
    </Link>
  )
}
