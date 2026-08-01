# Fork Changes

## Upstream sync log

- **2026-06-04 — synced to upstream `v3.85.0`** (from `v3.76.1`, 378 upstream commits). Merged the `v3.85.0` tag into `app-v3.85.0`. 56 conflicts resolved: 45 i18n files (kept the fork's deliberate string overrides — media wording #31, `Published · Edited` #47, progress-`%` #14, folder-assign keys #20, `saveAndAdd` #45 — while taking upstream's new keys and re-translations), 11 code files hand-merged against their fork-change entries. **Change #2 (Folder View create-button swap) was dropped — upstream independently fixed the same mislabel bug, so the fork's version is obsolete.** Build green (45/45, incl. type-check). New fork releases on this line are versioned `v3.85.0.x`.

## Bug Fixes

### 1. Tab ID State Key Fix

**File:** `packages/ui/src/forms/fieldSchemasToFormState/addFieldStatePromise.ts`

Fixed tab condition state tracking for nested tabs. Previously used just `field.id`, now uses `parentPath.field.id` for array items. This fixes tabs inside arrays not properly tracking their condition state.

### 2. Folder View "Create" Buttons Swapped — DROPPED (absorbed upstream in v3.85.0)

**File:** `packages/ui/src/views/CollectionFolder/index.tsx`

The "Create Document" and "Create Folder" buttons were swapped/mislabeled in the empty folder state. Fixed so correct labels match correct actions.

**Status:** Obsolete as of the v3.85.0 sync — upstream independently fixed the same mislabel (its folder/document buttons are correctly paired and styled). The fork's override was dropped and upstream's version taken wholesale; nothing fork-specific remained in this file.

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

### 46. List Status Cell Shows "Changed" After Explicit Unpublish

**File:** `packages/next/src/views/List/enrichDocsWithVersionStatus.ts`

A doc that was published and then explicitly unpublished via the Unpublish action showed **"Changed"** in the list view status cell instead of **"Draft"**. Root cause: `enrichDocsWithVersionStatus` checked the `versions` table for any record with `version._status: 'published'`. That query doesn't distinguish between "doc currently published with pending draft edits" (true "Changed") and "doc was previously published but has since been unpublished" (should be "Draft") — unpublish writes a new draft version record without removing or flagging the old published ones, so both states look identical from the versions table alone.

Fix: query the main collection table (committed state, no `draft: true` flag) for `_status === 'published'` instead of querying the versions table. The main table IS a reliable signal because of how `update.ts` handles writes:

| Scenario                           | `main._status`                                                                  | latest `version._status` |
| ---------------------------------- | ------------------------------------------------------------------------------- | ------------------------ |
| Published + pending autosave draft | `published` (autosave leaves main alone since `isSavingDraft === true`)         | `draft`                  |
| Published → unpublished            | `draft` (unpublish runs with `isSavingDraft === false`, so main is overwritten) | `draft`                  |

Querying the main collection for `_status: 'published'` cleanly separates the two — only the autosave case matches, so only that case renders "Changed". A genuinely unpublished doc correctly renders "Draft".

Zero schema changes, zero write-side changes, no migration — it's a one-query swap on the read path. Version history is preserved exactly as-is; old published version records remain untouched.

### 47. Clearer "Changed" Status Label — `Published · Edited`

**Files:** `packages/translations/src/languages/*.ts` (all 44 language files)

The list view status pill showed **"Changed"** for docs that were published with pending draft edits. That label is ambiguous — _changed how?_ / _changed from what?_ / is it live or not? — and hides the two facts that actually matter to the merchant: (1) customers are still seeing a published version, (2) there are unpublished edits waiting.

Swapped the `version:changed` label from a one-word state ("Changed" / "Modificado" / "Alterado" / "変更済み" / ...) to a compound form that makes both halves explicit: `Published · Edited`. The compound form says exactly what it means: the doc is live AND has been edited since the last publish.

Applied across all 44 language files in `packages/translations/src/languages/`, using each locale's existing translation of `published:` as the first half. Examples:

| Locale | Before       | After                          |
| ------ | ------------ | ------------------------------ |
| `en`   | Changed      | Published · Edited             |
| `es`   | Modificado   | Publicado · Editado            |
| `pt`   | Alterado     | Publicado · Editado            |
| `fr`   | Modifié      | Publié · Modifié               |
| `de`   | Geändert     | Veröffentlicht · Bearbeitet    |
| `it`   | Modificato   | Pubblicato · Modificato        |
| `ja`   | 変更済み     | 公開済み · 編集済み            |
| `zh`   | 已更改       | 已发布 · 已编辑                |
| `ru`   | Изменено     | Опубликовано · Отредактировано |
| `ar`   | تمّ التّغيير | منشور · معدَّل                 |
| ...    | ...          | ...                            |

The pill container is content-sized (`padding: 2px 6px`, no `max-width`) so the longer label fits without layout changes.

### 49. `BulkDelete` Slot on `admin.components.views.list`

**Files:** `packages/payload/src/admin/elements/BulkDelete.ts` (new), `packages/payload/src/admin/types.ts`, `packages/payload/src/collections/config/types.ts`, `packages/payload/src/admin/views/list.ts`, `packages/payload/src/bin/generateImportMap/iterateCollections.ts`, `packages/next/src/views/List/renderListViewSlots.tsx`, `packages/ui/src/views/List/index.tsx`, `packages/ui/src/views/List/ListSelection/index.tsx`, `packages/ui/src/views/List/ListHeader/index.tsx`, `packages/ui/src/views/List/GroupByHeader/index.tsx`

The list-view companion to change #48. Previously the bulk-delete action on the list selection bar was hardcoded to the native `<DeleteMany>` component — projects wanting collection-specific confirmation copy (e.g. "deleting these offers will remove customer access to the bundled products") had no replacement point.

Added a `BulkDelete` slot under the existing `views.list` namespace (sibling of `titleActions` from change #30):

```ts
admin: {
  components: {
    views: {
      list: {
        BulkDelete: '@/components/admin/bulk-delete-with-confirm.client',
      },
    },
  },
}
```

Wired through the same way as the edit-view `DeleteButton` slot (change #48): server resolves the custom component in `renderListViewSlots.tsx`, `ListViewSlots` type carries it, `DefaultListView` destructures it and threads to `<CollectionListHeader>` (in the default list view) and `<ListSelection>` (in the PageControls area for small screens). `CollectionListHeader` threads it to its own `<ListSelection>`, and `GroupByHeader` accepts it for groupBy-enabled collections. `ListSelection` wraps the default `<DeleteMany>` render in `<RenderCustomComponent CustomComponent={CustomBulkDelete} Fallback={<DeleteMany />} />`.

Scope: **collection-only**, not globals (singletons don't have a list view).

No default strings baked in — the slot is a pure abstraction point. The consuming project's custom component owns the dialog copy and confirmation flow. Since Payload's own `<DeleteMany>` already uses the public `ConfirmationModal` from `@payloadcms/ui`, a well-behaved custom component can reuse the same modal primitive and just swap the body text — matches admin chrome automatically.

---

### 48. `DeleteButton` Slot on `admin.components.edit`

**Files:** `packages/payload/src/admin/elements/DeleteButton.ts` (new), `packages/payload/src/admin/types.ts`, `packages/payload/src/collections/config/types.ts`, `packages/next/src/views/Document/renderDocumentSlots.tsx`, `packages/ui/src/elements/DocumentControls/index.tsx`, `packages/ui/src/views/Edit/index.tsx`

Previously, Payload exposed `PublishButton`, `UnpublishButton`, `PreviewButton`, `SaveButton`, and `SaveDraftButton` as replaceable component slots on `admin.components.edit`, but the Delete action was hardcoded to the native `DeleteDocument` component inside `DocumentControls`. Projects that wanted to customize the delete confirmation UI (collection-specific warning copy, custom dialog shell, etc.) had no way to replace it without forking the UI package.

Added a matching `DeleteButton` slot on the collection config:

```ts
admin: {
  components: {
    edit: {
      DeleteButton: '@/components/admin/delete-with-confirm.client',
    },
  },
}
```

Wired through the same way as `UnpublishButton`: server resolves the custom component in `renderDocumentSlots.tsx`, `DocumentSlots` type carries it, `DocumentViewClientProps` picks it up (via `DocumentSlots` extension), `DefaultEditView` destructures it, `DocumentControls` accepts it as `customComponents.DeleteButton` and renders it via `RenderCustomComponent` with the native `<DeleteDocument>` as the fallback.

Scope: **collection-only**, not globals. Globals are singletons and can't be deleted.

No default strings baked in — the slot is a pure abstraction point. The consuming project's custom component owns the dialog copy, the i18n keys, and the confirmation flow entirely. This matches the project-preferred pattern: abstract the UI customization surface in the fork, define strings per-collection in the consuming app.

---

### 51. Array Field — Disable (Not Hide) Add-Row Button in Read-only Mode

**File:** `packages/ui/src/fields/Array/index.tsx`

The `Array` field hid the "+ Add Row" button entirely when `readOnly === true` (`{!hasMaxRows && !readOnly && !hideAddButton && <Button>...}`). That contradicted the `Blocks` field's behavior, which renders the same affordance with `disabled={readOnly || disabled}` so the button stays in place but is inert.

**Bug:** Inconsistent UX between the two fields. Read-only viewers of an Array see the whole Add-Row slot disappear (creating a visible empty gap below the field description), while read-only viewers of a Blocks field see a disabled "+ Add Block" button. Consuming projects ended up shipping sibling `type: 'ui'` placeholders just to fill the gap left by the hidden Array button.

**Fix:** Drop the `!readOnly` term from the JSX guard and pass `disabled={readOnly || disabled}` to the `Button` (mirroring the Blocks pattern). Also early-return from the `onClick` handler when `readOnly || disabled` is truthy — belt-and-braces guard so even if a custom button style somehow remains clickable, no row is appended.

```tsx
// Before
{!hasMaxRows && !readOnly && !hideAddButton && (
  <Button disabled={disabled} onClick={() => { void addRow(value || 0) }}>
    {t('fields:addLabel', ...)}
  </Button>
)}

// After
{!hasMaxRows && !hideAddButton && (
  <Button
    disabled={readOnly || disabled}
    onClick={() => {
      if (readOnly || disabled) return
      void addRow(value || 0)
    }}
  >
    {t('fields:addLabel', ...)}
  </Button>
)}
```

Cross-field consistency with `Blocks` is the goal — both fields now follow the same "disable, don't hide" pattern for the add-row affordance. No new props, no schema change, no migration; consuming projects that previously rendered workaround placeholders alongside arrays can drop them.

---

### 50. `SetStepNav` Stale on Browser Back/Forward Navigation

**File:** `packages/ui/src/elements/StepNav/SetStepNav.tsx`

`SetStepNav` is the side-effect component that pushes a breadcrumb trail into the admin's `StepNavProvider` context. It uses `useEffect` to call `setStepNav(nav)`, with `[setStepNav, nav]` as the dependency array.

**Bug:** On browser back/forward navigation, the trail can render empty (or stuck on the previously visited page's breadcrumbs). Reproduces reliably on custom views: navigate forward via a breadcrumb link, then hit browser back — the destination page's breadcrumbs disappear even though `<SetStepNav nav={[...]}>` is rendered in its tree.

**Cause:** Next.js App Router restores cached RSC payloads on back/forward navigation. When React reconciles the restored tree, it may preserve the `SetStepNav` component instance (same JSX position, same nav reference identity from the server-rendered payload) — so `useEffect` doesn't consider the deps changed and doesn't re-fire. The context state still holds whatever the LAST page wrote (often empty for native list views that don't render `SetStepNav` at all).

**Fix:** Add `usePathname()` from `next/navigation` as an additional `useEffect` dependency. Pathname changes on every navigation, including back/forward, forcing the effect to re-fire and re-register the trail.

```tsx
const pathname = usePathname()

useEffect(() => {
  setStepNav(nav)
}, [setStepNav, nav, pathname])
```

Why `usePathname` is safe to add: `next/navigation` is already a peer dep of `@payloadcms/ui` (used by `providers/SearchParams`, `providers/RouteTransition`, `providers/Params`). The hook returns the current pathname client-side and updates on every soft navigation. No runtime change for forward navigation; only side effect is the effect re-firing on previously-broken back/forward transitions.

Affects every admin view that registers breadcrumbs via `<SetStepNav>` — including all custom views in consuming projects.

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

### 54. Bulk-Upload "Add Files" Empty State — Iconographic Dropzone

**Files:** `packages/ui/src/elements/BulkUpload/AddFilesView/index.tsx`, `packages/ui/src/elements/BulkUpload/AddFilesView/index.scss`

The bulk-upload drawer's empty state rendered a `subtle` "Select media" button plus a lowercase "or drag and drop media" line, flex-centered inside a full-height dotted dropzone. With nothing to anchor the eye, the content read as a tiny cluster floating in a large void — visually barren and easy to miss that the whole rectangle is a drop target.

Restyled to a proper centered empty-state, matching the single-upload field's tone:

- Added the lucide-react `cloud-upload` glyph (inlined as raw SVG — the fork can't import lucide) as a ~2× muted visual anchor (`--theme-elevation-400`, sized via `calc(var(--base) * 2)`, stroked with `currentColor`). Inlined rather than reusing the shared `UploadIcon` (change #33) — that icon is the bare up-arrow used on the list-header "Bulk Upload" button, where it should stay; the empty-state hero wants the softer cloud glyph to match the project's lucide iconography.
- Promoted the drop gesture to a headline: `upload:dragAndDrop` ("Drag and drop media") now renders as a weighted `--theme-elevation-800` line instead of being buried in the lowercase helper text.
- Kept the `subtle` "Select media" button (`upload:selectFile`) as the secondary affordance below the headline.
- Removed the redundant `general:or` + `upload:dragAndDrop` helper paragraph (the gesture is now the headline) and its `__dragAndDropText` style.

Layout is icon → headline → button, stacked and centered via a new `__content` wrapper; `.dropzone` gains `align-items: center`.

**No new i18n keys** — reuses the existing `upload:dragAndDrop` and `upload:selectFile` strings (both already "media"-worded from change #31), so all 44 locales are covered with zero translation work. No new props, no API surface change — pure presentation.

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

### 45. "Save & Add" Behavior in DocumentDrawer

**Files:** `packages/ui/src/elements/DocumentControls/index.tsx`, `packages/ui/src/elements/DocumentDrawer/DrawerContent.tsx`, `packages/ui/src/elements/DocumentDrawer/Provider.tsx`, `packages/next/src/views/Document/index.tsx`, `packages/translations/src/languages/*.ts`, `packages/translations/src/clientKeys.ts`

When a document is opened in a `DocumentDrawer` (e.g., from a relationship field):

- **Create mode:** Shows "Save & Add" button instead of Publish/SaveDraft — saves the document and auto-closes the drawer. The `onSave` callback fires before close so the parent can add the relationship.
- **Edit mode:** Shows standard "Save" button (no "& Add" since the item is already in the relationship).
- **Autosave:** Disabled in drawers — no background saves while editing inline.
- **No auto-draft in drawers:** Skips the server-side auto-draft creation for `autosave + drafts` collections when inside a drawer. The document is only created when the user explicitly clicks "Save & Add".
- **Draft-enabled collections:** Saved as draft (user can publish later from the collection list).
- **Non-draft collections:** Saved normally.
- **Dot menu:** Hidden in create drawers (no Create New / Duplicate / Delete for a document being created).

This applies universally to all DocumentDrawers, not just specific collections.

Changes:

- `Document/index.tsx`: Skip auto-draft creation when `drawerSlug` is present (`!drawerSlug` added to condition).
- `DocumentControls`: When `isInDrawer`, renders only `SaveButton` (with "Save & Add" label for create, default "Save" for edit). Hides `PublishButton`, `SaveDraftButton`, `Autosave`, and dot menu (in create drawers). Removed "Create New" from the dot menu globally — Duplicate and Delete remain.
- `DrawerContent.onSave`: On create, closes the drawer (`closeModal`) instead of reloading with the new document (`getDocumentView`). Calls `onSaveFromProps` before closing. Uses `isCreateDrawer` (based on original `docID` prop) instead of `operation` to handle draft+autosave collections correctly.
- `Provider.tsx`: Added `isCreateDrawer` to drawer context type and value.
- Added `general:saveAndAdd` translation key to all 44 language files and `clientKeys.ts`.

---

### 46. `payload.validate()` — Dry-Run Field Validation Without Database Writes

**Files:** `packages/payload/src/collections/operations/validate.ts` (new), `packages/payload/src/collections/operations/local/validate.ts` (new), `packages/payload/src/index.ts`

New local-API method `payload.validate({ collection, id, data, operation, user, overrideAccess })` that runs field-level validation for a hypothetical create/update **without touching the database, opening a transaction, or invoking hooks with side effects**. Throws `ValidationError` (already exported from `payload`) on field validation failure; resolves to void on success.

Composes the existing internal `beforeChange` field-validation function (`packages/payload/src/fields/hooks/beforeChange/index.ts`) — the same step the real `update` operation runs prior to writing — but exposed as a standalone public operation that has no write code path.

**Use case:** pre-flight cascade publishes. Before kicking off a multi-doc publish loop, ask each draft "would publishing you pass required-field validation?" without actually attempting (and partially completing) the publish. Avoids the partial-state mess of "5 of 8 published, 3 failed mid-loop and stayed draft" when one of the children has missing required fields.

```ts
import { ValidationError } from 'payload'

try {
  await payload.validate({
    collection: 'products',
    id: productId,
    data: { _status: 'published' },
    overrideAccess: false,
    user,
  })
  // would publish cleanly
} catch (err) {
  if (err instanceof ValidationError) {
    // err.data.errors is [{ path, message, label? }, ...]
  }
}
```

Signature mirrors `payload.update({ id, ... })` minus everything write-related. Defaults: `operation: 'update'`, `overrideAccess: false`.

**Notes / scope:**

- Runs **only field-level** `beforeChange` validation (where required-field checks and per-field validators live). Collection-level `beforeValidate` / `beforeChange` hooks are intentionally skipped — they may have side effects unsafe in a dry run. Document this constraint at the call site if hook-based validation is critical.
- The existing doc is fetched with `overrideAccess: true` so callers can validate even without read perms; access control on the validate call itself is enforced via `overrideAccess` passed through to `beforeChange` (mirroring `update`).
- Pure CPU after the single `findByID` read. No transaction begin/commit/rollback overhead.

---

### 52. Skip `initI18n` Memoization in Development for Hot-Reload

**File:** `packages/translations/src/utilities/init.ts`

`initI18n` is wrapped in `memoize(impl, ['language', 'context'])` so the merged-translations + dateFNS init runs once per `(language, context)` pair and the result is cached forever in module scope. In production this is desirable — translations don't change at runtime.

In development this defeats hot-reload of project-side locale edits: even if the consumer rebuilds `config.translations` from fresh-on-disk JSON, `initI18n` returns the first-ever cached `I18n` (with its captured `t` closure over the stale `mergedTranslations`) and the new strings never reach Payload admin without a full Next.js restart.

Fix: short-circuit `memoize` to return `fn` directly when `process.env.NODE_ENV === 'development'`. Dev hits the impl on every call — fresh merge from `config.translations[language]` each request, so JSON edits flow through with just a browser refresh. Prod behavior unchanged (cache map populated as before).

Required for projects that build `config.translations[language]` lazily (e.g., via a Proxy that re-reads JSON from disk in dev). Without this patch the lazy build is wasted — the memoize layer caches the very first result.

---

### 53. Defer `config.i18n.translations` Editor Merge in Development

**Files:** `packages/translations/src/utilities/mergeForDevHotReload.ts` (new), `packages/translations/src/exports/utilities.ts`, `packages/payload/src/config/sanitize.ts`, `packages/payload/src/fields/config/sanitize.ts`, `packages/payload/src/index.ts`, `packages/payload/src/exports/shared.ts`, `packages/richtext-lexical/src/index.ts`

Sibling of #52. Multiple places in Payload's setup pipeline eagerly merge their own i18n contributions into the project-supplied `config.i18n.translations`:

1. Root sanitize, editor-level — `packages/payload/src/config/sanitize.ts`
2. Per-field sanitize, field-level editor — `packages/payload/src/fields/config/sanitize.ts`
3. Lexical feature i18n — `packages/richtext-lexical/src/index.ts`

Each used `deepMergeSimple(config.i18n.translations, X)` which **walks the project's Proxy-backed translations and writes back a plain-object snapshot**. For a project that supplies a Proxy-backed translations object (so each `[lang]` access re-reads fresh JSON from disk in dev), this defeats change #52 — the next `initI18n` call reads the snapshot and project-side strings freeze until restart.

Fix: introduce `mergeForDevHotReload(original, additional)` in `@payloadcms/translations/utilities`. In dev it returns a Proxy that defers `deepMergeSimple` to per-`[lang]` access, preserving the chain of Proxies all the way back to the project's reactive translations. In prod it falls through to eager `deepMergeSimple` — identical behavior, no overhead. Replace all three call sites above. The chain composes safely: each layer wraps the previous, per-`[lang]` access cascades through every wrapper back to the original Proxy.

Required for the same use case as #52: projects with Proxy-backed translations need all of these patches to fully hot-reload locale JSON without server restart.

---

### 55. Externalize `focus-trap` in the `@payloadcms/ui` Client Bundle

> Cherry-picked from `app-v3.76.1` (where it is #54) via fork change c53c41aea1; renumbered to #55 here to avoid colliding with this branch's #54 (Bulk-Upload empty state).

**Files:** `packages/ui/bundle.js`, `packages/ui/package.json`

The esbuild client bundle (`dist/exports/client`) inlined `@faceless-ui/modal`'s `focus-trap` dependency, giving the admin a **private copy of focus-trap with its own module-level trap stack**. focus-trap's stacking contract — activating a new trap pauses the currently active one — only works within one module instance, so any project-side overlay using its own `focus-trap` import (e.g. a Radix dialog with a companion trap, stacked over a Payload drawer) could never pause the drawer's trap. The drawer's capture-phase `focusin` handler then revokes every focus attempt inside the overlay: clicks work (`allowOutsideClick: true`) but text inputs can't hold focus, making typing impossible.

Fix: add `'focus-trap'` to the client bundle's `external` list so the compiled output emits `import ... from 'focus-trap'` and shares the consuming app's single module instance (one trap stack); add `focus-trap@7.5.4` (the exact version `@faceless-ui/modal@3.0.0` pins) to `dependencies` so resolution doesn't rely on hoisting.

Consumer contract: a project component stacking a focusable overlay over a Payload drawer should activate a passive `focus-trap` (`initialFocus: false`, `returnFocusOnDeactivate: false`) on the overlay's content node for the time it is mounted — the drawer's trap pauses while the overlay is open and resumes on close. See varig `src/components/ui/dialog.tsx`.

---

### 56. Compound Indexes on Polymorphic Relationship Sub-Paths (`item.relationTo`)

> Cherry-picked from `app-v3.76.1` (where it is #55, commit f109b9a166); renumbered to #56 here to avoid colliding with this branch's #55 (focus-trap externalization).

**File:** `packages/payload/src/collections/config/sanitizeCompoundIndexes.ts`

A collection-config compound index cannot reference the stored sub-paths of a polymorphic relationship — `indexes: [{ fields: ['store', 'item.relationTo', 'slug'], unique: true }]` throws `InvalidConfiguration: Field item.relationTo was not found` at boot, because `sanitizeCompoundIndexes` resolves every path through `getFieldByPath`, and `relationTo` / `value` are properties of the polymorphic value shape, not fields. This makes it impossible to express "unique per related collection" — e.g. a slug registry where products and offers each get their own namespace per store.

Fix: when `getFieldByPath` returns null and the path's final segment is `relationTo` or `value`, resolve the parent path instead; if the parent is a polymorphic relationship/upload field (`relationTo` is an array), accept the path, carrying the parent's localization info (`localizedPath` becomes e.g. `item.<locale>.relationTo`). The sanitized entry keeps the original dotted `path`, which `db-mongodb`'s `buildSchema` already uses verbatim for `schema.index(...)`, and `buildVersionCompoundIndexes` prefixes with `version.` as usual. All other paths still throw exactly as before.

**MongoDB adapter only.** SQL adapters (drizzle) store polymorphic relationships in a separate rels table; such an index config was a boot error before this change and remains unsupported on SQL — it will now reach the drizzle schema builder unvalidated, so don't use it there.

First consumer: varig's `slugs` collection (`{ fields: ['store', 'item.relationTo', 'slug'], unique: true }`), replacing a wrong per-store-global `['store', 'slug']` unique index that rejected a product and an offer sharing a name.

---

### 57. Dispatch `admin:hashchange` After Hash-Tab `replaceState`

**File:** `packages/ui/src/fields/Tabs/index.tsx`

Hash-based tab navigation (change #8) writes the active tab's hash via `window.history.replaceState`, which fires **no native event** — `hashchange` only fires on real navigations. Consuming-app components that derive UI from `window.location.hash` (e.g. varig's sidebar nav highlighting the active settings tab) had no way to observe a tab click; they only stayed in sync by accident, via Next.js's patched `replaceState` changing `useSearchParams()` identity.

Fix: after the `replaceState` in `handleTabChange` (both the set-hash and clear-hash branches), dispatch `window.dispatchEvent(new Event('admin:hashchange'))`. The event name is hardcoded — the fork can't import the consuming app — and is a cross-repo contract: varig's `src/lib/admin/replace-hash.js` exports the same string (`AdminHashChangeEvent`) and its own `replaceHash()` writer dispatches it too, so any subscriber listening for `hashchange` + `popstate` + `admin:hashchange` sees every hash write regardless of who wrote it.

No behavior change for apps that don't listen; one extra no-listener event dispatch per tab click.

---

### 58. `hideTabs` on DocumentDrawer — trim field-level tabs in the in-drawer edit view

**Files:** `packages/ui/src/elements/DocumentDrawer/types.ts`, `packages/ui/src/elements/DocumentDrawer/Provider.tsx`, `packages/ui/src/elements/DocumentDrawer/DrawerContent.tsx`, `packages/ui/src/fields/Tabs/index.tsx`

New `hideTabs?: string[]` prop on `DocumentDrawer` — hides field-level tabs by their `hash` while a document is open in that drawer, without touching the collection schema or the full-screen edit view.

- Flows through the same path as `allowedMimeTypes` / `drawerContext` (change #44): `DocumentDrawerProps` (types.ts) → `DocumentDrawerContent` destructure (DrawerContent.tsx) → `DocumentDrawerContextProvider` → `DocumentDrawerContextProps` (Provider.tsx, available via `useDocumentDrawerContext()`).
- The `Tabs` field reads it with `useOptionalDocumentDrawerContext()?.hideTabs` and folds `hash ∈ hideTabs` into each tab's `passesCondition`. Because every downstream behavior already keys off `passesCondition`, a hidden tab is uniformly excluded: it is not the initial tab, is unreachable by URL hash (falls back to the first visible tab), is not rendered, and the auto-switch effect moves off it if it becomes hidden.
- Outside a drawer there is no context, so `hideTabs` is `undefined` and the full tab set renders unchanged — zero behavior change for the standard edit view.

```tsx
// Reduced quick-create drawer: hide the Page builder + Access tabs
<DocumentDrawer collectionSlug="offers" hideTabs={['page', 'access']} onSave={handleSave} />
```

Enables a reduced create/edit flow in a drawer (e.g. varig's product "Sell" tab opening a sales page with only Details + What's Included + Pricing) while the full builder stays reachable via the full-screen view.

---

### 59. Scope hash-tab navigation to the top-level document (no drawer hash collision)

**File:** `packages/ui/src/fields/Tabs/index.tsx`

Bug fix for a drawer-vs-document collision in the hash-tab feature (changes #8 + #57). A `Tabs` field drives `window.location.hash` globally: `getTabIndexFromHash` reads it, `handleTabChange` writes it via `replaceState` + dispatches `admin:hashchange`. But a `DocumentDrawer` layers its document **over** another document whose `Tabs` field reads the **same** hash. So clicking a tab in a drawer whose `hash` collides with the underlying doc's (e.g. both an offer and a product have `content` / `appearance` tabs) wrote that hash → the underlying doc's `Tabs` field reacted and jumped tabs, desyncing/closing the drawer and wedging focus.

Fix: when the field is inside a drawer (`useOptionalDocumentDrawerContext()` is non-null — already wired for #58's `hideTabs`), it no longer participates in URL-hash navigation. `getTabIndexFromHash` returns `null` (never reads the hash), and `handleTabChange` skips the `replaceState` + `payload-tab-change` + `admin:hashchange` broadcast — tab state stays purely local (`setActiveTabIndex`). Only the top-level document owns the URL hash; deep-linking and the consuming app's hash sync are unchanged outside drawers.

Repro that's now fixed: open a product → Sell tab → New Sales Page (offer drawer) → click a tab that shares a hash with the product (e.g. Appearance) → previously the product jumped tabs behind the drawer and the UI froze; now the drawer tab switches in place.

---

### 60. Tab-level `admin.condition` actually hides the tab header (key by the tabs field's own `path`)

**File:** `packages/ui/src/fields/Tabs/index.tsx`

Bug fix: a tab-level `admin.condition` evaluated correctly server-side but **never hid the tab header** for a top-level `tabs` field, so a falsy condition left an empty, clickable tab in the bar. (The tab's _contents_ were hidden because `passesCondition` propagates to children, but the header stayed.)

Root cause is a key mismatch between the form-state writer and the renderer. The form-state builder (`addFieldStatePromise`) keys each tab's `passesCondition` under **`${tabsFieldPath}.${tab.id}`** — it passes the _tabs field's own_ `path` as the tab's `parentPath` (the tab `id` is auto-assigned during sanitize when a condition is present). But the `Tabs` renderer built its lookup key from **this component's `parentPath`** (the tabs field's _parent_), which for a top-level tabs field is `''` — so it looked up `tab.id` while the state lived under `_index-N.tab.id`. The keys never matched and `passesCondition` fell back to `?? true`, leaving the tab visible.

Fix: in the `tabStates` selector, build `fieldKey` from this component's own `path` (which equals the writer's `${tabsFieldPath}`), not `parentPath`:

```ts
// before:  const fieldKey = parentPath ? `${parentPath}.${id}` : id
const fieldKey = path ? `${path}.${id}` : id
```

The React-Compiler memo dependency for that selector follows the same swap (`parentPath` → `path`). Tabs **without** a condition are unaffected (no state entry exists at either key, so they default visible); only conditional tabs change — they now hide their header when the condition is falsy, in both top-level and nested (group/array) tabs fields. This is what makes `kind`-conditional offer tabs (varig: solo offers omit _What's Included_ + _Page_) work without a custom Tabs component.

---

### 61. `drawerContext.saveMode` — three selectable drawer save behaviors

**Files:** `packages/ui/src/elements/DocumentControls/index.tsx`, `packages/ui/src/elements/DocumentDrawer/DrawerContent.tsx`, `packages/ui/src/elements/SaveDraftButton/index.tsx`

Fork change #45 collapses **every** document drawer to a single "Save & Add" button. That's right for relationship "save and add another" flows, but wrong for a standalone create/edit drawer whose document is publishable in its own right (varig's Sell-tab "Create Offer" / "Edit offer" drawers — an offer must be published to be buyable). This makes the drawer's save behavior selectable via `drawerContext.saveMode` (`drawerContext` plumbing is from #44):

```tsx
const saveMode = drawerContextOpts?.saveMode ?? 'saveAndAdd' // absent → #45 default
const drawerDefault = isInDrawer && saveMode === 'default'
const drawerSaveAndAdd = isInDrawer && saveMode === 'saveAndAdd'
const createEditCreate = isInDrawer && saveMode === 'createEdit' && isCreateDrawer
const createEditEdit = isInDrawer && saveMode === 'createEdit' && !isCreateDrawer
```

| `saveMode`                       | Buttons                                                                              | Autosave                                  | On create-save                        |
| -------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------- | ------------------------------------- |
| `'saveAndAdd'` _(absent → this)_ | lone "Save & Add" (create) / "Save" (edit) — **#45**                                 | off                                       | close drawer                          |
| `'default'`                      | stock full-page controls (Save Draft + Publish, or autosave + Publish)               | on (`drawerDefault`)                      | **reload** (stay open, like upstream) |
| `'createEdit'`                   | create: **Save Draft + Publish** (labels via `createLabels`); edit: lone **Publish** | create: off · edit: on (`createEditEdit`) | close drawer                          |

Because the absent default is `'saveAndAdd'`, every existing relationship drawer is unchanged. The mode is **per-drawer, not per-collection**: `products` autosaves but its series "New Product" relationship drawer stays `'saveAndAdd'`; only varig's offer drawers opt into `'createEdit'`.

**Why `'createEdit'` splits create vs edit.** Autosave needs a document id. A create drawer has none — #45 skips the server-side auto-draft (`!drawerSlug` in `Document/index.tsx`), so autosave would spin forever on "Saving…". So create uses explicit Save Draft + Publish buttons (write on click, no auto-draft); edit has an id, so autosave runs and the controls collapse to a lone Publish, like the full page (stays open after publish).

**`'default'` caveat.** `'default'` reproduces upstream button-for-button and is fully faithful for **non-autosave** drafts collections. For an **autosave** collection, upstream's autosave only works because the server auto-creates the draft — which #45 removed in drawers and the server view never receives `saveMode` to conditionally restore. So in a `'default'` autosave drawer the autosave indicator shows but won't persist; use `'createEdit'` for autosave collections. (Restoring the auto-draft would mean threading `saveMode` into `renderDocument` → `Document/index.tsx` and reintroduces the empty-draft-on-cancel litter #45 removed — deliberately deferred.)

Wiring details:

- Autosave gate: `(!isInDrawer || drawerDefault || createEditEdit) && …` on the `<Autosave>` render.
- Close-on-create-save (`DrawerContent.onSave`): `'default'` reloads via `getDocumentView(doc.id)`; the others `closeModal`.
- `SaveDraftButton` gained an optional `label?: string` prop (mirrors `PublishButton`); `DocumentControls` passes `createLabels.saveDraft`/`.publish` to the Fallback buttons. When the collection registers a **custom** PublishButton (varig's cascade-publish), `RenderCustomComponent` renders the server-resolved element and can't receive a label prop, so that custom client component reads `useOptionalDocumentDrawerContext()?.drawerContext.createLabels.publish` itself (gated on `isCreateDrawer`).

History: v3.85.0.3 publish gate; v3.85.0.4 (autosave-in-_create_-drawer) **broken — do not use**; v3.85.0.5 `showSaveDraftButton` flag; v3.85.0.6 `fullSaveControls` boolean create/edit model; **v3.85.0.7** generalizes it to the `saveMode` enum above (current release). `fullSaveControls: true` is replaced by `saveMode: 'createEdit'`.

---

### 62. Dark is the default theme — no system/OS theme

**Files:** `packages/ui/src/providers/Theme/index.tsx`, `packages/next/src/utilities/getRequestTheme.ts`

Upstream's theme model is "light default + auto/system (prefers-color-scheme)". The product decision is **dark by default, with light as an explicit opt-in via the account menu, and no system theme at all**. Upstream's auto behavior also caused a **light-then-dark flash on every full page load** in our setup: the server can only honor the OS preference via the `Sec-CH-Prefers-Color-Scheme` client hint, which browsers withhold in non-secure contexts (dev over plain HTTP / a LAN hostname) and don't send on the first paint. So SSR fell back to light, then the client's `matchMedia` flipped it to dark after hydration.

Changes:

- **`defaultTheme` is now `'dark'`** (was `'light'`) and is hoisted above `getTheme` so the client resolver can reference it.
- **`getTheme` (client):** an absent/invalid theme cookie resolves to `defaultTheme` instead of `window.matchMedia('(prefers-color-scheme: dark)')`.
- **`setTheme('auto')` (client):** still clears the cookie, but reverts to `defaultTheme` rather than reading the OS. (Varig's account menu only offers light/dark, so this path is effectively dead, but kept consistent.)
- **`getRequestTheme` (SSR):** drops the `Sec-CH-Prefers-Color-Scheme` header branch entirely. Theme is resolved from a pinned `admin.theme` or the explicit theme cookie only, else `defaultTheme`. This makes the server-rendered `data-theme` deterministic — no flash.

Net effect: with no cookie, both SSR and client render dark immediately and agree, so there's no flash; the menu's light choice writes the cookie and is honored on the next SSR. The now-unused `Accept-CH` / `Critical-CH` client-hint response headers in `withPayload.js` are harmless and left in place (removing them is optional cleanup).

---

### 63. `urlParam` supports `hasMany` fields — coerce a single query value into an array

**Files:** `packages/ui/src/forms/fieldSchemasToFormState/index.tsx`, `packages/next/src/views/Document/index.tsx`

Extends the field-level URL parameter defaults (#10) so a `hasMany` field can be seeded from a single query param. A URL query value is always a scalar string, but a `hasMany` field (a relationship/array list) needs an array — so before #63, `?products=<id>` was silently dropped on create (a string isn't a valid hasMany value). Now a single urlParam value targeting a `hasMany` field is coerced into a one-element array (`['<id>']`); values that are already arrays and all scalar (non-hasMany) fields are untouched.

Both seed paths are covered, mirroring #10:

- **Form-state stamp** (`fieldSchemasToFormState`) — the `urlParamToFieldPath` map now records each field's `hasMany` flag alongside its path, and the apply step wraps a scalar value when `hasMany` is true. (Covers non-autosave create renders.)
- **Autosave create-data merge** (`Document/index.tsx`) — after the `{ ...initialData, ...defaultValues }` merge, a walk over the collection's fields coerces any `hasMany` urlParam value into an array (and remaps the query-param key to the field name when they differ). This is the live path for autosave collections, which create the draft server-side and redirect before the form renders.

Motivating use: the varig "Create New Bundle" CTAs on a product's Sell tab pass `?kind=bundle&products=<id>` so the new bundle is born with that product already in its "What's Included" relationship list.

---

### 64. Preserve the URL fragment across the post-create redirect

**Files:** `packages/ui/src/views/Edit/index.tsx`

When an autosave collection is created, the Edit view redirects from the create URL to the new doc's edit URL (`router.push`) once the first save returns an id. The redirect target was built fragmentless — `/collections/<slug>/<id>[?locale=]` — so any URL hash on the create URL was silently dropped on the hop.

That hash is meaningful: Payload's `Tabs` field reads `window.location.hash` on mount (and via a `hashchange` listener) to auto-select the tab whose `hash` matches. A create URL like `…/create?kind=bundle&products=<id>#products` should land the new bundle on its "What's Included" tab — but the fragment never survived the redirect, so the doc always opened on the first tab.

Fix: capture `window.location.hash` just before building `redirectRoute` and append it to the path. Empty string when there's no fragment (unchanged behavior for every normal create). Sibling to #63: #63 seeds the doc from the query, #64 lets the same create URL land it on the relevant tab.

Motivating use: the varig "Create New Bundle" flow drops its transient "product added" banner + its `localStorage` handoff in favor of `…?kind=bundle&products=<id>#products` — the product visibly sitting in the pre-selected "What's Included" list is the confirmation, no client glue.

---

### 65. Preserve sticky query params (prefixed `_`) across the server-side post-create redirect

**Files:** `packages/next/src/views/Document/index.tsx`

For **autosave** collections, the create page creates the draft server-side and redirects to the new doc's edit URL via `next/navigation.redirect()`. That redirect URL was built bare (path only), so any query param on the create URL was lost. This change appends query params prefixed with `_` to the redirect URL. Create-page-only params (`kind=`, `products=`, etc.) are NOT prefixed and are dropped as before. The URL fragment (`#...`) is preserved automatically by the browser across HTTP redirects — no handling needed.

Any feature can add a `_`-prefixed param to the create URL and read it on the edit page after the redirect — no per-param fork changes needed.

Scope: server-side (autosave) path only. The client-side `onSuccess` redirect (`packages/ui/src/views/Edit/index.tsx`) is NOT touched — autosave collections never reach it (the server `redirect()` fires first), and no non-autosave create flow currently uses sticky params. Sibling to #64, which preserves the fragment on the client redirect.

Motivating use: the varig "Create New Bundle" flow adds `_fromProduct=true` to the create link (offers is an autosave collection, so the server redirect carries it). The bundle edit page reads it to fire a one-shot toast with the product's name, then strips it via `history.replaceState` so it can't re-fire on refresh.

---

### 66. `admin.bare` on group fields — suppress chrome (border/padding/margin)

**Files:** `packages/ui/src/fields/Group/index.tsx`, `packages/ui/src/fields/Group/index.scss`

A new `admin.bare: true` option on `type: 'group'` fields that suppresses the group's visual chrome — border, padding, negative margins, gutter indent — via a single `--bare` modifier class. The group renders as a bare container for its child fields, useful when nesting a group inside a `type: 'row'` for side-by-side layouts where the group's border/padding would break the flush row alignment.

Before this, consumers zeroed out chrome via inline `admin.style` overrides (`border: 'none', padding: 0, ...`), which is fragile against Payload DOM/CSS upgrades — the inline style targets specific CSS properties that a new Payload version could rename or restructure. `admin.bare` is a semantic opt-in that survives upgrades because it controls the class, not the CSS properties.

Implementation: one new class `group-field--bare` added to the component's className array (gated on `admin.bare`), and one SCSS rule that zeroes `margin`, `padding`, and `border`. No effect on groups that don't set `bare: true`.

### 67. Close X button on ConfirmationModal + export CloseModalButton

**Files:** `packages/ui/src/elements/ConfirmationModal/index.tsx`, `packages/ui/src/elements/ConfirmationModal/index.scss`, `packages/ui/src/exports/client/index.ts`

Adds a close X button (using the existing `CloseModalButton` component) to the top-right corner of every `ConfirmationModal`. The button is positioned absolute inside `confirmation-modal__wrapper` (which is already `position: relative`). Also exports `CloseModalButton` from `@payloadcms/ui` so consuming apps can use it on raw `<Modal>` instances.

Before this, `ConfirmationModal` had no X — only Cancel + Confirm buttons in the footer. Users expecting a top-right close affordance had to find the Cancel button. The existing `CloseModalButton` component was already used by the List drawer header but was not exported or used in modals. The button uses `tabIndex={-1}` so the focus-trap skips it on open (Cancel or first input gets initial focus instead); keyboard users Tab past it, mouse/Esc users still reach it. Both `CloseModalButton` and the Confirm button are `disabled={confirming}` during processing — prevents closing mid-action. `CloseModalButton` now accepts a `disabled` prop. The Drawer's two close buttons (overlay + header X) also received `tabIndex={-1}` for the same focus-stealing fix.

### 68. `destructive` prop on ConfirmationModal + `error` button style

**Files:** `packages/ui/src/elements/ConfirmationModal/index.tsx`, `packages/ui/src/elements/Button/index.scss`

Adds an optional `destructive?: boolean` prop to `ConfirmationModal`. When `true`, the confirm button renders with `buttonStyle="error"` — a tinted red style (transparent bg, `--theme-error-500` border + text, `--theme-error-50` hover bg) matching the consuming app's `variant="destructive"` Button. The cancel button is unaffected (stays `secondary`). Also adds the `.btn--style-error` SCSS class to the Button component — the `error` value existed in the TypeScript types but had no corresponding SCSS, so it was effectively unstyled before this. The disabled state mutes to `--theme-error-250` border + text with no hover bg.

The consuming app (varig) pairs this with its existing `variant="destructive"` on raw `<Modal>` confirm buttons — both use `--theme-error-*` vars for the same red in light + dark.

### 69. PanelRight icon for Live Preview toggler (frees up Eye)

**Files:** `packages/ui/src/icons/PanelRight/index.tsx` (new), `packages/ui/src/icons/PanelRight/index.scss` (new), `packages/ui/src/elements/LivePreview/Toggler/index.tsx`

Replaces the `EyeIcon` in the Live Preview toggler with a new `PanelRightIcon` — a toggleable side-panel glyph (outlined rectangle + divider when inactive; right pane filled when active). The toggler's behavior is unchanged (same `active={isLivePreviewing}` prop, same aria-label/title strings); only the glyph changes.

Motivation: the consuming app (varig) standardizes on `Eye` = "open the storefront in a new browser tab" across its list / row / picker surfaces. Payload's Live Preview toggler was _also_ an `Eye`, producing two Eye glyphs on the document edit page with different meanings (toggle the in-editor iframe pane vs. open the storefront in a new tab). Swapping the pane toggler to `PanelRight` removes the collision — `Eye` is now free for the consuming app's storefront-preview affordance everywhere, and the pane toggler reads honestly as "toggle the side panel." `EyeIcon` itself is unchanged and remains available for any other consumer.

The icon follows the fork's existing hand-drawn SVG icon pattern (viewBox `0 0 16 16`, theme-driven `stroke`/`fill` classes via `currentColor`, `active` prop mirroring `EyeIcon`'s shape) — no new icon-library dependency.

---

### 70. Tabs field: skip no-op hash `replaceState` (Next server-action-queue wedge)

**Files:** `packages/ui/src/fields/Tabs/index.tsx`

The tab-change handler always called `window.history.replaceState` — `#<hash>` for hash tabs, `pathname + search` for hash-less tabs — and always dispatched `admin:hashchange`. When the write changed nothing (clicking the hash-less default tab on a hash-less URL, or re-clicking the already-active tab), that was a gratuitous `replaceState` through Next's history wrapper.

That matters because Next's wrapper schedules router bookkeeping on every call, and a no-op history write colliding with another history write in the same React commit can **wedge Next's server-action queue**: pending server-action fetches never dispatch (no request, no error — a promise that never settles), and subsequent client navigations run against the corrupted router state. Diagnosed in the consuming app (varig) 2026-07-02 via instrumented Playwright: an embed's mount-time URL-mirror write colliding with this handler's hash write froze every click-mounted tab panel's data fetch. The consuming app guarded its own writers; this entry closes the fork's half.

Fix: compute `nextHash` (`#<hash>` or `''`), and only when `window.location.hash !== nextHash` perform ONE `replaceState` of `pathname + search + nextHash` and dispatch `admin:hashchange`. Same-hash clicks now touch nothing — subscribers are already in sync, so skipping the announce event is correct by construction. Real tab transitions (including clearing the hash when moving to the default tab) behave exactly as before.

---

### 71. DocumentInfo: `externalSaving` — native save feedback for out-of-band writers

**Files:** `packages/ui/src/providers/DocumentInfo/types.ts`, `packages/ui/src/providers/DocumentInfo/index.tsx`, `packages/ui/src/elements/Autosave/index.tsx`

The `Autosave` element is both worker and display: it POSTs the form when form state changes, and renders "Saving…" / "Last saved X ago" in the document controls. Custom elements that write the document OUTSIDE the form (the consuming app's canvas editors save drafts through their own server actions — the form is deliberately not trusted with those blobs) could already update the timestamp via the public `setLastUpdateTime`, but the transient "Saving…" state was a private `useState` inside `Autosave` — unreachable, so out-of-band saves showed no native feedback and consumers duplicated their own indicators.

Fix: `DocumentInfo` gains `externalSaving: boolean` + `setExternalSaving` (plain state, exposed on the context). `Autosave` renders its saving indicator when `saving || externalSaving` and suppresses the "Last saved" line while either is up. Writers raise the flag when a save starts, clear it when the save settles, and pair it with `setLastUpdateTime` (+ the existing version-count setters) on success. Purely additive — consumers that never set the flag see identical behavior.

---

### 72. `hideCollectionLabel` on Upload field — suppress the collection pill for polymorphic relationTo

**Files:** `packages/ui/src/fields/Upload/Input.tsx`, `packages/ui/src/fields/Upload/index.tsx`

`UploadInput` hard-wires `showCollectionSlug={Array.isArray(relationTo)}` on both selected-card renderers (`UploadComponentHasOne` / `UploadComponentHasMany`): any polymorphic (array) `relationTo` shows a collection pill on the selected card. For a single-member polymorphic array — a field kept as `['media']`-style array purely to preserve the stored `{ relationTo, value }` shape — the pill is pure noise (every selectable doc is from the same collection).

Fix: new optional `hideCollectionLabel?: boolean` prop (default `false`) on `UploadInputProps` and on `UploadComponent`, threaded through the same direct-prop path as the existing `allowedMimeTypes` / `onInvalidFile` fork additions (change #11): a consumer's custom field component passes it alongside its other props and `UploadComponent` forwards it to `UploadInput`, where both `showCollectionSlug` sites become `!hideCollectionLabel && Array.isArray(relationTo)`. Purely additive — consumers that never pass it see identical behavior.

Motivating use: the consuming app (varig) narrows a polymorphic curriculum source field to `['files']` in its upload wrapper; without the opt-out every selected card carried a "Media" pill.

---

### 73. `DocumentTitle.setTitleOverride` — app-supplied rendered document title

**Files:** `packages/ui/src/providers/DocumentTitle/index.tsx`

The displayed document title is derived from a STORED field (`admin.useAsTitle`) by `formatDocTitle`, so it can only ever be one language. A document whose stored title is a fixed internal literal — a scaffolded singleton, a system-minted doc — therefore renders that literal to every admin regardless of their language, and no existing seam can change it: there is no `Title` slot in `admin.components.edit` (the slots are exactly `beforeDocumentControls`, `DeleteButton`, `editMenuItems`, `PreviewButton`, `PublishButton`, `SaveButton`, `SaveDraftButton`, `Upload`, `Status`), and the public `setDocumentTitle` is not a seam either: the provider's own `useEffect` recomputes `formatDocTitle` on every `data` / language change, and `SetDocumentTitle` re-derives from form state on every keystroke, so an app-supplied value is clobbered on the next render.

Fix: `DocumentTitleProvider` gains a second, higher-precedence layer — `titleOverride` state plus `setTitleOverride(string | null)` on the context — and publishes `title: titleOverride ?? derivedTitle`. Nothing else changes: `setDocumentTitle` and the recompute effect still own the derived layer, and a `null` override (the default) means every collection that never calls the setter behaves exactly as before. Purely additive, same shape as change #71's `externalSaving` on `DocumentInfo`: a provider-level state + setter that lets a consuming app drive native chrome instead of duplicating it.

Because the override lands in the provider rather than in one renderer, it reaches every consumer of `useDocumentTitle().title` at once — the controls-bar `RenderTitle` (`showTitleInControls`, change #18), the `SetDocumentStepNav` breadcrumb, the `DocumentDrawer` header, and the delete / permanently-delete / restore / schedule-publish modals — so the document reads with ONE name everywhere. A `Title` component slot would have been a much larger diff (core config types + client config + `renderDocument` + the Edit view + `DocumentControls`), server-rendered only, and would have fixed the controls bar while leaving the breadcrumb and the modals on the stored literal.

Consumers set it from any client component mounted inside the document (e.g. a `beforeDocumentControls` component that renders `null`):

```tsx
const { setTitleOverride } = useDocumentTitle()
const isHome = useFormFields(([fields]) => fields?.type?.value === 'home')

useEffect(() => {
  if (!isHome) return
  setTitleOverride(t('custom:admin.collections.pages.homeTitle'))
  return () => setTitleOverride(null)
}, [isHome, setTitleOverride, t])
```

Motivating use: the consuming app (varig) scaffolds each storefront's home page as a `pages` doc with the hard-coded English `title: 'Storefront'`. The stored literal must stay (it is what the API, exports and any non-admin reader see), but a pt-BR merchant has to read "Vitrine". The override renders the localized label in the admin while the stored value is untouched.

---

## Summary

Recounted 2026-06-22: 62 entry headers across the catalog. Note `#46` is used **twice** (two unrelated changes — "List Status Cell Shows Changed" and "`payload.validate()` Dry-Run"), and `#2` is **DROPPED** (absorbed upstream in v3.85.0). That leaves **62 active changes**. Category counts below are a best-effort classification — several entries straddle fix/feature (a behavior correction that also adds a prop), so treat the split as indicative, not exact. _(Updated 2026-06-29: +#69 → 63 active. Updated 2026-07-02: +#70 → 64 active. Updated 2026-07-23: +#71 → 65 active. Updated 2026-07-24: +#72 → 66 active. Updated 2026-08-01: +#73 → 67 active.)_

| Category           | Count  |
| ------------------ | ------ |
| Bug Fixes          | 20     |
| Features           | 46     |
| Documentation      | 1      |
| Dropped (absorbed) | 1      |
| **Total active**   | **67** |
