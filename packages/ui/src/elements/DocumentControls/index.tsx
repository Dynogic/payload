'use client'
import type {
  ClientUser,
  Data,
  SanitizedCollectionConfig,
  SanitizedCollectionPermission,
  SanitizedGlobalPermission,
} from 'payload'

import { getTranslation } from '@payloadcms/translations'
import { formatAdminURL, hasAutosaveEnabled, hasDraftsEnabled } from 'payload/shared'
import React, { Fragment } from 'react'

import type { DocumentDrawerContextType } from '../DocumentDrawer/Provider.js'

import { useFormInitializing, useFormProcessing } from '../../forms/Form/context.js'
import { useConfig } from '../../providers/Config/index.js'
import { useDocumentInfo } from '../../providers/DocumentInfo/index.js'
import { useEditDepth } from '../../providers/EditDepth/index.js'
import { useLivePreviewContext } from '../../providers/LivePreview/context.js'
import { useTranslation } from '../../providers/Translation/index.js'
import { Autosave } from '../Autosave/index.js'
import { Button } from '../Button/index.js'
import { CopyLocaleData } from '../CopyLocaleData/index.js'
import { DeleteDocument } from '../DeleteDocument/index.js'
import { useOptionalDocumentDrawerContext } from '../DocumentDrawer/Provider.js'
import { DuplicateDocument } from '../DuplicateDocument/index.js'
import { MoveDocToFolder } from '../FolderView/MoveDocToFolder/index.js'
import { Gutter } from '../Gutter/index.js'
import { LivePreviewToggler } from '../LivePreview/Toggler/index.js'
import { Locked } from '../Locked/index.js'
import { PermanentlyDeleteButton } from '../PermanentlyDeleteButton/index.js'
import { Popup, PopupList } from '../Popup/index.js'
import { PreviewButton } from '../PreviewButton/index.js'
import { PublishButton } from '../PublishButton/index.js'
import { RenderCustomComponent } from '../RenderCustomComponent/index.js'
import { RenderTitle } from '../RenderTitle/index.js'
import { RestoreButton } from '../RestoreButton/index.js'
import { SaveButton } from '../SaveButton/index.js'
import './index.scss'
import { SaveDraftButton } from '../SaveDraftButton/index.js'
import { Status } from '../Status/index.js'
import { UnpublishButton } from '../UnpublishButton/index.js'

const baseClass = 'doc-controls'

export const DocumentControls: React.FC<{
  readonly apiURL: string
  readonly BeforeDocumentControls?: React.ReactNode
  readonly customComponents?: {
    readonly DeleteButton?: React.ReactNode
    readonly PreviewButton?: React.ReactNode
    readonly PublishButton?: React.ReactNode
    readonly SaveButton?: React.ReactNode
    readonly SaveDraftButton?: React.ReactNode
    readonly Status?: React.ReactNode
    /** Fork #80: replaces `RenderTitle` (edit + create view; skipped in drawers). */
    readonly Title?: React.ReactNode
    readonly UnpublishButton?: React.ReactNode
  }
  readonly data?: Data
  readonly disableActions?: boolean
  readonly disableCreate?: boolean
  readonly EditMenuItems?: React.ReactNode
  readonly hasPublishPermission?: boolean
  readonly hasSavePermission?: boolean
  readonly id?: number | string
  readonly isAccountView?: boolean
  readonly isEditing?: boolean
  readonly isInDrawer?: boolean
  readonly isTrashed?: boolean
  readonly onDelete?: DocumentDrawerContextType['onDelete']
  readonly onDrawerCreateNew?: () => void
  /* Only available if `redirectAfterDuplicate` is `false` */
  readonly onDuplicate?: DocumentDrawerContextType['onDuplicate']
  readonly onRestore?: DocumentDrawerContextType['onRestore']
  readonly onSave?: DocumentDrawerContextType['onSave']
  readonly onTakeOver?: () => void
  readonly permissions: null | SanitizedCollectionPermission | SanitizedGlobalPermission
  readonly readOnlyForIncomingUser?: boolean
  readonly redirectAfterDelete?: boolean
  readonly redirectAfterDuplicate?: boolean
  readonly redirectAfterRestore?: boolean
  readonly showTitle?: boolean
  readonly slug: SanitizedCollectionConfig['slug']
  readonly user?: ClientUser
}> = (props) => {
  const {
    id,
    slug,
    BeforeDocumentControls,
    customComponents: {
      DeleteButton: CustomDeleteButton,
      PreviewButton: CustomPreviewButton,
      PublishButton: CustomPublishButton,
      SaveButton: CustomSaveButton,
      SaveDraftButton: CustomSaveDraftButton,
      Status: CustomStatus,
      Title: CustomTitle,
      UnpublishButton: CustomUnpublishButton,
    } = {},
    data,
    disableActions,
    disableCreate,
    EditMenuItems,
    hasSavePermission,
    isAccountView,
    isEditing,
    isInDrawer,
    isTrashed,
    onDelete,
    onDrawerCreateNew,
    onDuplicate,
    onRestore,
    onTakeOver,
    permissions,
    readOnlyForIncomingUser,
    redirectAfterDelete,
    redirectAfterDuplicate,
    redirectAfterRestore,
    showTitle,
    user,
  } = props

  const { i18n, t } = useTranslation()

  const editDepth = useEditDepth()

  const drawerCtx = useOptionalDocumentDrawerContext()
  const isCreateDrawer = drawerCtx?.isCreateDrawer ?? false
  // Fork #61: a drawer picks one of THREE save behaviors via
  // drawerContext.saveMode. Absent → 'saveAndAdd' (the #45 default, so every
  // existing relationship drawer is unchanged).
  //  - 'saveAndAdd' : #45 — lone "Save & Add" (create) / "Save" (edit), autosave off.
  //  - 'default'    : upstream Payload — same controls as the full-page editor.
  //                   Faithful for non-autosave collections; for an AUTOSAVE
  //                   collection autosave won't fire in a drawer (the server skips
  //                   the auto-draft via `!drawerSlug` in Document/index.tsx), so
  //                   use 'createEdit' for those.
  //  - 'createEdit' : create drawer (no id) → explicit "Save Draft & Close" +
  //                   "Publish & Close" (labels via createLabels), autosave off;
  //                   edit drawer (id exists) → autosave on + lone Publish.
  const drawerContextOpts = drawerCtx?.drawerContext as
    | {
        createLabels?: { publish?: string; saveDraft?: string }
        saveMode?: 'createEdit' | 'default' | 'saveAndAdd'
      }
    | undefined
  const saveMode = drawerContextOpts?.saveMode ?? 'saveAndAdd'
  const drawerDefault = isInDrawer && saveMode === 'default'
  const drawerSaveAndAdd = isInDrawer && saveMode === 'saveAndAdd'
  const createEditCreate = isInDrawer && saveMode === 'createEdit' && isCreateDrawer
  const createEditEdit = isInDrawer && saveMode === 'createEdit' && !isCreateDrawer
  const createLabels = drawerContextOpts?.createLabels

  const { config, getEntityConfig } = useConfig()

  const collectionConfig = getEntityConfig({ collectionSlug: slug })

  const globalConfig = getEntityConfig({ globalSlug: slug })

  const { isLivePreviewEnabled } = useLivePreviewContext()

  const { hasDeletePermission: docHasDeletePermission, hasTrashPermission: docHasTrashPermission } =
    useDocumentInfo()

  const {
    localization,
    routes: { admin: adminRoute },
  } = config

  const processing = useFormProcessing()
  const initializing = useFormInitializing()

  const hasCreatePermission = permissions && 'create' in permissions && permissions.create

  const collectionDeletePermission = permissions && 'delete' in permissions && permissions.delete

  const hasDeletePermission = collectionConfig?.trash
    ? docHasTrashPermission || docHasDeletePermission
    : collectionDeletePermission

  const unsavedDraftWithValidations =
    !id && collectionConfig?.versions?.drafts && collectionConfig.versions?.drafts.validate

  const globalHasDraftsEnabled = hasDraftsEnabled(globalConfig)
  const collectionHasDraftsEnabled = hasDraftsEnabled(collectionConfig)

  const showDotMenu = Boolean(
    !disableActions &&
      // Fork change #45: hide the dot menu in create drawers (no Create New / Duplicate / Delete
      // for a document being created inline).
      !isCreateDrawer &&
      ((collectionConfig && id && (hasCreatePermission || hasDeletePermission)) ||
        (globalConfig && (globalHasDraftsEnabled || localization))),
  )
  const collectionAutosaveEnabled = hasAutosaveEnabled(collectionConfig)
  const globalAutosaveEnabled = hasAutosaveEnabled(globalConfig)
  const autosaveEnabled = collectionAutosaveEnabled || globalAutosaveEnabled

  const showSaveDraftButton =
    (collectionAutosaveEnabled &&
      collectionConfig.versions.drafts.autosave !== false &&
      collectionConfig.versions.drafts.autosave.showSaveDraftButton === true) ||
    (globalAutosaveEnabled &&
      globalConfig.versions.drafts.autosave !== false &&
      globalConfig.versions.drafts.autosave.showSaveDraftButton === true)
  const showCopyToLocale = localization && !collectionConfig?.admin?.disableCopyToLocale

  const showFolderMetaIcon = collectionConfig && collectionConfig.folders
  const showLockedMetaIcon = user && readOnlyForIncomingUser

  // Fork #80: a collection-level `admin.components.edit.Title` replaces
  // RenderTitle in the content box — on the edit view AND the create view
  // (the app decides what an unsaved doc is called). Never in a drawer: the
  // drawer header already carries the title (#43). When it renders, the
  // "Creating new <Label>" meta line yields to it the same way `showTitle`
  // does.
  const hasCustomTitle = Boolean(CustomTitle) && !isInDrawer
  const titleShown = hasCustomTitle || Boolean(showTitle)

  return (
    <Gutter className={baseClass}>
      <div className={`${baseClass}__wrapper`}>
        <div className={`${baseClass}__content`}>
          {hasCustomTitle
            ? CustomTitle
            : showTitle &&
              !isInDrawer && <RenderTitle className={`${baseClass}__title`} element="h1" />}
          {showLockedMetaIcon || showFolderMetaIcon ? (
            <div className={`${baseClass}__meta-icons`}>
              {showLockedMetaIcon && (
                <Locked className={`${baseClass}__locked-controls`} user={user} />
              )}
              {showFolderMetaIcon && config.folders && !isTrashed && (
                <MoveDocToFolder
                  folderCollectionSlug={config.folders.slug}
                  folderFieldName={config.folders.fieldName}
                />
              )}
            </div>
          ) : null}
          <ul className={`${baseClass}__meta`}>
            {collectionConfig && !isEditing && !isAccountView && !titleShown && (
              <li className={`${baseClass}__list-item`}>
                <p className={`${baseClass}__value`}>
                  {i18n.t('general:creatingNewLabel', {
                    label: getTranslation(
                      collectionConfig?.labels?.singular ?? i18n.t('general:document'),
                      i18n,
                    ),
                  })}
                </p>
              </li>
            )}
            {(collectionHasDraftsEnabled || globalHasDraftsEnabled) && (
              <Fragment>
                {(globalConfig || (collectionConfig && isEditing)) && (
                  <li
                    className={[`${baseClass}__status`, `${baseClass}__list-item`]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <RenderCustomComponent CustomComponent={CustomStatus} Fallback={<Status />} />
                  </li>
                )}
                {hasSavePermission &&
                  autosaveEnabled &&
                  !unsavedDraftWithValidations &&
                  // Autosave runs full-page, in a 'default' drawer, and in a
                  // 'createEdit' EDIT drawer — all cases where the doc has (or the
                  // server minted) an id, so the autosave PATCH has a target. It stays
                  // OFF in a 'createEdit' CREATE drawer (no auto-draft to PATCH — #45
                  // skips it via `!drawerSlug`), which would otherwise spin forever on
                  // "Saving…"; that drawer uses explicit Save Draft / Publish buttons.
                  (!isInDrawer || drawerDefault || createEditEdit) &&
                  !isTrashed && (
                    <li className={`${baseClass}__list-item`}>
                      <Autosave
                        collection={collectionConfig}
                        global={globalConfig}
                        id={id}
                        publishedDocUpdatedAt={data?.createdAt}
                      />
                    </li>
                  )}
              </Fragment>
            )}
          </ul>
        </div>
        <div className={`${baseClass}__controls-wrapper`}>
          <div className={`${baseClass}__controls`}>
            {BeforeDocumentControls}
            {isLivePreviewEnabled && !isInDrawer && <LivePreviewToggler />}
            {(collectionConfig?.admin.preview || globalConfig?.admin.preview) && (
              <RenderCustomComponent
                CustomComponent={CustomPreviewButton}
                Fallback={<PreviewButton />}
              />
            )}
            {hasSavePermission && !isTrashed && (
              <Fragment>
                {drawerSaveAndAdd ? (
                  // 'saveAndAdd' (#45): lone Save & Add (create) / Save (edit).
                  <SaveButton label={isCreateDrawer ? t('general:saveAndAdd') : undefined} />
                ) : createEditCreate && (collectionHasDraftsEnabled || globalHasDraftsEnabled) ? (
                  // 'createEdit' CREATE drawer: explicit Save Draft & Close + Publish &
                  // Close (no autosave). Labels come from the host via createLabels.
                  <Fragment>
                    <RenderCustomComponent
                      CustomComponent={CustomSaveDraftButton}
                      Fallback={<SaveDraftButton label={createLabels?.saveDraft} />}
                    />
                    <RenderCustomComponent
                      CustomComponent={CustomPublishButton}
                      Fallback={<PublishButton label={createLabels?.publish} />}
                    />
                  </Fragment>
                ) : createEditEdit && (collectionHasDraftsEnabled || globalHasDraftsEnabled) ? (
                  // 'createEdit' EDIT drawer: autosave handles drafts → lone Publish.
                  <RenderCustomComponent
                    CustomComponent={CustomPublishButton}
                    Fallback={<PublishButton />}
                  />
                ) : collectionHasDraftsEnabled || globalHasDraftsEnabled ? (
                  // Full-page editor AND 'default' drawer: stock controls.
                  <Fragment>
                    {(unsavedDraftWithValidations ||
                      !autosaveEnabled ||
                      (autosaveEnabled && showSaveDraftButton)) && (
                      <RenderCustomComponent
                        CustomComponent={CustomSaveDraftButton}
                        Fallback={<SaveDraftButton />}
                      />
                    )}
                    <RenderCustomComponent
                      CustomComponent={CustomPublishButton}
                      Fallback={<PublishButton />}
                    />
                  </Fragment>
                ) : (
                  <RenderCustomComponent
                    CustomComponent={CustomSaveButton}
                    Fallback={<SaveButton />}
                  />
                )}
              </Fragment>
            )}
            {docHasDeletePermission && isTrashed && (
              <PermanentlyDeleteButton
                buttonId="action-permanently-delete"
                collectionSlug={collectionConfig?.slug}
                id={id.toString()}
                onDelete={onDelete}
                redirectAfterDelete={redirectAfterDelete}
                singularLabel={collectionConfig?.labels?.singular}
              />
            )}
            {hasSavePermission && isTrashed && (
              <RestoreButton
                buttonId="action-restore"
                collectionSlug={collectionConfig?.slug}
                id={id.toString()}
                onRestore={onRestore}
                redirectAfterRestore={redirectAfterRestore}
                singularLabel={collectionConfig?.labels?.singular}
              />
            )}
            {user && readOnlyForIncomingUser && (
              <Button
                buttonStyle="secondary"
                id="take-over"
                onClick={onTakeOver}
                size="medium"
                type="button"
              >
                {t('general:takeOver')}
              </Button>
            )}
          </div>
          {showDotMenu && !readOnlyForIncomingUser && (
            <Popup
              button={
                <div className={`${baseClass}__dots`}>
                  <div />
                  <div />
                  <div />
                </div>
              }
              className={`${baseClass}__popup`}
              disabled={initializing || processing}
              horizontalAlign="right"
              size="large"
              verticalAlign="bottom"
            >
              <PopupList.ButtonGroup>
                {showCopyToLocale && <CopyLocaleData />}
                {hasCreatePermission && (
                  <React.Fragment>
                    {collectionConfig.disableDuplicate !== true && isEditing && (
                      <>
                        <DuplicateDocument
                          id={id}
                          onDuplicate={onDuplicate}
                          redirectAfterDuplicate={redirectAfterDuplicate}
                          singularLabel={collectionConfig?.labels?.singular}
                          slug={collectionConfig?.slug}
                        />
                        {localization && (
                          <DuplicateDocument
                            id={id}
                            onDuplicate={onDuplicate}
                            redirectAfterDuplicate={redirectAfterDuplicate}
                            selectLocales={true}
                            singularLabel={collectionConfig?.labels?.singular}
                            slug={collectionConfig?.slug}
                          />
                        )}
                      </>
                    )}
                  </React.Fragment>
                )}
                {hasDeletePermission && (
                  <RenderCustomComponent
                    CustomComponent={CustomDeleteButton}
                    Fallback={
                      <DeleteDocument
                        buttonId="action-delete"
                        collectionSlug={collectionConfig?.slug}
                        id={id.toString()}
                        onDelete={onDelete}
                        redirectAfterDelete={redirectAfterDelete}
                        singularLabel={collectionConfig?.labels?.singular}
                        useAsTitle={collectionConfig?.admin?.useAsTitle}
                      />
                    }
                  />
                )}
                <RenderCustomComponent
                  CustomComponent={CustomUnpublishButton}
                  Fallback={<UnpublishButton />}
                />
                {EditMenuItems}
              </PopupList.ButtonGroup>
            </Popup>
          )}
        </div>
      </div>
      <div className={`${baseClass}__divider`} />
    </Gutter>
  )
}
