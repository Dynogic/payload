import type {
  BuildFormStateArgs,
  ClientFieldSchemaMap,
  Data,
  DocumentPreferences,
  Field,
  FieldSchemaMap,
  FormState,
  FormStateWithoutComponents,
  PayloadRequest,
  SanitizedFieldsPermissions,
  SelectMode,
  SelectType,
} from 'payload'

import type { RenderFieldMethod } from './types.js'

import { calculateDefaultValues } from './calculateDefaultValues/index.js'
import { iterateFields } from './iterateFields.js'

type Args = {
  /**
   * The client field schema map is required for field rendering.
   * If fields should not be rendered (=> `renderFieldFn` is not provided),
   * then the client field schema map is not required.
   */
  clientFieldSchemaMap?: ClientFieldSchemaMap
  collectionSlug?: string
  data?: Data
  defaultValues?: Record<string, any>
  /**
   * If this is undefined, the `data` passed to this function will serve as `fullData` and `data` when iterating over
   * the top-level-fields to generate form state.
   * For sub fields, the `data` will be narrowed down to the sub fields, while `fullData` remains the same.
   *
   * Usually, the `data` passed to this function will be the document data. This means that running validation, read access control
   * or executing filterOptions here will have access to the full document through the passed `fullData` parameter, and that `fullData` and `data` will be identical.
   *
   * In some cases however, this function is used to generate form state solely for sub fields - independent from the parent form state.
   * This means that `data` will be the form state of the sub fields - the document data won't be available here.
   *
   * In these cases, you can pass `documentData` which will be used as `fullData` instead of `data`.
   *
   * This is useful for lexical blocks, as lexical block fields there are not part of the parent form state, yet we still want
   * document data to be available for validation and filterOptions, under the `data` key.
   */
  documentData?: Data
  fields: Field[] | undefined
  /**
   * The field schema map is required for field rendering.
   * If fields should not be rendered (=> `renderFieldFn` is not provided),
   * then the field schema map is not required.
   */
  fieldSchemaMap: FieldSchemaMap | undefined
  id?: number | string
  /**
   * Validation, filterOptions and read access control will receive the `blockData`, which is the data of the nearest parent block. You can pass in
   * the initial block data here, which will be used as `blockData` for the top-level fields, until the first block is encountered.
   */
  initialBlockData?: Data
  mockRSCs?: BuildFormStateArgs['mockRSCs']
  operation?: 'create' | 'update'
  permissions: SanitizedFieldsPermissions
  preferences: DocumentPreferences
  /**
   * Optionally accept the previous form state,
   * to be able to determine if custom fields need to be re-rendered.
   */
  previousFormState?: FormState
  readOnly?: boolean
  /**
   * If renderAllFields is true, then no matter what is in previous form state,
   * all custom fields will be re-rendered.
   */
  renderAllFields: boolean
  renderFieldFn?: RenderFieldMethod
  req: PayloadRequest
  schemaPath: string
  select?: SelectType
  selectMode?: SelectMode
  skipValidation?: boolean
}

export const fieldSchemasToFormState = async ({
  id,
  clientFieldSchemaMap,
  collectionSlug,
  data = {},
  defaultValues,
  documentData,
  fields,
  fieldSchemaMap,
  initialBlockData,
  mockRSCs,
  operation,
  permissions,
  preferences,
  previousFormState,
  readOnly,
  renderAllFields,
  renderFieldFn,
  req,
  schemaPath,
  select,
  selectMode,
  skipValidation,
}: Args): Promise<FormState> => {
  if (!clientFieldSchemaMap && renderFieldFn) {
    // eslint-disable-next-line no-console
    console.warn(
      'clientFieldSchemaMap is not passed to fieldSchemasToFormState - this will reduce performance',
    )
  }

  if (fields && fields.length) {
    const state: FormStateWithoutComponents = {}

    const dataWithDefaultValues = { ...data }

    await calculateDefaultValues({
      id,
      data: dataWithDefaultValues,
      fields,
      locale: req.locale,
      req,
      select,
      selectMode,
      siblingData: dataWithDefaultValues,
      user: req.user,
    })

    // Apply query param defaults for create operation
    if (operation === 'create' && defaultValues && fields) {
      // Build a map of allowed query params to field paths (supports nested fields)
      const urlParamToFieldPath: Record<string, string> = {}

      const collectUrlParams = (fieldsToProcess: Field[], parentPath: string = ''): void => {
        for (const field of fieldsToProcess) {
          // Handle fields with urlParam config
          if ('name' in field && 'admin' in field && field.admin) {
            const adminConfig = field.admin as { urlParam?: boolean | string }
            if (adminConfig.urlParam) {
              const paramName =
                typeof adminConfig.urlParam === 'string' ? adminConfig.urlParam : field.name
              const fieldPath = parentPath ? `${parentPath}.${field.name}` : field.name
              urlParamToFieldPath[paramName] = fieldPath
            }
          }

          // Recursively process nested fields
          if (field.type === 'group' || field.type === 'array') {
            const newPath =
              'name' in field
                ? parentPath
                  ? `${parentPath}.${field.name}`
                  : field.name
                : parentPath
            collectUrlParams(field.fields, newPath)
          } else if (field.type === 'tabs') {
            for (const tab of field.tabs) {
              // Named tabs add to the path, unnamed tabs don't
              const tabPath =
                'name' in tab ? (parentPath ? `${parentPath}.${tab.name}` : tab.name) : parentPath
              collectUrlParams(tab.fields, tabPath)
            }
          } else if (field.type === 'row' || field.type === 'collapsible') {
            collectUrlParams(field.fields, parentPath)
          }
        }
      }

      collectUrlParams(fields)

      // Apply defaults only for fields that have urlParam enabled
      Object.entries(defaultValues).forEach(([paramName, value]) => {
        const fieldPath = urlParamToFieldPath[paramName]
        if (fieldPath) {
          // Handle nested paths by setting values at the correct depth
          const pathSegments = fieldPath.split('.')
          let current = dataWithDefaultValues

          for (let i = 0; i < pathSegments.length - 1; i++) {
            const segment = pathSegments[i]
            if (current[segment] === undefined || current[segment] === null) {
              current[segment] = {}
            }
            current = current[segment]
          }

          const lastSegment = pathSegments[pathSegments.length - 1]
          if (current[lastSegment] === undefined || current[lastSegment] === null) {
            current[lastSegment] = value
          }
        }
      })
    }

    let fullData = dataWithDefaultValues

    if (documentData) {
      // By the time this function is used to get form state for nested forms, their default values should have already been calculated
      // => no need to run calculateDefaultValues here
      fullData = documentData
    }

    await iterateFields({
      id,
      addErrorPathToParent: null,
      blockData: initialBlockData,
      clientFieldSchemaMap,
      collectionSlug,
      data: dataWithDefaultValues,
      fields,
      fieldSchemaMap,
      fullData,
      mockRSCs,
      operation,
      parentIndexPath: '',
      parentPassesCondition: true,
      parentPath: '',
      parentSchemaPath: schemaPath,
      permissions,
      preferences,
      previousFormState,
      readOnly,
      renderAllFields,
      renderFieldFn,
      req,
      select,
      selectMode,
      skipValidation,
      state,
    })

    return state
  }

  return {}
}

export { iterateFields }
