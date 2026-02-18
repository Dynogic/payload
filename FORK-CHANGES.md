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

---

## Features

### 5. Hash-Based Tab Navigation

**File:** `packages/ui/src/fields/Tabs/index.tsx`

- Tabs now use URL hash (`#tab-name`) instead of preferences storage
- Enables shareable/bookmarkable tab URLs
- Listens to `hashchange` events for browser back/forward navigation
- Handles Next.js navigation (which doesn't trigger hashchange)
- SSR-safe: initializes to first visible tab, then switches to hash-selected tab after hydration
- Removed dependency on `usePreferences` and `useDocumentInfo`

### 6. Dynamic Routes for Multi-Tenant

**Files:** `packages/payload/src/config/createDynamicRoutes.ts`, `packages/payload/src/config/defaults.ts`

- New `createDynamicRoutes()` helper for request-time route resolution
- Fixed `defaults.ts` to preserve getters when merging routes (spread was resolving them prematurely)
- Useful for multi-tenant setups where admin/api routes vary by request context

### 7. Field-Level URL Parameter Defaults

**Files:** `packages/payload/src/fields/config/types.ts`, `packages/payload/src/admin/forms/Form.ts`, `packages/next/src/views/Document/index.tsx`

- New `urlParam` field config option to populate default values from URL query parameters
- Passes search params as `defaultValues` during document creation

### 8. MIME Type Validation for Uploads

**Files:** `packages/ui/src/elements/Upload/index.tsx`, `packages/ui/src/fields/Upload/index.tsx`, `packages/ui/src/elements/BulkUpload/EditForm/index.tsx`

- New `allowedMimeTypes` prop for Upload component
- New `onInvalidFile` callback for handling invalid file types
- Validates file types client-side before upload begins
- Supports wildcard patterns like `audio/*`, `image/*`
- `data.mimeType` is now available in field `condition` callbacks immediately when a file is dropped. The Upload component dispatches the file's MIME type string into form state on file change, so conditions can check `data.mimeType` without waiting for server upload. The `File` object itself is stripped during serialization (`excludeFiles: true`), so `data.file` is not usable in conditions.

### 9. Upload filterOptions in Lexical Rich Text

**Files:** `packages/richtext-lexical/src/features/upload/server/index.ts`, `packages/richtext-lexical/src/features/upload/client/drawer/index.tsx`, `packages/ui/src/elements/DocumentDrawer/*`

- New `filterOptions` prop for `UploadFeature` in Lexical editor
- Allows filtering upload collections based on context (user, field values, etc.)
- Passes through DocumentDrawer for filtered upload selection

### 10. File Type Icons in Folder View

**Files:** `packages/ui/src/elements/FolderView/FolderFileCard/index.tsx`, `packages/ui/src/elements/FolderView/FolderFileCard/getFileIcon.tsx`, `packages/ui/src/icons/*`

- New icons: `FileIcon`, `ImageIcon`, `VideoIcon`
- Folder view now shows appropriate icon based on file MIME type
- Images show image icon, videos show video icon, others show generic file icon

### 11. Upload Progress in UI

**Files:** `packages/ui/src/forms/Form/index.tsx`, `packages/translations/src/languages/*.ts` (43 files)

- Upload status now shows percentage: `"Uploading ({{progress}}%)"`
- Bulk upload shows: `"Uploading {{current}} of {{total}} ({{progress}}%)"`
- Upload forms always show a progress/loading toast, even during document creation (where `disableSuccessStatus` is true and other form types skip the toast). This ensures users see feedback during client-side uploads which can take time.

### 12. Upload Handler Enhancements

**Files:** `packages/plugin-cloud-storage/src/client/createClientUploadHandler.tsx`, `packages/ui/src/providers/UploadHandlers/index.tsx`, `packages/ui/src/forms/Form/index.tsx`

- Extended upload handlers with `formData` and `onProgress` callback support
- Enables progress tracking for cloud storage uploads
- `createFormData` passes `formData` and `onProgress` to the upload handler, updating the loading toast with real-time upload percentage

### 13. Markdown Paste Support in Lexical

**Files:** `packages/richtext-lexical/src/lexical/plugins/MarkdownPaste/index.tsx`, `packages/richtext-lexical/src/lexical/LexicalEditor.tsx`

- Pasting markdown text auto-formats it (e.g., `**bold**` becomes bold)
- Uses existing markdown transformer infrastructure
- Cmd+Shift+V (or Ctrl+Shift+V) pastes without markdown formatting
- Detects markdown patterns to avoid false positives on regular text

### 14. HighlightFeature and Extended Markdown Transformers

**Files:** `packages/richtext-lexical/src/features/format/highlight/*`, `packages/richtext-lexical/src/features/format/subscript/markdownTransformers.ts`, `packages/richtext-lexical/src/features/format/superscript/markdownTransformers.ts`, `packages/richtext-lexical/src/features/format/underline/markdownTransformers.ts`

- New `HighlightFeature` with `==text==` markdown syntax
- Added markdown transformers to existing features:
  - Subscript: `~text~`
  - Superscript: `^text^`
  - Underline: `++text++`

### 15. Document Header and Breadcrumb Customization

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

### 16. List View Relationship Population

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

### 17. Assign Folder from List View Selection

**Files:** `packages/ui/src/views/List/ListSelection/index.tsx`, `packages/payload/src/collections/operations/update.ts`, `packages/translations/src/languages/*.ts`

- New "Assign Folder" button appears when selecting items in list view (when folders are enabled)
- Custom confirmation modal with "Assign" terminology (not "Move")
- Toast messages say "assigned to folder" / "removed from folder"
- Allows folder assignment even on collections with `disableBulkEdit: true` (folder-only PATCH requests are permitted)
- Translations added for all 44 languages

### 19. Tab Change Events

**File:** `packages/ui/src/fields/Tabs/index.tsx`

- Dispatches `payload-tab-change` CustomEvent on tab switch
- Event detail includes `{ label, name, index, parentPath }`
- Enables live preview view mode switching based on admin tab selection

### 20. Custom List Column Headers (`admin.listLabel`)

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

### 21. Styled Status Cell Badges

**Files:** `packages/ui/src/elements/Table/DefaultCell/fields/Status/index.tsx`, `packages/ui/src/elements/Table/DefaultCell/fields/Status/index.scss`, `packages/ui/src/elements/Table/DefaultCell/index.tsx`

- The `_status` column in list views now renders as styled tinted badge pills instead of plain text
- **Published** → green badge (subtle green background, green text)
- **Draft / Changed** → yellow/amber badge (subtle yellow background, yellow text)
- Works in both light and dark mode via `[data-theme]`
- Uses Payload's `--style-radius-s` CSS variable for consistent border radius

---

## Configuration/Documentation

### 18. Fork Development Workflow

**Files:** `FORK-DEVELOPMENT.md`, `.gitignore`

- Documentation for building and using the fork locally

---

## Summary

| Category      | Count |
| ------------- | ----- |
| Bug Fixes     | 4     |
| Features      | 16    |
| Documentation | 1     |
