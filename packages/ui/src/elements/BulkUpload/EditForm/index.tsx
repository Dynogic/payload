'use client'

import React, { useCallback, useEffect, useMemo, useRef } from 'react'

import type { EditFormProps } from './types.js'

import { Form, useForm } from '../../../forms/Form/index.js'
import { type FormProps } from '../../../forms/Form/types.js'
import { WatchChildErrors } from '../../../forms/WatchChildErrors/index.js'
import { useConfig } from '../../../providers/Config/index.js'
import { useDocumentEvents } from '../../../providers/DocumentEvents/index.js'
import { useDocumentInfo } from '../../../providers/DocumentInfo/index.js'
import { OperationProvider } from '../../../providers/Operation/index.js'
import { useServerFunctions } from '../../../providers/ServerFunctions/index.js'
import { abortAndIgnore, handleAbortRef } from '../../../utilities/abortAndIgnore.js'
import { useDocumentDrawerContext } from '../../DocumentDrawer/Provider.js'
import { DocumentFields } from '../../DocumentFields/index.js'
import { MoveDocToFolder } from '../../FolderView/MoveDocToFolder/index.js'
import { Upload_v4 } from '../../Upload/index.js'
import { useFormsManager } from '../FormsManager/index.js'
import './index.scss'

const baseClass = 'collection-edit'

// This component receives props only on _pages_
// When rendered within a drawer, props are empty
// This is solely to support custom edit views which get server-rendered

export function EditForm({
  resetUploadEdits,
  submitted,
  updateUploadEdits,
  uploadEdits,
}: EditFormProps) {
  const {
    action,
    collectionSlug: docSlug,
    docPermissions,
    getDocPreferences,
    hasSavePermission,
    initialState,
    isInitializing,
    Upload: CustomUpload,
  } = useDocumentInfo()

  const { drawerSlug, onSave: onSaveFromContext } = useDocumentDrawerContext()

  const { getFormState } = useServerFunctions()

  const {
    config: { folders },
    getEntityConfig,
  } = useConfig()

  const abortOnChangeRef = React.useRef<AbortController>(null)

  const collectionConfig = getEntityConfig({ collectionSlug: docSlug })
  const { reportUpdate } = useDocumentEvents()

  const collectionSlug = collectionConfig.slug

  const [schemaPath] = React.useState(collectionSlug)

  const onSave = useCallback(
    (json) => {
      reportUpdate({
        doc: json?.doc || json?.result,
        drawerSlug,
        entitySlug: collectionSlug,
        operation: 'create',
        updatedAt: json?.result?.updatedAt || new Date().toISOString(),
      })

      if (typeof onSaveFromContext === 'function') {
        void onSaveFromContext({
          ...json,
          operation: 'create',
        })
      }
      resetUploadEdits()
    },
    [collectionSlug, onSaveFromContext, reportUpdate, resetUploadEdits, drawerSlug],
  )

  const onChange: NonNullable<FormProps['onChange']>[0] = useCallback(
    async ({ formState: prevFormState, submitted }) => {
      const controller = handleAbortRef(abortOnChangeRef)

      const docPreferences = await getDocPreferences()

      const { state: newFormState } = await getFormState({
        collectionSlug,
        docPermissions,
        docPreferences,
        formState: prevFormState,
        operation: 'create',
        schemaPath,
        signal: controller.signal,
        skipValidation: !submitted,
      })

      abortOnChangeRef.current = null

      return newFormState
    },
    [collectionSlug, schemaPath, getDocPreferences, getFormState, docPermissions],
  )

  useEffect(() => {
    const abortOnChange = abortOnChangeRef.current

    return () => {
      abortAndIgnore(abortOnChange)
    }
  }, [])


  return (
    <OperationProvider operation="create">
      <Form
        action={action}
        className={`${baseClass}__form`}
        disabled={isInitializing || !hasSavePermission}
        initialState={isInitializing ? undefined : initialState}
        isInitializing={isInitializing}
        method="POST"
        onChange={[onChange]}
        onSuccess={onSave}
        submitted={submitted}
      >
        <DocumentFields
          BeforeFields={
            <React.Fragment>
              {CustomUpload || (
                <Upload_v4
                  collectionSlug={collectionConfig.slug}
                  customActions={[
                    folders && collectionConfig.folders && (
                      <MoveDocToFolder
                        buttonProps={{
                          buttonStyle: 'pill',
                          size: 'small',
                        }}
                        folderCollectionSlug={folders.slug}
                        folderFieldName={folders.fieldName}
                        key="move-doc-to-folder"
                      />
                    ),
                  ].filter(Boolean)}
                  initialState={initialState}
                  resetUploadEdits={resetUploadEdits}
                  updateUploadEdits={updateUploadEdits}
                  uploadConfig={collectionConfig.upload}
                  uploadEdits={uploadEdits}
                />
              )}
            </React.Fragment>
          }
          docPermissions={docPermissions}
          fields={collectionConfig.fields}
          schemaPathSegments={[collectionConfig.slug]}
        />
        <ReportAllErrors />
        <GetFieldProxy />
      </Form>
    </OperationProvider>
  )
}

function GetFieldProxy() {
  const { dispatchFields, getField, getFields, setModified } = useForm()
  const { getFormDataRef } = useFormsManager()
  const { initialState, isInitializing } = useDocumentInfo()

  useEffect(() => {
    // eslint-disable-next-line react-compiler/react-compiler -- TODO: fix
    getFormDataRef.current = getFields
  }, [getFields, getField, getFormDataRef])

  // Use a ref to track if we've already triggered to avoid double-triggering in StrictMode
  const hasTriggeredRef = React.useRef(false)
  
  // Trigger initial validation when form mounts with a file
  // This ensures server-side conditions can see the file immediately
  useEffect(() => {
    if (initialState?.file && !isInitializing) {
      // Use requestAnimationFrame to ensure Form's initial effects (like locale) complete first
      const frameId = requestAnimationFrame(() => {
        // Check the ref inside the callback to survive StrictMode cleanup
        if (!hasTriggeredRef.current) {
          hasTriggeredRef.current = true
          
          // Dispatch an UPDATE for the file field with all properties
          // This will both set modified=true AND change the formState, triggering onChange
          dispatchFields({
            type: 'UPDATE',
            path: 'file',
            value: initialState.file.value,
            initialValue: initialState.file.initialValue || initialState.file.value,
            valid: true,
          })
          
          // Also set modified directly to ensure it's true
          setModified(true)
        }
      })
      
      return () => cancelAnimationFrame(frameId)
    }
  }, []) // Only run once on mount

  return null
}

function ReportAllErrors() {
  const { docConfig } = useDocumentInfo()
  const { activeIndex, forms, setFormTotalErrorCount } = useFormsManager()
  const errorCountRef = React.useRef(0)

  const fileIsValid = useMemo(() => {
    const currentForm = forms[activeIndex]
    return currentForm?.formState?.file?.valid ?? true
  }, [activeIndex, forms])

  const reportFormErrorCount = React.useCallback(
    (fieldErrorCount: number) => {
      let newErrorCount = fieldErrorCount
      // If the file is invalid, count that as an error
      if (!fileIsValid) {
        newErrorCount += 1
      }
      if (newErrorCount === errorCountRef.current) {
        return
      }
      setFormTotalErrorCount({ errorCount: newErrorCount, index: activeIndex })
      errorCountRef.current = newErrorCount
    },
    [activeIndex, setFormTotalErrorCount, fileIsValid],
  )

  if (!docConfig) {
    return null
  }

  return (
    <WatchChildErrors fields={docConfig.fields} path={[]} setErrorCount={reportFormErrorCount} />
  )
}
