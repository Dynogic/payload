# Fork Changes

## Bug Fixes

### 1. Tab ID State Key Fix

**File:** `packages/ui/src/forms/fieldSchemasToFormState/addFieldStatePromise.ts`

Fixed tab condition state tracking for nested tabs. Previously used just `field.id`, now uses `parentPath.field.id` for array items. This fixes tabs inside arrays not properly tracking their condition state.

### 2. Folder View "Create" Buttons Swapped

**File:** `packages/ui/src/views/CollectionFolder/index.tsx`

The "Create Document" and "Create Folder" buttons were swapped/mislabeled in the empty folder state. Fixed so correct labels match correct actions.

### 3. Strikethrough Markdown Not Working

**File:** `packages/richtext-lexical/src/packages/@lexical/markdown/MarkdownImport.ts`

Strikethrough (`~~text~~`) wasn't being parsed because single `~` (subscript) was matching first. Fixed by sorting tags by length (longest first) so `~~` matches before `~`.

### 4. Folder Cell Not Updating After Assignment

**File:** `packages/ui/src/elements/FolderView/Cell/index.client.tsx`

Fixed folder column not updating after changing folder assignment. The cell had a ref guard that prevented re-fetching once loaded, even when `folderID` changed. Now tracks `lastLoadedFolderID` and re-fetches when it differs.

### 5. Array Fields with `disableListFilter` Still Show Sub-Fields in Filter Dropdown

**File:** `packages/ui/src/utilities/reduceFieldsToOptions.tsx`

When an array field had `admin.disableListFilter: true`, the function still recursed into its child fields, causing sub-fields (like auto-generated `id`) to appear in the filter dropdown. Fixed by checking `disableListFilter` before recursing into array children.

### 6. Folder Field Label Not Translating in List View

**Files:** `packages/payload/src/folders/buildFolderField.ts`, `packages/translations/src/clientKeys.ts`, `packages/translations/src/languages/*.ts`

The folder field added by `folders: { browseByFolder: true }` had a hardcoded `'Folder'` label instead of using the i18n translation system. Changed to `({ t }) => t('folder:folder')` and added the `folder:folder` translation key to all 43 language files.

### 7. Upload Width/Height Fields Appear in Column Picker and Filters

**File:** `packages/payload/src/uploads/getBaseFields.ts`

The auto-generated `width` and `height` fields on upload collections had `admin.hidden` and `admin.readOnly` but were missing `disableListColumn` and `disableListFilter`. Added both flags so they no longer appear in the column picker or filter dropdown.

---

## Features

### 8. Hash-Based Tab Navigation

**File:** `packages/ui/src/fields/Tabs/index.tsx`

- Tabs now use URL hash (`#tab-name`) instead of preferences storage
- Enables shareable/bookmarkable tab URLs
- Listens to `hashchange` events for browser back/forward navigation
- Handles Next.js navigation (which doesn't trigger hashchange)
- SSR-safe: initializes to first visible tab, then switches to hash-selected tab after hydration
- Removed dependency on `usePreferences` and `useDocumentInfo`

### 9. Dynamic Routes for Multi-Tenant

**Files:** `packages/payload/src/config/createDynamicRoutes.ts`, `packages/payload/src/config/defaults.ts`

- New `createDynamicRoutes()` helper for request-time route resolution
- Fixed `defaults.ts` to preserve getters when merging routes (spread was resolving them prematurely)
- Useful for multi-tenant setups where admin/api routes vary by request context

### 10. Field-Level URL Parameter Defaults

**Files:** `packages/payload/src/fields/config/types.ts`, `packages/payload/src/admin/forms/Form.ts`, `packages/next/src/views/Document/index.tsx`

- New `urlParam` field config option to populate default values from URL query parameters
- Passes search params as `defaultValues` during document creation
- Fixed: when autosave+drafts are enabled, the create route immediately creates a draft and redirects — URL param defaults are now merged into the `payload.create()` data so they survive the redirect

### 11. MIME Type Validation for Uploads

**Files:** `packages/ui/src/elements/Upload/index.tsx`, `packages/ui/src/fields/Upload/index.tsx`, `packages/ui/src/elements/BulkUpload/EditForm/index.tsx`

- New `allowedMimeTypes` prop for Upload component
- New `onInvalidFile` callback for handling invalid file types
- Validates file types client-side before upload begins
- Supports wildcard patterns like `audio/*`, `image/*`
- `data.mimeType` is now available in field `condition` callbacks immediately when a file is dropped. The Upload component dispatches the file's MIME type string into form state on file change, so conditions can check `data.mimeType` without waiting for server upload. The `File` object itself is stripped during serialization (`excludeFiles: true`), so `data.file` is not usable in conditions.

### 12. Upload filterOptions in Lexical Rich Text

**Files:** `packages/richtext-lexical/src/features/upload/server/index.ts`, `packages/richtext-lexical/src/features/upload/client/drawer/index.tsx`, `packages/ui/src/elements/DocumentDrawer/*`

- New `filterOptions` prop for `UploadFeature` in Lexical editor
- Allows filtering upload collections based on context (user, field values, etc.)
- Passes through DocumentDrawer for filtered upload selection

### 13. File Type Icons in Folder View

**Files:** `packages/ui/src/elements/FolderView/FolderFileCard/index.tsx`, `packages/ui/src/elements/FolderView/FolderFileCard/getFileIcon.tsx`, `packages/ui/src/icons/*`

- New icons: `FileIcon`, `ImageIcon`, `VideoIcon`
- Folder view now shows appropriate icon based on file MIME type
- Images show image icon, videos show video icon, others show generic file icon

### 14. Upload Progress in UI

**Files:** `packages/ui/src/forms/Form/index.tsx`, `packages/translations/src/languages/*.ts` (43 files)

- Upload status now shows percentage: `"Uploading ({{progress}}%)"`
- Bulk upload shows: `"Uploading {{current}} of {{total}} ({{progress}}%)"`
- Upload forms always show a progress/loading toast, even during document creation (where `disableSuccessStatus` is true and other form types skip the toast). This ensures users see feedback during client-side uploads which can take time.

### 15. Upload Handler Enhancements

**Files:** `packages/plugin-cloud-storage/src/client/createClientUploadHandler.tsx`, `packages/ui/src/providers/UploadHandlers/index.tsx`, `packages/ui/src/forms/Form/index.tsx`

- Extended upload handlers with `formData` and `onProgress` callback support
- Enables progress tracking for cloud storage uploads
- `createFormData` passes `formData` and `onProgress` to the upload handler, updating the loading toast with real-time upload percentage

### 16. Markdown Paste Support in Lexical

**Files:** `packages/richtext-lexical/src/lexical/plugins/MarkdownPaste/index.tsx`, `packages/richtext-lexical/src/lexical/LexicalEditor.tsx`

- Pasting markdown text auto-formats it (e.g., `**bold**` becomes bold)
- Uses existing markdown transformer infrastructure
- Cmd+Shift+V (or Ctrl+Shift+V) pastes without markdown formatting
- Detects markdown patterns to avoid false positives on regular text

### 17. HighlightFeature and Extended Markdown Transformers

**Files:** `packages/richtext-lexical/src/features/format/highlight/*`, `packages/richtext-lexical/src/features/format/subscript/markdownTransformers.ts`, `packages/richtext-lexical/src/features/format/superscript/markdownTransformers.ts`, `packages/richtext-lexical/src/features/format/underline/markdownTransformers.ts`

- New `HighlightFeature` with `==text==` markdown syntax
- Added markdown transformers to existing features:
  - Subscript: `~text~`
  - Superscript: `^text^`
  - Underline: `++text++`

### 18. Document Header and Breadcrumb Customization

**Files:** `packages/payload/src/collections/config/types.ts`, `packages/ui/src/elements/StepNav/*`, `packages/ui/src/views/Edit/SetDocumentStepNav/index.tsx`, `packages/ui/src/elements/DocumentControls/*`, `packages/next/src/views/Document/index.tsx`

New collection admin options:

- `hideCollectionInBreadcrumb` - Hides collection from breadcrumb, shows `icon / doc title` instead of `icon / collection / doc title`. Useful for singleton-like collections.
- `hideDocumentHeader` - Hides the document header (title and tabs) in edit view
- `showTitleInControls` - Shows document title in the controls bar (useful with `hideDocumentHeader`)

Breadcrumb improvements:

- Current page breadcrumb item is no longer clickable (you're already on that page)
- Increased breadcrumb item max-width from `base(8)` to `base(16)`

Document controls:

- Removed "Last Modified" and "Created" timestamps from controls bar
- Added `flex-shrink: 0` to title to prevent shrinking
- Hide "Creating new [label]" text when `showTitleInControls` is enabled

### 19. List View Relationship Population

**Files:** `packages/payload/src/collections/config/types.ts`, `packages/next/src/views/List/index.tsx`, `packages/next/src/views/List/handleGroupBy.ts`

New collection admin options for controlling relationship population in list views:

- `listDepth` - Controls the depth when fetching documents in list view (default: 0, no population). Set to 1+ to enable relationship population.
- `listPopulate` - Controls which fields are selected when populating relationships. Maps collection slugs to select objects.

```ts
// Example usage
admin: {
  listDepth: 1,
  listPopulate: {
    files: { thumbnailURL: true, url: true, mimeType: true },
  }
}
```

Useful for displaying data from related collections in list views (e.g., showing thumbnails from upload relationships) without fetching entire nested documents.

### 20. Assign Folder from List View Selection

**Files:** `packages/ui/src/views/List/ListSelection/index.tsx`, `packages/payload/src/collections/operations/update.ts`, `packages/translations/src/languages/*.ts`

- New "Assign Folder" button appears when selecting items in list view (when folders are enabled)
- Custom confirmation modal with "Assign" terminology (not "Move")
- Toast messages say "assigned to folder" / "removed from folder"
- Allows folder assignment even on collections with `disableBulkEdit: true` (folder-only PATCH requests are permitted)
- Translations added for all 44 languages

### 22. Tab Change Events

**File:** `packages/ui/src/fields/Tabs/index.tsx`

- Dispatches `payload-tab-change` CustomEvent on tab switch
- Event detail includes `{ label, name, index, parentPath }`
- Enables live preview view mode switching based on admin tab selection

### 23. Custom List Column Headers (`admin.listLabel`)

**Files:** `packages/payload/src/fields/config/types.ts`, `packages/payload/src/utilities/flattenTopLevelFields.ts`

- New `admin.listLabel` option on fields to override the column header label in list view
- By default, nested fields (e.g., inside a group) display "Parent > Child" (e.g., "Pricing > Price")
- Setting `listLabel` replaces that with a custom label
- Supports i18n via `StaticLabel` (string or `Record<string, string>`)

```ts
// Example usage
{
  type: 'group',
  name: 'pricing',
  fields: [
    {
      type: 'number',
      name: 'price',
      admin: {
        listLabel: 'Price', // Shows "Price" instead of "Pricing > Price"
      },
    },
  ],
}
```

### 24. Styled Status Cell Badges

**Files:** `packages/ui/src/elements/Table/DefaultCell/fields/Status/index.tsx`, `packages/ui/src/elements/Table/DefaultCell/fields/Status/index.scss`, `packages/ui/src/elements/Table/DefaultCell/index.tsx`, `packages/ui/src/providers/TableColumns/buildColumnState/renderCell.tsx`

- The `_status` column in list views now renders as styled tinted badge pills instead of plain text
- **Published** → green badge
- **Draft** → yellow/amber badge
- **Changed** → indigo/blue badge (documents with unpublished changes that have a published version)
- List view label changed from `version:draftHasPublishedVersion` ("Draft (has published version)") to `version:changed` ("Changed") to match the document view status
- Works in both light and dark mode via `[data-theme]`
- Uses Payload's `--style-radius-s` CSS variable for consistent border radius

### 25. Human-Readable File Size in List View

**Files:** `packages/ui/src/elements/Table/DefaultCell/fields/FileSize/index.tsx`, `packages/ui/src/elements/Table/DefaultCell/index.tsx`

- The `filesize` column in upload collection list views now displays human-readable sizes (e.g., "2.5 MB") instead of raw byte numbers
- Locale-aware formatting via `Intl.NumberFormat` — decimal and thousand separators adapt to the user's language (e.g., `2,5 MB` in German, `2.5 MB` in English)
- Formatting rules: B (no decimals), KB (1 decimal), MB (1 decimal), GB (2 decimals)

### 26. Em Dash for Empty Cell Values

**File:** `packages/ui/src/elements/Table/DefaultCell/index.tsx`

- Empty cell values now show `—` (em dash) instead of `<No File Name>`, `<No Link Path>`, `<No Data>`, etc.

### 27. Custom Account Menu in Admin Header

**Files:** `packages/ui/src/elements/AppHeader/index.tsx`, `packages/next/src/templates/Default/index.tsx`, `packages/payload/src/config/types.ts`, `packages/payload/src/bin/generateImportMap/iterateConfig.ts`

- New `CustomAccountMenu` prop on `AppHeader` to replace the default account link with a custom component (e.g., a dropdown menu)
- Configured via `admin.components.accountMenu` in the Payload config
- Added `accountMenu` to the admin components type definition and import map generation
- Follows the same pattern as `CustomAvatar` and `CustomIcon`
- Backward compatible — no `accountMenu` in config = existing behavior

### 33. Styled List Header Action Buttons

**Files:** `packages/ui/src/elements/ListHeader/TitleActions/ListCreateNewDocButton.tsx`, `packages/ui/src/elements/ListHeader/TitleActions/ListBulkUploadButton.tsx`, `packages/ui/src/elements/Button/index.tsx`, `packages/ui/src/elements/Button/types.ts`, `packages/ui/src/icons/Upload/index.tsx`

- **"Create New"** button changed from `buttonStyle="pill"` to `buttonStyle="primary"` with `icon="plus"` (left) — makes it the visually prominent primary action across all collection list views
- **"Bulk Upload"** button gains `icon="upload"` (left) — secondary action with visual texture
- New `UploadIcon` added to Payload's icon set (`packages/ui/src/icons/Upload/`) and registered in the Button icon map

### 34. Clickable Table Rows and List View Improvements

**Files:** `packages/ui/src/elements/Table/index.tsx`, `packages/ui/src/elements/Table/index.scss`, `packages/ui/src/utilities/renderTable.tsx`, `packages/ui/src/providers/TableColumns/buildColumnState/index.tsx`, `packages/ui/src/elements/Table/DefaultCell/index.tsx`

- Entire table rows are now clickable in list views, not just the first cell's link
- In list view: clicking a row navigates to the document edit page
- In drawer mode (relationship picker): clicking a row selects the document
- Interactive elements (checkboxes, buttons, links, inputs) are excluded — clicks on these don't trigger row navigation
- Select (`_select`) and drag handle (`_dragHandle`) columns are also excluded
- New `collectionSlug` prop on `Table` component, passed through from `renderTable()`
- Added `cursor: pointer` to table body rows
- Disabled first-cell linked column (`enableLinkedCell` defaults to `false`) — row click handles navigation, so no underlined link on the first column
- Changed `vertical-align: top` to `vertical-align: middle` on `th`/`td` for centered cell content
- Added `height: calc(var(--base) * 2.7)` on `th`/`td` for consistent row height across all collections
- Removed built-in `FileCellComponent` rendering on `filename` fields in upload collections — the filename column now renders as plain text instead of a thumbnail+filename composite

---

## Configuration/Documentation

### 21. Fork Development Workflow

**Files:** `FORK-DEVELOPMENT.md`, `.gitignore`

- Documentation for building and using the fork locally

### 28. Disable HTML Document Title

**File:** `packages/next/src/utilities/meta.ts`

- Removed `title` from the returned Next.js `Metadata` object
- Payload no longer sets the HTML `<title>` tag on any admin view
- Allows the consuming app to manage `document.title` independently

### 29. Custom Language Resolution (`resolveLanguage`)

**Files:** `packages/payload/src/config/sanitize.ts`, `packages/payload/src/utilities/getRequestLanguage.ts`, `packages/translations/src/types.ts`

- New `resolveLanguage` option on `i18n` config for custom language resolution logic
- Receives `{ acceptLanguageHeader, cookieValue, fallbackLanguage, supportedLanguages }` and returns the language key to use
- Useful for multi-tenant setups where language should be determined by domain, tenant, or custom headers rather than the default cookie/Accept-Language matching
- When not provided, existing exact-match behavior is preserved

```ts
// Example usage
i18n: {
  resolveLanguage: ({ cookieValue, acceptLanguageHeader, supportedLanguages, fallbackLanguage }) => {
    // Custom logic to determine language
    return cookieValue || fallbackLanguage
  },
}
```

### 30. `views.list.titleActions` — Custom Buttons in List Header

**Files:**

- `packages/payload/src/collections/config/types.ts`
- `packages/payload/src/bin/generateImportMap/iterateCollections.ts`
- `packages/payload/src/admin/views/list.ts`
- `packages/next/src/views/List/renderListViewSlots.tsx`
- `packages/ui/src/views/List/index.tsx`
- `packages/ui/src/views/List/ListHeader/index.tsx`

Two separate extension points exist for collection list view actions:

- `admin.components.views.list.actions` — upstream behavior, renders in the **top-right app header** (via `getRouteData.ts` → `DefaultTemplate` → `ActionsProvider` → `AppHeader`)
- `admin.components.views.list.titleActions` — new fork addition, renders in the **list header title area** alongside "Create New" and "Bulk Upload"

Wired `titleActions` through the render pipeline into the collection list header:

- Added `titleActions?: CustomComponent[]` to the `views.list` type in `packages/payload/src/collections/config/types.ts`
- Added `titleActions` to `iterateCollections.ts` so the import map generator registers its components
- Added `TitleActions?: React.ReactNode[]` to `ListViewSlots` type
- `renderListViewSlots` renders `views.list.titleActions` components into `result.TitleActions`
- `DefaultListView` destructures `TitleActions` and passes it to `CollectionListHeader`
- `CollectionListHeader` destructures and spreads custom actions after the built-in buttons

```ts
// Example usage in a collection config
admin: {
  components: {
    views: {
      list: {
        // Renders next to "Create New" / "Bulk Upload" in the list header
        titleActions: ['@/components/admin/my-import-button'],

        // Renders in the top-right app header (upstream behavior, unchanged)
        // actions: ['@/components/admin/my-global-action'],
      },
    },
  },
}
```

### 31. Rename "File/Files" to "Media" in Upload Translations (all 44 languages)

**File:** `packages/translations/src/languages/*.ts`

Updated in English (`en.ts`) and all 43 other language files:

- `upload.addFile`: `'Add file'` → `'Add media'` (native equivalent)
- `upload.addFiles`: `'Add files'` → `'Add media'` (native equivalent)
- `upload.filesToUpload`: `'Files to Upload'` → `'Media to Upload'` (native equivalent)
- `upload.fileToUpload`: `'File to Upload'` → `'Media to Upload'` (native equivalent)
- `upload.dragAndDrop`: `'Drag and drop a file'` → `'Drag and drop media'` (native equivalent)
- `upload.dragAndDropHere`: `'or drag and drop a file here'` → `'or drag and drop media here'` (native equivalent)
- `upload.noFile`: `'No file'` → `'No media'` (native equivalent)
- `upload.selectFile`: `'Select a file'` → `'Select media'` (native equivalent)

### 32. Hide No-Results Message When BeforeListTable CTA Is Present

**File:** `packages/ui/src/views/List/index.tsx`

- The "no results" message is now hidden when a `beforeListTable` component is registered AND the query is unmodified (no active search or filters)
- When filters/search are active (`modified === true`), Payload's no-results message is always shown regardless of `BeforeListTable`
- This allows CTA components in `beforeListTable` to cleanly replace the empty state without CSS hacks
- Uses `modified` from `useListQuery()` to distinguish "truly empty collection" from "filtered to zero results"

### 35. Consistent Capitalization in "Create New" Labels

**Files:** `packages/translations/src/languages/en.ts`, `packages/translations/src/languages/it.ts`, `packages/translations/src/languages/id.ts`, `packages/translations/src/languages/pt.ts`

- `createNewLabel` and `creatingNewLabel` had inconsistent capitalization with `createNew` (e.g., "Create New" button vs "Create new Offer" empty state CTA)
- Fixed in all 4 affected languages: English, Italian, Indonesian, Portuguese

### 36. `headerActions` Custom Component Slot for Blocks and Array Fields

**Files:** `packages/ui/src/fields/Blocks/index.tsx`, `packages/ui/src/fields/Array/index.tsx`, `packages/ui/src/forms/fieldSchemasToFormState/renderField.tsx`

- New `admin.components.headerActions` slot for blocks and array fields
- Renders custom components inside the field header `<ul>` alongside "Collapse All", "Show All", and the clipboard action menu
- Processed via `renderField.tsx` the same way as `beforeInput`/`afterInput`
- Components receive `path` and `schemaPath` via `clientProps`
- Useful for adding field-level action buttons (e.g., bulk import, batch operations) directly in the header bar

```ts
// Example usage
{
  name: 'myBlocks',
  type: 'blocks',
  blocks: [...],
  admin: {
    components: {
      headerActions: ['@/components/admin/my-header-action'],
    },
  },
}
```

### 38. `hideAddButton` for Blocks and Array Fields

**Files:** `packages/payload/src/fields/config/types.ts`, `packages/ui/src/fields/Blocks/index.tsx`, `packages/ui/src/fields/Array/index.tsx`

- New `admin.hideAddButton` boolean option for blocks and array fields
- When `true`, hides the default "Add Block" / "Add Row" button
- Use `admin.components.afterInput` to provide custom add buttons when the default is hidden
- Follows the same pattern as `isSortable` and `initCollapsed`

```ts
{
  name: 'series',
  type: 'blocks',
  blocks: [...],
  admin: {
    hideAddButton: true,
    components: {
      afterInput: ['@/components/admin/custom-add-button'],
    },
  },
}
```

### 37. Custom File Icon for Non-Image Uploads

**Files:** `packages/ui/src/elements/Upload/index.tsx`, `packages/ui/src/elements/Upload/index.scss`

- New `FileIcon` prop on the `Upload` component: `React.ComponentType<{ mimeType: string }>`
- When a non-image file is selected, renders `<FileIcon mimeType={value.type} />` instead of the generic white document SVG
- If no `FileIcon` prop is provided, non-image uploads show just the filename and actions (no placeholder icon)
- Image uploads still show the actual thumbnail preview as before
- File icon renders inline with the filename input row (not in a separate column)
- New `__filename-row` and `__file-icon` CSS classes for layout

### 40. Custom `Pill` Component for Block Row Headers

**Files:** `packages/payload/src/fields/config/types.ts`, `packages/ui/src/fields/Blocks/BlockRow.tsx`, `packages/ui/src/fields/Blocks/index.tsx`, `packages/ui/src/forms/fieldSchemasToFormState/renderField.tsx`, `packages/payload/src/bin/generateImportMap/iterateFields.ts`

- New `admin.components.Pill` slot on `Block` type
- Replaces the default block type label text inside the pill badge in row headers
- The custom component receives standard client props and can read form state to render dynamic labels
- Useful for blocks that need context-aware labels (e.g., "Module" vs "Season" vs "Section" based on a parent field value)

```ts
// Example usage in a block definition
{
  slug: 'seriesSectionBlock',
  admin: {
    components: {
      Pill: '@/components/admin/series-section-pill',
    },
  },
}
```

### 42. `hideAddBelow` for Blocks and Array Fields

**Files:** `packages/payload/src/fields/config/types.ts`, `packages/ui/src/fields/Blocks/index.tsx`, `packages/ui/src/fields/Blocks/BlockRow.tsx`, `packages/ui/src/fields/Blocks/RowActions.tsx`, `packages/ui/src/fields/Array/index.tsx`, `packages/ui/src/fields/Array/ArrayRow.tsx`, `packages/ui/src/elements/ArrayAction/index.tsx`

- New `admin.hideAddBelow` boolean option — hides the "Add Below" action from each row's action menu
- Row action menus with `hideAddBelow: true` show: Move Up, Move Down, Duplicate, Remove (no Add Below)

### 41. `hideClipboard` for Blocks and Array Fields

**Files:** `packages/payload/src/fields/config/types.ts`, `packages/ui/src/fields/Blocks/index.tsx`, `packages/ui/src/fields/Array/index.tsx`, `packages/ui/src/elements/ArrayAction/index.tsx`

- New `admin.hideClipboard` boolean option for blocks and array fields
- When `true`, hides the "Copy Field" / "Paste Field" menu from the header and the "Copy Row" / "Paste Row" buttons from each row's action menu
- Row action menus still show Move Up, Move Down, Add Below, Duplicate, and Remove

### 39. Remove Client-Side "A file is required" Validation from Upload

**File:** `packages/ui/src/elements/Upload/index.tsx`

- Removed the hardcoded `if (!value && value !== undefined) return 'A file is required.'` check from the Upload component's client-side `validate` function
- This validation conflicted with collections using `filesRequiredOnCreate: false` (e.g., collections supporting both file uploads and YouTube source types)
- File-required validation should be handled by collection-level `beforeValidate` hooks, which can apply conditional logic based on source type
- The filename-required check (`'A file name is required.'`) is preserved

### 43. Hide Duplicate Title in DocumentDrawer When `showTitleInControls` Is Enabled

**File:** `packages/ui/src/elements/DocumentControls/index.tsx`

- When a document is opened in a `DocumentDrawer` (inline create/edit from relationship fields), the title was shown twice: once in the drawer header and once in the document controls bar (when `showTitleInControls: true`)
- Now skips the controls bar title render when `isInDrawer` is true, since the drawer header already displays the document title
- Does NOT use `hideDocumentHeader` — that would also hide tabs (Content/Teaser etc.) which are needed in drawers
- Affects all collections using `showTitleInControls: true` when opened via DocumentDrawer

### 44. `allowedMimeTypes` and `drawerContext` on DocumentDrawer

**Files:** `packages/ui/src/elements/DocumentDrawer/types.ts`, `packages/ui/src/elements/DocumentDrawer/Provider.tsx`, `packages/ui/src/elements/DocumentDrawer/DrawerContent.tsx`, `packages/ui/src/elements/Upload/index.tsx`, `packages/ui/src/exports/client/index.ts`

- New `allowedMimeTypes` prop on `DocumentDrawer` — restricts file uploads to specific MIME types when creating documents in a drawer (e.g., `['video/*']` for video-only uploads)
- New `drawerContext` prop (`Record<string, unknown>`) — arbitrary context data accessible to custom field components inside the drawer via `useDocumentDrawerContext().drawerContext`
- Both flow through `DocumentDrawerContent` → `DocumentDrawerContextProvider` → context
- Upload component reads `allowedMimeTypes` from drawer context as fallback when not passed as direct prop
- New `useOptionalDocumentDrawerContext()` hook — safe version that returns `null` when not inside a provider (for components that render both inside and outside drawers)

```ts
// Example: video-only upload drawer
<DocumentDrawer
  collectionSlug="files"
  allowedMimeTypes={['video/*']}
  onSave={handleSave}
/>

// Example: product drawer with custom field filtering
<DocumentDrawer
  collectionSlug="products"
  drawerContext={{ excludeProductTypes: ['course', 'series', 'collection', 'playlist'] }}
  onSave={handleSave}
/>
```

---

## Summary

| Category      | Count |
| ------------- | ----- |
| Bug Fixes     | 9     |
| Features      | 28    |
| Documentation | 1     |
