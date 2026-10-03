'use client'
import { dequal } from 'dequal/lite' // lite: no need for Map and Set support
import { useRouter } from 'next/navigation.js'
import { serialize } from 'object-to-formdata'
import { type FormState, type PayloadRequest } from 'payload'
import {
  deepCopyObjectSimpleWithoutReactComponents,
  getDataByPath as getDataByPathFunc,
  getSiblingData as getSiblingDataFunc,
  hasDraftValidationEnabled,
  reduceFieldsToValues,
  uploadRequiresServerValidation,
  wait,
} from 'payload/shared'
import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { toast } from 'sonner'

import type {
  CreateFormData,
  Context as FormContextType,
  FormProps,
  GetDataByPath,
  Submit,
  SubmitOptions,
} from './types.js'

import { FieldErrorsToast, OffScreenErrorsToast } from '../../elements/Toasts/fieldErrors.js'
import { useDebouncedEffect } from '../../hooks/useDebouncedEffect.js'
import { useEffectEvent } from '../../hooks/useEffectEvent.js'
import { useQueue } from '../../hooks/useQueue.js'
import { useThrottledEffect } from '../../hooks/useThrottledEffect.js'
import { useAuth } from '../../providers/Auth/index.js'
import { useConfig } from '../../providers/Config/index.js'
import { useDocumentInfo } from '../../providers/DocumentInfo/index.js'
import { useLocale } from '../../providers/Locale/index.js'
import { useOperation } from '../../providers/Operation/index.js'
import { useRouteTransition } from '../../providers/RouteTransition/index.js'
import { useServerFunctions } from '../../providers/ServerFunctions/index.js'
import { useTranslation } from '../../providers/Translation/index.js'
import { useUploadHandlers } from '../../providers/UploadHandlers/index.js'
import { abortAndIgnore, handleAbortRef } from '../../utilities/abortAndIgnore.js'
import { requests } from '../../utilities/api.js'
import { FieldClaimProvider, useFieldClaimRegistry } from '../useClaimFieldPath/index.js'
import {
  BackgroundProcessingContext,
  DocumentFormContext,
  FormContext,
  FormFieldsContext,
  FormWatchContext,
  InitializingContext,
  ModifiedContext,
  ProcessingContext,
  SubmittedContext,
  useDocumentForm,
} from './context.js'
import { errorMessages } from './errorMessages.js'
import { fieldReducer } from './fieldReducer.js'
import { initContextState } from './initContextState.js'
import { serverErrorToast } from './offScreenFieldErrors.js'
import { hasStandingServerErrors } from './standingServerErrors.js'
import { responseSubmitFailureMessage, thrownSubmitFailureMessage } from './submitFailureMessage.js'

const baseClass = 'form'

export const Form: React.FC<FormProps> = (props) => {
  const { id, collectionSlug, docConfig, docPermissions, getDocPreferences, globalSlug } =
    useDocumentInfo()

  const validateDrafts = hasDraftValidationEnabled(docConfig)

  const {
    action,
    beforeSubmit,
    children,
    className,
    disabled: disabledFromProps,
    disableSuccessStatus,
    disableValidationOnSubmit,
    // fields: fieldsFromProps = collection?.fields || global?.fields,
    el,
    handleResponse,
    initialState, // fully formed initial field state
    isDocumentForm,
    isInitializing: initializingFromProps,
    onChange,
    onSubmit,
    onSuccess,
    redirect,
    submitted: submittedFromProps,
    uuid,
    waitForAutocomplete,
  } = props

  const method = 'method' in props ? props?.method : undefined

  const router = useRouter()

  const documentForm = useDocumentForm()

  const { code: locale } = useLocale()
  const { i18n, t } = useTranslation()
  const { refreshCookie, user } = useAuth()
  const operation = useOperation()
  const { queueTask } = useQueue()

  const { getFormState } = useServerFunctions()
  const { startRouteTransition } = useRouteTransition()
  const { getUploadHandler } = useUploadHandlers()

  const { config } = useConfig()

  const [disabled, setDisabled] = useState(disabledFromProps || false)
  const [isMounted, setIsMounted] = useState(false)

  const [submitted, setSubmitted] = useState(false)

  /**
   * Tracks wether the form state passes validation.
   * For example the state could be submitted but invalid as field errors have been returned.
   */
  const [isValid, setIsValid] = useState(true)
  const [initializing, setInitializing] = useState(initializingFromProps)

  const [processing, setProcessing] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<null | number>(null)

  /**
   * Determines whether the form is processing asynchronously in the background, e.g. autosave is running.
   * Useful to determine whether to disable the form or queue other processes while in flight, e.g. disable manual submits while an autosave is running.
   */
  const [backgroundProcessing, _setBackgroundProcessing] = useState(false)

  /**
   * A ref that can be read within the `setModified` interceptor.
   * Dependents of this state can read it immediately without needing to wait for a render cycle.
   */
  const backgroundProcessingRef = useRef(backgroundProcessing)

  /**
   * Flag to track if the form was modified _during a submission_, e.g. while autosave is running.
   * Useful in order to avoid resetting `modified` to false wrongfully after a submit.
   * For example, if the user modifies a field while the a background process (autosave) is running,
   * we need to ensure that after the submit completes, the `modified` state remains true.
   */
  const modifiedWhileProcessingRef = useRef(false)

  /**
   * Intercept the `setBackgroundProcessing` method to keep the ref in sync.
   * See the `backgroundProcessingRef` for more details.
   */
  const setBackgroundProcessing = useCallback((backgroundProcessing: boolean) => {
    backgroundProcessingRef.current = backgroundProcessing
    _setBackgroundProcessing(backgroundProcessing)
  }, [])

  const [modified, _setModified] = useState(false)

  /**
   * Intercept the `setModified` method to track whether the event happened during background processing.
   * See the `modifiedWhileProcessingRef` ref for more details.
   */
  const setModified = useCallback((modified: boolean) => {
    if (backgroundProcessingRef.current) {
      modifiedWhileProcessingRef.current = true
    }

    _setModified(modified)
  }, [])

  const formRef = useRef<HTMLFormElement>(null)
  const contextRef = useRef({} as FormContextType)
  const uploadToastIdRef = useRef<number | string>(null)
  const abortResetFormRef = useRef<AbortController>(null)
  const isFirstRenderRef = useRef(true)

  const fieldsReducer = useReducer(fieldReducer, {}, () => initialState)

  // Fork #98: the paths mounted components claim (`useClaimFieldPath`) — a
  // hidden field is off screen unless claimed. `claimRegistry` is stable.
  const { claimedPaths, claimedSubtrees, registry: claimRegistry } = useFieldClaimRegistry()

  const [formState, dispatchFields] = fieldsReducer

  contextRef.current.fields = formState

  const prevFormState = useRef(formState)

  const validateForm = useCallback(async () => {
    const validatedFieldState = {}
    let isValid = true

    const data = contextRef.current.getData()

    const validationPromises = Object.entries(contextRef.current.fields).map(
      async ([path, field]) => {
        const validatedField = field
        const pathSegments = path ? path.split('.') : []

        if (field.passesCondition !== false) {
          let validationResult: boolean | string = validatedField.valid

          if ('validate' in field && typeof field.validate === 'function') {
            let valueToValidate = field.value

            if (field?.rows && Array.isArray(field.rows)) {
              valueToValidate = contextRef.current.getDataByPath(path)
            }

            validationResult = await field.validate(valueToValidate, {
              ...field,
              id,
              collectionSlug,
              // If there is a parent document form, we can get the data from that form
              blockData: undefined, // Will be expensive to get - not worth to pass to client-side validation, as this can be obtained by the user using `useFormFields()`
              data: documentForm?.getData ? documentForm.getData() : data,
              event: 'submit',
              operation,
              path: pathSegments,
              preferences: {} as any,
              req: {
                payload: {
                  config,
                },
                t,
                user,
              } as unknown as PayloadRequest,
              siblingData: contextRef.current.getSiblingData(path),
            })

            if (typeof validationResult === 'string') {
              validatedField.errorMessage = validationResult
              validatedField.valid = false
            } else {
              validatedField.valid = true
              validatedField.errorMessage = undefined
            }
          }

          if (validatedField.valid === false) {
            isValid = false
          }
        }

        validatedFieldState[path] = validatedField
      },
    )

    await Promise.all(validationPromises)

    if (!dequal(contextRef.current.fields, validatedFieldState)) {
      dispatchFields({ type: 'REPLACE_STATE', state: validatedFieldState })
    }

    setIsValid(isValid)

    return isValid
  }, [collectionSlug, config, dispatchFields, id, operation, t, user, documentForm])

  const submit = useCallback<Submit>(
    async (options, e) => {
      const {
        acceptValues = true,
        action: actionArg = action,
        context,
        disableFormWhileProcessing = true,
        disableSuccessStatus: disableSuccessStatusFromArgs,
        method: methodToUse = method,
        overrides: overridesFromArgs = {},
        skipValidation,
      } = options || ({} as SubmitOptions)

      const disableToast = disableSuccessStatusFromArgs ?? disableSuccessStatus

      if (disabled) {
        if (e) {
          e.preventDefault()
        }
        return
      }

      // create new toast promise which will resolve manually later
      let errorToast, successToast
      let toastId: number | string = null

      const promise = new Promise((resolve, reject) => {
        successToast = resolve
        errorToast = reject
      })

      const hasFormSubmitAction =
        actionArg || typeof action === 'string' || typeof action === 'function'

      const isUploadForm = docConfig && 'upload' in docConfig && docConfig.upload

      if (isUploadForm) {
        // Upload forms always show a progress toast (even on create where disableToast is true),
        // because the client-side upload can take a while and the user needs feedback.
        successToast = (data) => toast.success(data)
        errorToast = (data) => toast.error(data)
        toastId = toast.loading(t('general:submitting'))
        uploadToastIdRef.current = toastId
      } else if (redirect || disableToast || !hasFormSubmitAction) {
        // Do not show submitting toast, as the promise toast may never disappear under these conditions.
        // Instead, make successToast() or errorToast() throw toast.success / toast.error
        successToast = (data) => toast.success(data)
        errorToast = (data) => toast.error(data)
      } else {
        toast.promise(promise, {
          error: (data) => {
            return data as string
          },
          loading: t('general:submitting'),
          success: (data) => {
            return data as string
          },
        })
      }

      if (e) {
        e.stopPropagation()
        e.preventDefault()
      }

      if (disableFormWhileProcessing) {
        setProcessing(true)
        setDisabled(true)
      }

      if (waitForAutocomplete) {
        await wait(100)
      }

      const data = reduceFieldsToValues(contextRef.current.fields, true)

      const serializableFormState = deepCopyObjectSimpleWithoutReactComponents(
        contextRef.current.fields,
        {
          excludeFiles: true,
        },
      )

      // Execute server side validations
      if (Array.isArray(beforeSubmit)) {
        let revalidatedFormState: FormState

        await beforeSubmit.reduce(async (priorOnChange, beforeSubmitFn) => {
          await priorOnChange

          const result = await beforeSubmitFn({
            formState: serializableFormState,
          })

          revalidatedFormState = result
        }, Promise.resolve())

        const isValid = Object.entries(revalidatedFormState).every(
          ([, field]) => field.valid !== false,
        )

        setIsValid(isValid)

        if (!isValid) {
          setProcessing(false)
          setSubmitted(true)
          setDisabled(false)
          setUploadProgress(null)
          if (toastId) {
            toast.dismiss(toastId)
            uploadToastIdRef.current = null
          }
          return dispatchFields({ type: 'REPLACE_STATE', state: revalidatedFormState })
        }
      }

      const isValid =
        skipValidation || disableValidationOnSubmit ? true : await contextRef.current.validateForm()

      setIsValid(isValid)

      // If not valid, prevent submission
      if (!isValid) {
        if (toastId) {
          toast.dismiss(toastId)
          uploadToastIdRef.current = null
        }
        errorToast(t('error:correctInvalidFields'))
        setProcessing(false)
        setSubmitted(true)
        setDisabled(false)
        setUploadProgress(null)
        return
      }

      let overrides = {}

      if (typeof overridesFromArgs === 'function') {
        overrides = overridesFromArgs(contextRef.current.fields)
      } else if (typeof overridesFromArgs === 'object') {
        overrides = overridesFromArgs
      }

      // If submit handler comes through via props, run that
      if (onSubmit) {
        for (const [key, value] of Object.entries(overrides)) {
          data[key] = value
        }

        onSubmit(contextRef.current.fields, data)
      }

      if (!hasFormSubmitAction) {
        // No action provided, so we should return. An example where this happens are lexical link drawers. Upon submitting the drawer, we
        // want to close it without submitting the form. Stuff like validation would be handled by lexical before this, through beforeSubmit
        setProcessing(false)
        setSubmitted(true)
        setDisabled(false)
        setUploadProgress(null)
        if (toastId) {
          toast.dismiss(toastId)
          uploadToastIdRef.current = null
        }
        return
      }

      // Fork #94: whether the server answered before a throw — a throw after
      // a response is not the network's fault.
      let responseReceived = false

      // Fork #120: whether the server validates this submit. A draft it does
      // not validate cannot answer a standing server error, so its answer
      // keeps them; a validated submit's answer (an acceptance, or a new set
      // of field errors) replaces them.
      const serverValidates = !(
        (overrides as Record<string, unknown>)?.['_status'] === 'draft' && !validateDrafts
      )

      try {
        const formData = await contextRef.current.createFormData(overrides, {
          data,
          mergeOverrideData: Boolean(typeof overridesFromArgs !== 'function'),
        })

        let res

        if (typeof actionArg === 'string') {
          res = await requests[methodToUse.toLowerCase()](actionArg, {
            body: formData,
            headers: {
              'Accept-Language': i18n.language,
            },
          })
        } else if (typeof action === 'function') {
          res = await action(formData)
        }

        responseReceived = Boolean(res)

        if (!modifiedWhileProcessingRef.current) {
          setModified(false)
        } else {
          modifiedWhileProcessingRef.current = false
        }

        setDisabled(false)

        if (typeof handleResponse === 'function') {
          handleResponse(res, successToast, errorToast)
          return
        }

        const contentType = res.headers.get('content-type')
        const isJSON = contentType && contentType.indexOf('application/json') !== -1

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let json: Record<string, any> = {}

        if (isJSON) {
          json = await res.json()
        }

        if (res.status < 400) {
          if (serverValidates) {
            dispatchFields({ type: 'CLEAR_SERVER_ERRORS' })
          }

          if (typeof onSuccess === 'function') {
            const newFormState = await onSuccess(json, {
              context,
              formState: serializableFormState,
            })

            if (newFormState) {
              dispatchFields({
                type: 'MERGE_SERVER_STATE',
                acceptValues,
                prevStateRef: prevFormState,
                serverState: newFormState,
              })
            }
          }

          // Fork #120: an error still standing stays visible.
          setSubmitted(!serverValidates && hasStandingServerErrors(contextRef.current.fields))
          setProcessing(false)
          setUploadProgress(null)
          if (toastId) {
            toast.dismiss(toastId)
            uploadToastIdRef.current = null
          }

          if (redirect) {
            startRouteTransition(() => router.push(redirect))
          } else if (!disableToast) {
            successToast(json.message || t('general:submissionSuccessful'))
          }
        } else {
          setProcessing(false)
          setSubmitted(true)
          setUploadProgress(null)
          if (toastId) {
            toast.dismiss(toastId)
            uploadToastIdRef.current = null
          }

          // When there was an error submitting a draft,
          // set the form state to unsubmitted, to not trigger visible form validation on changes after the failed submit.
          // Also keep the form as modified so the save button remains enabled for retry.
          if (overridesFromArgs['_status'] === 'draft') {
            setModified(true)

            if (!validateDrafts) {
              // Fork #120: an error still standing stays visible.
              setSubmitted(hasStandingServerErrors(contextRef.current.fields))
            }
          }

          contextRef.current = { ...contextRef.current } // triggers rerender of all components that subscribe to form

          // Fork #94: a 5xx never paints its own (raw, English) sentence.
          if (json.message) {
            errorToast(
              responseSubmitFailureMessage({ message: json.message, status: res.status, t }),
            )
            return
          }

          if (Array.isArray(json.errors)) {
            const [fieldErrors, nonFieldErrors] = json.errors.reduce(
              ([fieldErrs, nonFieldErrs], err) => {
                const newFieldErrs = []
                const newNonFieldErrs = []

                if (err?.message) {
                  newNonFieldErrs.push(err)
                }

                if (Array.isArray(err?.data?.errors)) {
                  err.data?.errors.forEach((dataError) => {
                    if (dataError?.path) {
                      newFieldErrs.push(dataError)
                    } else {
                      newNonFieldErrs.push(dataError)
                    }
                  })
                }

                return [
                  [...fieldErrs, ...newFieldErrs],
                  [...nonFieldErrs, ...newNonFieldErrs],
                ]
              },
              [[], []],
            )

            setIsValid(false)

            // Fork #97: the field states BEFORE the server errors land —
            // ADD_SERVER_ERRORS creates a state for every path, on screen or
            // not.
            const fieldsBeforeServerErrors = contextRef.current.fields

            // Fork #120: a validated refusal is the server's whole answer; it
            // replaces the errors that stood before it.
            if (serverValidates && fieldErrors.length > 0) {
              dispatchFields({ type: 'CLEAR_SERVER_ERRORS' })
            }

            dispatchFields({
              type: 'ADD_SERVER_ERRORS',
              errors: fieldErrors,
            })

            // Fork #94: a 5xx says "Couldn't save" ONCE instead of each raw
            // server sentence; a 4xx (validation included) is unchanged.
            if (res.status >= 500) {
              if (nonFieldErrors.length > 0) {
                errorToast(responseSubmitFailureMessage({ status: res.status, t }))
              }
            } else {
              nonFieldErrors.forEach((err) => {
                // Fork #97: a path with no field on screen toasts its own
                // message, not "The following field is invalid: <raw path>".
                // Fork #98: a hidden field is off screen unless a mounted
                // component claims it.
                // Fork #99: every path on screen → the fields frame
                // themselves, so the toast is "Please correct invalid
                // fields." (as client-side validation), not the stock
                // sentence repeating them (or naming an unlabelled path raw).
                const decision = serverErrorToast({
                  claimedPaths: claimRegistry.getClaimedPaths(),
                  // Fork #100: a subtree claim covers every path under it.
                  claimedSubtrees: claimRegistry.getClaimedSubtrees(),
                  errors: err?.data?.errors,
                  fields: fieldsBeforeServerErrors,
                })

                if (decision.kind === 'offScreen') {
                  errorToast(<OffScreenErrorsToast messages={decision.messages} />)
                  return
                }

                if (decision.kind === 'correctInvalidFields') {
                  errorToast(t('error:correctInvalidFields'))
                  return
                }

                errorToast(<FieldErrorsToast errorMessage={err.message || t('error:unknown')} />)
              })
            }

            return
          }

          // Fork #94: no body sentence → "Couldn't save", never `statusText`.
          const message =
            errorMessages?.[res.status] || responseSubmitFailureMessage({ status: res.status, t })

          errorToast(message)
        }

        return { formState: contextRef.current.fields, res }
      } catch (err) {
        console.error('Error submitting form', err) // eslint-disable-line no-console
        setProcessing(false)
        setSubmitted(true)
        setDisabled(false)
        setUploadProgress(null)
        if (toastId) {
          toast.dismiss(toastId)
          uploadToastIdRef.current = null
        }
        // Fork #94: never the raw `err.message` ("Failed to fetch").
        errorToast(thrownSubmitFailureMessage({ err, responseReceived, t }))
      }
    },
    [
      beforeSubmit,
      startRouteTransition,
      action,
      claimRegistry,
      disableSuccessStatus,
      disableValidationOnSubmit,
      disabled,
      dispatchFields,
      handleResponse,
      method,
      onSubmit,
      onSuccess,
      redirect,
      router,
      t,
      i18n,
      validateDrafts,
      waitForAutocomplete,
      setModified,
      setSubmitted,
    ],
  )

  const getFields = useCallback(() => contextRef.current.fields, [])

  const getField = useCallback((path: string) => contextRef.current.fields[path], [])

  const getData = useCallback(() => reduceFieldsToValues(contextRef.current.fields, true), [])

  const getSiblingData = useCallback(
    (path: string) => getSiblingDataFunc(contextRef.current.fields, path),
    [],
  )

  const getDataByPath = useCallback<GetDataByPath>(
    (path: string) => getDataByPathFunc(contextRef.current.fields, path),
    [],
  )

  const createFormData = useCallback<CreateFormData>(
    async (overrides, { data: dataFromArgs, mergeOverrideData = true }) => {
      let data = dataFromArgs || reduceFieldsToValues(contextRef.current.fields, true)

      let file = data?.file

      if (docConfig && 'upload' in docConfig && docConfig.upload && file) {
        delete data.file

        const handler = getUploadHandler({ collectionSlug })

        if (
          typeof handler === 'function' &&
          !uploadRequiresServerValidation({
            allowRestrictedFileTypes: docConfig.upload.allowRestrictedFileTypes,
            filename: file.name,
            mimeType: file.type,
          })
        ) {
          let filename = file.name
          setUploadProgress(0)
          const clientUploadContext = await handler({
            docPrefix: typeof data?.prefix === 'string' ? data.prefix : undefined,
            file,
            formData: data,
            onProgress: (progress) => {
              setUploadProgress(progress)
              // Update toast if we have one
              if (uploadToastIdRef.current) {
                toast.loading(t('general:uploading', { progress: Math.round(progress * 100) }), {
                  id: uploadToastIdRef.current,
                })
              }
            },
            updateFilename: (value) => {
              filename = value
            },
          })

          file = JSON.stringify({
            clientUploadContext,
            collectionSlug,
            filename,
            mimeType: file.type,
            size: file.size,
          })
        }
      }

      if (mergeOverrideData) {
        data = {
          ...data,
          ...overrides,
        }
      } else {
        data = overrides
      }

      const dataToSerialize: Record<string, unknown> = {
        _payload: JSON.stringify(data),
      }

      if (docConfig && 'upload' in docConfig && docConfig.upload && file) {
        dataToSerialize.file = file
      }

      // nullAsUndefineds is important to allow uploads and relationship fields to clear themselves
      const formData = serialize(dataToSerialize, {
        indices: true,
        nullsAsUndefineds: false,
      })

      return formData
    },
    [collectionSlug, docConfig, getUploadHandler],
  )

  const reset = useCallback(
    async (data: unknown) => {
      const controller = handleAbortRef(abortResetFormRef)

      const docPreferences = await getDocPreferences()

      const { state: newState } = await getFormState({
        id,
        collectionSlug,
        data,
        docPermissions,
        docPreferences,
        globalSlug,
        locale,
        operation,
        renderAllFields: true,
        schemaPath: collectionSlug ? collectionSlug : globalSlug,
        signal: controller.signal,
        skipValidation: true,
      })

      // Fork #109: an ABORTED reset (a second `reset` aborts the first's
      // getFormState through `abortResetFormRef`) or a FAILED one resolves
      // `{ state: null }` (ServerFunctions' getFormState). Replacing the form
      // with that crashed the fieldReducer's REPLACE_STATE
      // (`Object.entries(null)`) and took the document view down; the form
      // is left untouched instead; the newer reset, if any, applies its own.
      if (!newState) {
        if (abortResetFormRef.current === controller) {
          abortResetFormRef.current = null
        }
        return
      }

      contextRef.current = { ...initContextState } as FormContextType
      setModified(false)
      dispatchFields({ type: 'REPLACE_STATE', state: newState })

      abortResetFormRef.current = null
    },
    [
      collectionSlug,
      dispatchFields,
      globalSlug,
      id,
      operation,
      getFormState,
      docPermissions,
      getDocPreferences,
      locale,
      setModified,
    ],
  )

  const replaceState = useCallback(
    (state: FormState) => {
      contextRef.current = { ...initContextState } as FormContextType
      setModified(false)
      dispatchFields({ type: 'REPLACE_STATE', state })
    },
    [dispatchFields, setModified],
  )

  const addFieldRow: FormContextType['addFieldRow'] = useCallback(
    ({ blockType, path, rowIndex: rowIndexArg, subFieldState }) => {
      const newRows: unknown[] = getDataByPath(path) || []
      const rowIndex = rowIndexArg === undefined ? newRows.length : rowIndexArg

      // dispatch ADD_ROW adds a blank row to local form state.
      // This performs no form state request, as the debounced onChange effect will do that for us.
      dispatchFields({
        type: 'ADD_ROW',
        blockType,
        path,
        rowIndex,
        subFieldState,
      })

      setModified(true)
    },
    [dispatchFields, getDataByPath, setModified],
  )

  const moveFieldRow: FormContextType['moveFieldRow'] = useCallback(
    ({ moveFromIndex, moveToIndex, path }) => {
      dispatchFields({
        type: 'MOVE_ROW',
        moveFromIndex,
        moveToIndex,
        path,
      })

      setModified(true)
    },
    [dispatchFields, setModified],
  )

  const removeFieldRow: FormContextType['removeFieldRow'] = useCallback(
    ({ path, rowIndex }) => {
      dispatchFields({ type: 'REMOVE_ROW', path, rowIndex })

      setModified(true)
    },
    [dispatchFields, setModified],
  )

  const replaceFieldRow: FormContextType['replaceFieldRow'] = useCallback(
    ({ blockType, path, rowIndex: rowIndexArg, subFieldState }) => {
      const currentRows: unknown[] = getDataByPath(path)
      const rowIndex = rowIndexArg === undefined ? currentRows.length : rowIndexArg

      dispatchFields({
        type: 'REPLACE_ROW',
        blockType,
        path,
        rowIndex,
        subFieldState,
      })

      setModified(true)
    },
    [dispatchFields, getDataByPath, setModified],
  )

  useEffect(() => {
    const abortOnChange = abortResetFormRef.current

    return () => {
      abortAndIgnore(abortOnChange)
    }
  }, [])

  useEffect(() => {
    if (initializingFromProps !== undefined) {
      setInitializing(initializingFromProps)
    }
  }, [initializingFromProps])

  contextRef.current.submit = submit
  contextRef.current.getFields = getFields
  contextRef.current.getField = getField
  contextRef.current.getData = getData
  contextRef.current.getSiblingData = getSiblingData
  contextRef.current.getDataByPath = getDataByPath
  contextRef.current.validateForm = validateForm
  contextRef.current.createFormData = createFormData
  contextRef.current.setModified = setModified
  contextRef.current.setProcessing = setProcessing
  contextRef.current.setBackgroundProcessing = setBackgroundProcessing

  contextRef.current.setSubmitted = setSubmitted
  contextRef.current.setIsValid = setIsValid
  contextRef.current.disabled = disabled
  contextRef.current.setDisabled = setDisabled
  contextRef.current.formRef = formRef
  contextRef.current.reset = reset
  contextRef.current.replaceState = replaceState
  contextRef.current.dispatchFields = dispatchFields
  contextRef.current.addFieldRow = addFieldRow
  contextRef.current.removeFieldRow = removeFieldRow
  contextRef.current.moveFieldRow = moveFieldRow
  contextRef.current.replaceFieldRow = replaceFieldRow
  contextRef.current.uuid = uuid
  contextRef.current.initializing = initializing
  contextRef.current.isValid = isValid

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (typeof disabledFromProps === 'boolean') {
      setDisabled(disabledFromProps)
    }
  }, [disabledFromProps])

  useEffect(() => {
    if (typeof submittedFromProps === 'boolean') {
      setSubmitted(submittedFromProps)
    }
  }, [submittedFromProps])

  useEffect(() => {
    if (initialState) {
      contextRef.current = { ...initContextState } as FormContextType
      dispatchFields({
        type: 'REPLACE_STATE',
        optimize: false,
        sanitize: true,
        state: initialState,
      })
    }
  }, [initialState, dispatchFields])

  useThrottledEffect(
    () => {
      refreshCookie()
    },
    15000,
    [formState],
  )

  const handleLocaleChange = useEffectEvent(() => {
    contextRef.current = { ...contextRef.current } // triggers rerender of all components that subscribe to form
    setModified(false)
  })

  useEffect(() => {
    handleLocaleChange()
  }, [locale])

  const classes = [className, baseClass].filter(Boolean).join(' ')

  const executeOnChange = useEffectEvent((submitted: boolean) => {
    queueTask(async () => {
      if (Array.isArray(onChange)) {
        let serverState: FormState

        for (const onChangeFn of onChange) {
          // Edit view default onChange is in packages/ui/src/views/Edit/index.tsx. This onChange usually sends a form state request
          serverState = await onChangeFn({
            formState: deepCopyObjectSimpleWithoutReactComponents(formState, {
              excludeFiles: true,
            }),
            submitted,
          })
        }

        dispatchFields({
          type: 'MERGE_SERVER_STATE',
          prevStateRef: prevFormState,
          serverState,
        })
      }
    })
  })

  useDebouncedEffect(
    () => {
      if ((isFirstRenderRef.current || !dequal(formState, prevFormState.current)) && modified) {
        executeOnChange(submitted)
      }

      prevFormState.current = formState
      isFirstRenderRef.current = false
    },
    [modified, submitted, formState],
    250,
  )

  const DocumentFormContextComponent: React.FC<any> = isDocumentForm
    ? DocumentFormContext
    : React.Fragment

  const documentFormContextProps = isDocumentForm
    ? {
        value: contextRef.current,
      }
    : {}

  const El: 'form' = (el as unknown as 'form') || 'form'

  return (
    <El
      action={typeof action === 'function' ? void action : action}
      className={classes}
      /**
       * data-form-ready signals if the form is ready to be used. This is used by our e2e tests
       * to wait for the form to be ready before interacting with it, reducing flakiness if the test is run in
       * slow network conditions.
       */
      data-form-ready={!processing && isMounted && !initializing}
      method={method}
      noValidate
      onSubmit={(e) => void contextRef.current.submit({}, e)}
      ref={formRef}
    >
      <DocumentFormContextComponent {...documentFormContextProps}>
        <FormContext value={contextRef.current}>
          <FormWatchContext
            value={{
              fields: formState,
              ...contextRef.current,
            }}
          >
            <SubmittedContext value={submitted}>
              <InitializingContext value={!isMounted || (isMounted && initializing)}>
                <ProcessingContext value={processing}>
                  <BackgroundProcessingContext value={backgroundProcessing}>
                    <ModifiedContext value={modified}>
                      {/* eslint-disable-next-line @eslint-react/no-context-provider */}
                      <FormFieldsContext.Provider value={fieldsReducer}>
                        <FieldClaimProvider
                          claimedPaths={claimedPaths}
                          claimedSubtrees={claimedSubtrees}
                          registry={claimRegistry}
                        >
                          {children}
                        </FieldClaimProvider>
                      </FormFieldsContext.Provider>
                    </ModifiedContext>
                  </BackgroundProcessingContext>
                </ProcessingContext>
              </InitializingContext>
            </SubmittedContext>
          </FormWatchContext>
        </FormContext>
      </DocumentFormContextComponent>
    </El>
  )
}

export {
  DocumentFormContext,
  FormContext,
  FormFieldsContext,
  FormWatchContext,
  ModifiedContext,
  ProcessingContext,
  SubmittedContext,
  useAllFormFields,
  useDocumentForm,
  useForm,
  useFormFields,
  useFormModified,
  useFormProcessing,
  useFormSubmitted,
  useWatchForm,
} from './context.js'

export { FormProps }
