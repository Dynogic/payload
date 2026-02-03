'use client'
import type { ClientCollectionConfig, ViewTypes, Where } from 'payload'
import type { FolderOrDocument } from 'payload/shared'

import { useModal } from '@faceless-ui/modal'
import { useRouter, useSearchParams } from 'next/navigation.js'
import { formatAdminURL } from 'payload/shared'
import * as qs from 'qs-esm'
import React, { Fragment, useCallback, useState } from 'react'
import { toast } from 'sonner'

import { ConfirmationModal } from '../../../elements/ConfirmationModal/index.js'
import { DeleteMany } from '../../../elements/DeleteMany/index.js'
import { EditMany_v4 } from '../../../elements/EditMany/index.js'
import { MoveItemsToFolderDrawer } from '../../../elements/FolderView/Drawers/MoveToFolder/index.js'
import { ListSelection_v4, ListSelectionButton } from '../../../elements/ListSelection/index.js'
import { PublishMany_v4 } from '../../../elements/PublishMany/index.js'
import { RestoreMany } from '../../../elements/RestoreMany/index.js'
import { Translation } from '../../../elements/Translation/index.js'
import { UnpublishMany_v4 } from '../../../elements/UnpublishMany/index.js'
import { useConfig } from '../../../providers/Config/index.js'
import { useRouteCache } from '../../../providers/RouteCache/index.js'
import { SelectAllStatus, useSelection } from '../../../providers/Selection/index.js'
import { useTranslation } from '../../../providers/Translation/index.js'
import { parseSearchParams } from '../../../utilities/parseSearchParams.js'

const assignFolderDrawerSlug = 'assign-folder--list'
const assignFolderConfirmModalSlug = 'assign-folder-confirm--list'

export type ListSelectionProps = {
  collectionConfig?: ClientCollectionConfig
  disableBulkDelete?: boolean
  disableBulkEdit?: boolean
  label: string
  modalPrefix?: string
  showSelectAllAcrossPages?: boolean
  viewType?: ViewTypes
  where?: Where
}

export const ListSelection: React.FC<ListSelectionProps> = ({
  collectionConfig,
  disableBulkDelete,
  disableBulkEdit,
  label,
  modalPrefix,
  showSelectAllAcrossPages = true,
  viewType,
  where,
}) => {
  const { count, selectAll, selectedIDs, toggleAll, totalDocs } = useSelection()
  const { t } = useTranslation()
  const { config } = useConfig()
  const { closeModal, openModal } = useModal()
  const { clearRouteCache } = useRouteCache()
  const router = useRouter()
  const searchParams = useSearchParams()

  // State for pending folder assignment (used by confirmation modal)
  const [pendingAssignment, setPendingAssignment] = useState<{
    id: null | number | string
    name: null | string
  } | null>(null)

  const onActionSuccess = useCallback(() => toggleAll(), [toggleAll])

  const isFoldersEnabled = collectionConfig?.folders && config.folders
  const folderCollectionSlug = config.folders ? config.folders.slug : ''
  const folderFieldName = config.folders ? config.folders.fieldName : ''

  const itemsToMove = React.useMemo(() => {
    if (!collectionConfig || !isFoldersEnabled) {
      return []
    }
    return selectedIDs.map((id) => ({
      itemKey: `${collectionConfig.slug}-${id}` as const,
      relationTo: collectionConfig.slug,
      value: { id },
    })) as unknown as FolderOrDocument[]
  }, [selectedIDs, collectionConfig, isFoldersEnabled])

  // Called when user selects a folder in the drawer - opens confirmation modal
  const handleFolderSelected = useCallback(
    ({ id, name }: { id: null | number | string; name: null | string }) => {
      setPendingAssignment({ id, name })
      openModal(assignFolderConfirmModalSlug)
    },
    [openModal],
  )

  // Called when user confirms the assignment
  const handleConfirmAssignment = useCallback(async () => {
    if (!collectionConfig || !pendingAssignment) {
      return
    }

    const { id: folderID, name } = pendingAssignment

    try {
      // Update each selected document's folder field
      await Promise.all(
        selectedIDs.map((docID) =>
          fetch(
            formatAdminURL({
              apiRoute: config.routes.api,
              path: `/${collectionConfig.slug}/${docID}`,
            }),
            {
              body: JSON.stringify({
                [folderFieldName]: folderID,
              }),
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
              method: 'PATCH',
            },
          ),
        ),
      )

      if (folderID) {
        toast.success(
          t('folder:itemsAssignedToFolder', {
            folderName: `"${name}"`,
            title: `${count} ${count > 1 ? t('general:items') : t('general:item')}`,
          }),
        )
      } else {
        toast.success(
          t('folder:itemsRemovedFromFolder', {
            title: `${count} ${count > 1 ? t('general:items') : t('general:item')}`,
          }),
        )
      }

      closeModal(assignFolderConfirmModalSlug)
      closeModal(assignFolderDrawerSlug)
      toggleAll()
      setPendingAssignment(null)

      // Force refresh the list - same pattern as DeleteMany/EditMany
      router.replace(
        qs.stringify(
          {
            ...parseSearchParams(searchParams),
            _r: Date.now(),
          },
          { addQueryPrefix: true },
        ),
      )
      clearRouteCache()
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error assigning folder', error)
    }
  }, [
    collectionConfig,
    pendingAssignment,
    selectedIDs,
    config.routes.api,
    folderFieldName,
    t,
    count,
    clearRouteCache,
    closeModal,
    toggleAll,
    router,
    searchParams,
  ])

  if (count === 0) {
    return null
  }

  const isTrashView = collectionConfig?.trash && viewType === 'trash'

  return (
    <ListSelection_v4
      count={count}
      ListActions={[
        selectAll !== SelectAllStatus.AllAvailable &&
        count < totalDocs &&
        showSelectAllAcrossPages !== false ? (
          <ListSelectionButton
            aria-label={t('general:selectAll', { count: `(${totalDocs})`, label })}
            id="select-all-across-pages"
            key="select-all"
            onClick={() => toggleAll(true)}
          >
            {t('general:selectAll', { count: `(${totalDocs})`, label: '' })}
          </ListSelectionButton>
        ) : null,
      ].filter(Boolean)}
      SelectionActions={[
        !disableBulkEdit && !isTrashView && (
          <Fragment key="bulk-actions">
            <EditMany_v4
              collection={collectionConfig}
              count={count}
              ids={selectedIDs}
              modalPrefix={modalPrefix}
              onSuccess={onActionSuccess}
              selectAll={selectAll === SelectAllStatus.AllAvailable}
              where={where}
            />
            <PublishMany_v4
              collection={collectionConfig}
              count={count}
              ids={selectedIDs}
              modalPrefix={modalPrefix}
              onSuccess={onActionSuccess}
              selectAll={selectAll === SelectAllStatus.AllAvailable}
              where={where}
            />
            <UnpublishMany_v4
              collection={collectionConfig}
              count={count}
              ids={selectedIDs}
              modalPrefix={modalPrefix}
              onSuccess={onActionSuccess}
              selectAll={selectAll === SelectAllStatus.AllAvailable}
              where={where}
            />
          </Fragment>
        ),
        isFoldersEnabled && !isTrashView && (
          <React.Fragment key={assignFolderDrawerSlug}>
            <ListSelectionButton
              onClick={() => {
                openModal(assignFolderDrawerSlug)
              }}
              type="button"
            >
              {t('folder:assignFolder')}
            </ListSelectionButton>

            <MoveItemsToFolderDrawer
              action="moveItemsToFolder"
              drawerSlug={assignFolderDrawerSlug}
              folderAssignedCollections={[collectionConfig.slug]}
              folderCollectionSlug={folderCollectionSlug}
              folderFieldName={folderFieldName}
              fromFolderID={undefined}
              fromFolderName={undefined}
              itemsToMove={itemsToMove}
              onConfirm={handleFolderSelected}
              skipConfirmModal
            />

            <ConfirmationModal
              body={
                pendingAssignment?.id ? (
                  <Translation
                    elements={{
                      1: ({ children }) => <strong>{children}</strong>,
                      2: ({ children }) => <strong>{children}</strong>,
                    }}
                    i18nKey="folder:assignItemsToFolderConfirmation"
                    t={t}
                    variables={{
                      count,
                      label: count > 1 ? t('general:items') : t('general:item'),
                      toFolder: pendingAssignment.name,
                    }}
                  />
                ) : (
                  <Translation
                    elements={{
                      1: ({ children }) => <strong>{children}</strong>,
                    }}
                    i18nKey="folder:assignItemsToRootConfirmation"
                    t={t}
                    variables={{
                      count,
                      label: count > 1 ? t('general:items') : t('general:item'),
                    }}
                  />
                )
              }
              confirmingLabel={t('folder:assigning')}
              confirmLabel={t('folder:assign')}
              heading={t('folder:confirmAssignment')}
              modalSlug={assignFolderConfirmModalSlug}
              onConfirm={handleConfirmAssignment}
            />
          </React.Fragment>
        ),
        isTrashView && (
          <RestoreMany collection={collectionConfig} key="bulk-restore" viewType={viewType} />
        ),
        !disableBulkDelete && (
          <DeleteMany
            collection={collectionConfig}
            key="bulk-delete"
            modalPrefix={modalPrefix}
            viewType={viewType}
          />
        ),
      ].filter(Boolean)}
    />
  )
}
