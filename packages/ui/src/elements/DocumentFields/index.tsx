'use client'
import type { ClientField, SanitizedDocumentPermissions } from 'payload'

import { defaultDocumentWidthTier, fieldIsSidebar, resolveDocumentWidthTier } from 'payload/shared'
import React, { useMemo } from 'react'

import { RenderFields } from '../../forms/RenderFields/index.js'
import { useConfig } from '../../providers/Config/index.js'
import { useDocumentInfo } from '../../providers/DocumentInfo/index.js'
import { useDrawerDepth } from '../Drawer/index.js'
import { Gutter } from '../Gutter/index.js'
import { TrashBanner } from '../TrashBanner/index.js'
import './index.scss'

const baseClass = 'document-fields'

type Args = {
  readonly AfterFields?: React.ReactNode
  readonly BeforeFields?: React.ReactNode
  readonly Description?: React.ReactNode
  readonly docPermissions: SanitizedDocumentPermissions
  readonly fields: ClientField[]
  readonly forceSidebarWrap?: boolean
  readonly isTrashed?: boolean
  readonly readOnly?: boolean
  readonly schemaPathSegments: string[]
}

export const DocumentFields: React.FC<Args> = ({
  AfterFields,
  BeforeFields,
  docPermissions,
  fields,
  forceSidebarWrap,
  isTrashed = false,
  readOnly,
  schemaPathSegments,
}) => {
  const { hasSidebarFields, mainFields, sidebarFields } = useMemo(() => {
    return fields.reduce(
      (acc, field) => {
        if (fieldIsSidebar(field)) {
          acc.sidebarFields.push(field)
          acc.mainFields.push(null)
          acc.hasSidebarFields = true
        } else {
          acc.mainFields.push(field)
          acc.sidebarFields.push(null)
        }
        return acc
      },
      {
        hasSidebarFields: false,
        mainFields: [] as ClientField[],
        sidebarFields: [] as ClientField[],
      },
    )
  }, [fields])

  // FORK (#79): stamp the document's page width tier so the SCSS can cap +
  // center the fields. Declared on the collection/global as
  // `admin.custom.widthTier` (default `form`); the Tabs field re-stamps the
  // active tab's content div and the SCSS lets any descendant stamp override
  // this root one. Never inside a drawer (depth 1 is the top-level document —
  // DocumentDrawer AND the bulk-upload drawer both nest deeper) and never in
  // the live-preview split pane (`forceSidebarWrap`), where the pane already
  // bounds the fields.
  const { collectionSlug, globalSlug } = useDocumentInfo()
  const { getEntityConfig } = useConfig()
  const drawerDepth = useDrawerDepth()
  const entityConfig = collectionSlug
    ? getEntityConfig({ collectionSlug })
    : globalSlug
      ? getEntityConfig({ globalSlug })
      : null
  const widthTier =
    drawerDepth > 1 || forceSidebarWrap
      ? undefined
      : (resolveDocumentWidthTier(entityConfig?.admin?.custom?.widthTier) ??
        defaultDocumentWidthTier)

  return (
    <div
      className={[
        baseClass,
        hasSidebarFields ? `${baseClass}--has-sidebar` : `${baseClass}--no-sidebar`,
        forceSidebarWrap && `${baseClass}--force-sidebar-wrap`,
      ]
        .filter(Boolean)
        .join(' ')}
      data-width-tier={widthTier}
    >
      <div className={`${baseClass}__main`}>
        <Gutter className={`${baseClass}__edit`}>
          {isTrashed && <TrashBanner />}
          {BeforeFields}
          <RenderFields
            className={`${baseClass}__fields`}
            fields={mainFields}
            forceRender
            parentIndexPath=""
            parentPath=""
            parentSchemaPath={schemaPathSegments.join('.')}
            permissions={docPermissions?.fields}
            readOnly={readOnly}
          />
          {AfterFields}
        </Gutter>
      </div>
      {hasSidebarFields ? (
        <div className={`${baseClass}__sidebar-wrap`}>
          <div className={`${baseClass}__sidebar`}>
            <div className={`${baseClass}__sidebar-fields`}>
              <RenderFields
                fields={sidebarFields}
                forceRender
                parentIndexPath=""
                parentPath=""
                parentSchemaPath={schemaPathSegments.join('.')}
                permissions={docPermissions?.fields}
                readOnly={readOnly}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
