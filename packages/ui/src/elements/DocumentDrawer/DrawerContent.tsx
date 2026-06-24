'use client'

import { useModal } from '@faceless-ui/modal'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import type { DocumentDrawerProps } from './types.js'

import { LoadingOverlay } from '../../elements/Loading/index.js'
import { useConfig } from '../../providers/Config/index.js'
import { useServerFunctions } from '../../providers/ServerFunctions/index.js'
import { useTranslation } from '../../providers/Translation/index.js'
import { abortAndIgnore, handleAbortRef } from '../../utilities/abortAndIgnore.js'
import { DocumentDrawerContextProvider } from './Provider.js'

export const DocumentDrawerContent: React.FC<DocumentDrawerProps> = ({
  id: docID,
  allowedMimeTypes,
  collectionSlug,
  disableActions,
  drawerContext,
  drawerSlug,
  filterOptions,
  hideTabs,
  initialData,
  onDelete: onDeleteFromProps,
  onDuplicate: onDuplicateFromProps,
  onSave: onSaveFromProps,
  overrideEntityVisibility = true,
  redirectAfterCreate,
  redirectAfterDelete,
  redirectAfterDuplicate,
  redirectAfterRestore,
}) => {
  const { getEntityConfig } = useConfig()

  const [collectionConfig] = useState(() => getEntityConfig({ collectionSlug }))

  const abortGetDocumentViewRef = React.useRef<AbortController>(null)

  const { closeModal } = useModal()
  const { t } = useTranslation()

  const { renderDocument } = useServerFunctions()

  const [DocumentView, setDocumentView] = useState<React.ReactNode>(undefined)
  const [isLoading, setIsLoading] = useState(true)

  const hasInitialized = useRef(false)

  const getDocumentView = useCallback(
    (docID?: DocumentDrawerProps['id'], showLoadingIndicator: boolean = false) => {
      const controller = handleAbortRef(abortGetDocumentViewRef)

      const fetchDocumentView = async () => {
        if (showLoadingIndicator) {
          setIsLoading(true)
        }

        try {
          const result = await renderDocument({
            collectionSlug,
            disableActions,
            docID,
            drawerSlug,
            filterOptions,
            initialData,
            overrideEntityVisibility,
            redirectAfterCreate,
            redirectAfterDelete: redirectAfterDelete !== undefined ? redirectAfterDelete : false,
            redirectAfterDuplicate:
              redirectAfterDuplicate !== undefined ? redirectAfterDuplicate : false,
            redirectAfterRestore: redirectAfterRestore !== undefined ? redirectAfterRestore : false,
            signal: controller.signal,
          })

          if (result?.Document) {
            setDocumentView(result.Document)
            setIsLoading(false)
          }
        } catch (error) {
          toast.error(error?.message || t('error:unspecific'))
          closeModal(drawerSlug)
        }

        abortGetDocumentViewRef.current = null
      }

      void fetchDocumentView()
    },
    [
      collectionSlug,
      disableActions,
      drawerSlug,
      filterOptions,
      initialData,
      redirectAfterDelete,
      redirectAfterDuplicate,
      redirectAfterRestore,
      renderDocument,
      redirectAfterCreate,
      closeModal,
      overrideEntityVisibility,
      t,
    ],
  )

  const isCreateDrawer = !docID

  // Fork #61: close-on-create-save depends on drawerContext.saveMode.
  //  - 'default'  → mirror upstream: reload the view with the new doc (stay open).
  //  - otherwise  → 'saveAndAdd' / 'createEdit' close the create drawer on save.
  const saveMode = drawerContext?.saveMode ?? 'saveAndAdd'

  const onSave = useCallback<DocumentDrawerProps['onSave']>(
    (args) => {
      if (typeof onSaveFromProps === 'function') {
        void onSaveFromProps({
          ...args,
          collectionConfig,
        })
      }

      if (isCreateDrawer) {
        if (saveMode === 'default') {
          getDocumentView(args.doc.id)
        } else {
          closeModal(drawerSlug)
        }
      }
    },
    [onSaveFromProps, collectionConfig, isCreateDrawer, closeModal, drawerSlug, saveMode, getDocumentView],
  )

  const onDuplicate = useCallback<DocumentDrawerProps['onDuplicate']>(
    (args) => {
      getDocumentView(args.doc.id)

      if (typeof onDuplicateFromProps === 'function') {
        void onDuplicateFromProps({
          ...args,
          collectionConfig,
        })
      }
    },
    [onDuplicateFromProps, collectionConfig, getDocumentView],
  )

  const onDelete = useCallback<DocumentDrawerProps['onDelete']>(
    (args) => {
      if (typeof onDeleteFromProps === 'function') {
        void onDeleteFromProps({
          ...args,
          collectionConfig,
        })
      }

      closeModal(drawerSlug)
    },
    [onDeleteFromProps, closeModal, drawerSlug, collectionConfig],
  )

  const clearDoc = useCallback(() => {
    getDocumentView(undefined, true)
  }, [getDocumentView])

  useEffect(() => {
    if (!DocumentView && !hasInitialized.current) {
      getDocumentView(docID, true)
      hasInitialized.current = true
    }
  }, [DocumentView, getDocumentView, docID])

  // Cleanup any pending requests when the component unmounts
  useEffect(() => {
    const abortGetDocumentView = abortGetDocumentViewRef.current

    return () => {
      abortAndIgnore(abortGetDocumentView)
    }
  }, [])

  if (isLoading) {
    return <LoadingOverlay />
  }

  return (
    <DocumentDrawerContextProvider
      allowedMimeTypes={allowedMimeTypes}
      clearDoc={clearDoc}
      drawerContext={drawerContext}
      drawerSlug={drawerSlug}
      filterOptions={filterOptions}
      hideTabs={hideTabs}
      isCreateDrawer={isCreateDrawer}
      onDelete={onDelete}
      onDuplicate={onDuplicate}
      onSave={onSave}
    >
      {DocumentView}
    </DocumentDrawerContextProvider>
  )
}
