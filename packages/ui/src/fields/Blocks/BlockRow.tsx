'use client'
import type { ClientBlock, ClientField, Labels, Row, SanitizedFieldPermissions } from 'payload'

import { getTranslation } from '@payloadcms/translations'
import React from 'react'

import type { UseDraggableSortableReturn } from '../../elements/DraggableSortable/useDraggableSortable/types.js'
import type { RenderFieldsProps } from '../../forms/RenderFields/types.js'

import { Collapsible } from '../../elements/Collapsible/index.js'
import { ErrorPill } from '../../elements/ErrorPill/index.js'
import { Pill } from '../../elements/Pill/index.js'
import { ShimmerEffect } from '../../elements/ShimmerEffect/index.js'
import { CheckboxInput, inputBaseClass } from '../../fields/Checkbox/Input.js'
import { useFormSubmitted } from '../../forms/Form/context.js'
import { RenderFields } from '../../forms/RenderFields/index.js'
import { RowLabel } from '../../forms/RowLabel/index.js'
import { useThrottledValue } from '../../hooks/useThrottledValue.js'
import { ChevronIcon } from '../../icons/Chevron/index.js'
import { useTranslation } from '../../providers/Translation/index.js'
import { RowActions } from './RowActions.js'
import { SectionTitle } from './SectionTitle/index.js'
import { useBlocksSelection } from './SelectionContext.js'

const baseClass = 'blocks-field'

type BlocksFieldProps = {
  addRow: (rowIndex: number, blockType: string) => Promise<void> | void
  block: ClientBlock
  blocks: (ClientBlock | string)[] | ClientBlock[]
  copyRow: (rowIndex: number) => void
  duplicateRow: (rowIndex: number) => void
  errorCount: number
  fields: ClientField[]
  hasMaxRows?: boolean
  hideAddBelow?: boolean
  isLoading?: boolean
  isSortable?: boolean
  Label?: React.ReactNode
  labels: Labels
  moveRow: (fromIndex: number, toIndex: number) => void
  parentPath: string
  pasteRow: (rowIndex: number) => void
  path: string
  permissions: SanitizedFieldPermissions
  PillComponent?: React.ReactNode
  readOnly: boolean
  removeRow: (rowIndex: number) => void
  row: Row
  rowCount: number
  rowIndex: number
  schemaPath: string
  setCollapse: (id: string, collapsed: boolean) => void
} & UseDraggableSortableReturn

export const BlockRow: React.FC<BlocksFieldProps> = ({
  addRow,
  attributes,
  block,
  blocks,
  copyRow,
  duplicateRow,
  errorCount,
  fields,
  hasMaxRows,
  hideAddBelow,
  isLoading: isLoadingFromProps,
  isSortable,
  Label,
  labels,
  listeners,
  moveRow,
  parentPath,
  pasteRow,
  path,
  permissions,
  PillComponent,
  readOnly,
  removeRow,
  row,
  rowCount,
  rowIndex,
  schemaPath,
  setCollapse,
  setNodeRef,
  transform,
}) => {
  const isLoading = useThrottledValue(isLoadingFromProps, 500)

  const { i18n, t } = useTranslation()
  const hasSubmitted = useFormSubmitted()

  // Selection mode (fork #74): inactive default context = the row renders
  // exactly as before; active = checkbox in the drag handle's place,
  // actions/collapse suppressed, header click toggles selection.
  const selection = useBlocksSelection()
  const selecting = selection.active
  const isRowSelected = selecting && selection.isSelected(parentPath, row.id)

  const fieldHasErrors = hasSubmitted && errorCount > 0

  const showBlockName = !block.admin?.disableBlockName

  const classNames = [
    `${baseClass}__row`,
    fieldHasErrors ? `${baseClass}__row--has-errors` : `${baseClass}__row--no-errors`,
    selecting && `${baseClass}__row--selecting`,
    isRowSelected && `${baseClass}__row--selected`,
  ]
    .filter(Boolean)
    .join(' ')

  let blockPermissions: RenderFieldsProps['permissions'] = true

  if (permissions === true) {
    blockPermissions = true
  } else {
    const permissionsBlockSpecific = permissions?.blocks?.[block.slug] || permissions?.blocks
    if (permissionsBlockSpecific === true) {
      blockPermissions = true
    } else if (permissionsBlockSpecific?.fields) {
      blockPermissions = permissionsBlockSpecific.fields
    } else {
      // Check if we should fall back to read-only mode based on permission structure
      // This handles cases where field-level access control exists but block permissions were sanitized
      if (typeof permissions === 'object' && permissions && !permissionsBlockSpecific) {
        // If permissions object exists but has no block-specific permissions,
        // check if it has any restrictive characteristics
        const hasReadPermission = permissions.read === true
        const missingCreateOrUpdate = !permissions.create || !permissions.update
        const hasRestrictiveStructure =
          hasReadPermission &&
          (missingCreateOrUpdate ||
            (typeof permissions === 'object' &&
              Object.keys(permissions).length === 1 &&
              permissions.read))

        if (hasRestrictiveStructure) {
          blockPermissions = { read: true }
        } else {
          blockPermissions = permissionsBlockSpecific?.fields
        }
      } else {
        blockPermissions = permissionsBlockSpecific?.fields
      }
    }
  }

  return (
    <div
      id={`${parentPath?.split('.').join('-')}-row-${rowIndex}`}
      key={`${parentPath}-row-${rowIndex}`}
      ref={setNodeRef}
      style={{
        transform,
      }}
    >
      <Collapsible
        actions={
          !readOnly && !selecting ? (
            <RowActions
              addRow={addRow}
              blocks={blocks}
              blockType={row.blockType}
              copyRow={copyRow}
              duplicateRow={duplicateRow}
              fields={block.fields}
              hasMaxRows={hasMaxRows}
              hideAddBelow={hideAddBelow}
              isSortable={isSortable}
              labels={labels}
              moveRow={moveRow}
              pasteRow={pasteRow}
              removeRow={removeRow}
              rowCount={rowCount}
              rowIndex={rowIndex}
            />
          ) : undefined
        }
        className={classNames}
        collapsibleStyle={fieldHasErrors ? 'error' : 'default'}
        disableHeaderToggle={selecting}
        disableToggleIndicator={selecting}
        dragHandleProps={
          isSortable && !selecting
            ? {
                id: row.id,
                attributes,
                listeners,
              }
            : undefined
        }
        header={
          isLoading ? (
            <ShimmerEffect height="1rem" width="8rem" />
          ) : selecting ? (
            <div
              aria-pressed={isRowSelected}
              className={`${baseClass}__block-header ${baseClass}__block-header--selecting`}
              onClick={(event) => {
                // The checkbox's own input handles itself; a click anywhere
                // else on the header toggles the row.
                if ((event.target as HTMLElement).closest(`.${inputBaseClass}`)) {
                  return
                }
                selection.toggle(parentPath, row.id, event)
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') {
                  return
                }
                if ((event.target as HTMLElement).closest(`.${inputBaseClass}`)) {
                  return
                }
                event.preventDefault()
                selection.toggle(parentPath, row.id)
              }}
              role="button"
              tabIndex={0}
            >
              <CheckboxInput
                checked={isRowSelected}
                className={`${baseClass}__selection-checkbox`}
                id={`${parentPath?.split('.').join('-')}-select-${row.id}`}
                onToggle={() => selection.toggle(parentPath, row.id)}
              />
              <RowLabel
                CustomComponent={Label}
                label={
                  <>
                    <span className={`${baseClass}__block-number`}>
                      {String(rowIndex + 1).padStart(2, '0')}
                    </span>
                    <Pill
                      className={`${baseClass}__block-pill ${baseClass}__block-pill-${row.blockType}`}
                      pillStyle="white"
                      size="small"
                    >
                      {PillComponent || getTranslation(block.labels.singular, i18n)}
                    </Pill>
                    {showBlockName && (
                      <SectionTitle path={`${path}.blockName`} readOnly={readOnly} />
                    )}
                  </>
                }
                path={path}
                rowNumber={rowIndex}
              />
              {fieldHasErrors && <ErrorPill count={errorCount} i18n={i18n} withMessage />}
              <button
                aria-label={t('fields:toggleBlock')}
                className={`${baseClass}__selection-collapse ${baseClass}__selection-collapse--${row.collapsed ? 'collapsed' : 'open'}`}
                onClick={(event) => {
                  event.stopPropagation()
                  setCollapse(row.id, !row.collapsed)
                }}
                onKeyDown={(event) => event.stopPropagation()}
                type="button"
              >
                <ChevronIcon direction={row.collapsed ? undefined : 'up'} />
              </button>
            </div>
          ) : (
            <div className={`${baseClass}__block-header`}>
              <RowLabel
                CustomComponent={Label}
                label={
                  <>
                    <span className={`${baseClass}__block-number`}>
                      {String(rowIndex + 1).padStart(2, '0')}
                    </span>
                    <Pill
                      className={`${baseClass}__block-pill ${baseClass}__block-pill-${row.blockType}`}
                      pillStyle="white"
                      size="small"
                    >
                      {PillComponent || getTranslation(block.labels.singular, i18n)}
                    </Pill>
                    {showBlockName && (
                      <SectionTitle path={`${path}.blockName`} readOnly={readOnly} />
                    )}
                  </>
                }
                path={path}
                rowNumber={rowIndex}
              />
              {fieldHasErrors && <ErrorPill count={errorCount} i18n={i18n} withMessage />}
            </div>
          )
        }
        isCollapsed={row.collapsed}
        key={row.id}
        onToggle={(collapsed) => setCollapse(row.id, collapsed)}
      >
        {isLoading ? (
          <ShimmerEffect />
        ) : (
          <RenderFields
            className={`${baseClass}__fields`}
            fields={fields}
            margins="small"
            parentIndexPath=""
            parentPath={path}
            parentSchemaPath={schemaPath}
            permissions={blockPermissions}
            readOnly={readOnly}
          />
        )}
      </Collapsible>
    </div>
  )
}
