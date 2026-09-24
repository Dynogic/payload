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

### 74. `BlocksSelectionContext` — runtime row-selection mode for Blocks fields

**Files:** `packages/ui/src/fields/Blocks/SelectionContext.tsx` (new), `packages/ui/src/fields/Blocks/BlockRow.tsx`, `packages/ui/src/fields/Blocks/index.scss`, `packages/ui/src/exports/client/index.ts`

A consuming app can put a blocks field's rows into SELECTION MODE at runtime by
wrapping the field in `BlocksSelectionProvider` (exported from
`@payloadcms/ui` with `useBlocksSelection` + the `BlocksSelectionContextValue`
type). While `active`:

- the drag handle gives way to a `CheckboxInput` in the same slot (drag is
  suspended — `dragHandleProps` not passed); the CHECKBOX is the only
  selection affordance
- the header keeps its NORMAL collapse behavior (click toggles open/closed,
  chevron stays) — the checkbox wrapper re-enables pointer events above the
  full-header toggle button (the same pattern `SectionTitle`'s input uses)
  so selecting never collapse-toggles; shift-click reaches
  `toggle(path, rowId, { shiftKey })` via a passive capture ref for ranges
- row actions (`⋯`) are suppressed
- rows are identified by `(parentPath, row.id)`, so NESTED blocks fields
  (rows inside a section row's own blocks field) participate under one
  provider without id collisions
- `__row--selecting` / `__row--selected` classes style the mode (selected
  rows tint via theme elevation vars)

Selection STATE lives entirely in the consuming app — the context is a pure
conduit and holds nothing. The DEFAULT context is inactive, so every blocks
field without a provider renders byte-identically to before this change; no
`admin.*` config flag, no `types.ts` change, no import-map impact.

Single-instance caution (the #54 focus-trap lesson): the provider and the
`BlockRow` consumer must resolve to ONE compiled copy of this module — import
from `@payloadcms/ui` and verify the consuming bundle doesn't inline a second
instance.

(The interaction model was revised during live QA from an earlier
header-click-selects design: keeping the stock collapse toggle proved more
important than a bigger select target — a suspended toggle made collapsed
sections unopenable, and the pointer-transparent header needed re-enabling
just to receive clicks. The checkbox-only model needs neither.)

Future: `ArrayRow` can adopt the identical pattern if array fields ever need
selection; deliberately not built until a consumer exists.

```tsx
// Consuming app (e.g. a bulk-edit toolbar around a blocks field):
<BlocksSelectionProvider value={{ active, isSelected, toggle }}>
  {/* the blocks field renders inside */}
</BlocksSelectionProvider>
```

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

### 75. `admin.disableFormData` — per-document omission of a field from form submission

**Files:** `packages/payload/src/fields/config/types.ts`, `packages/payload/src/admin/forms/Form.ts`, `packages/payload/src/fields/config/client.ts`, `packages/payload/src/utilities/reduceFieldsToValues.ts` (+ new spec), `packages/ui/src/utilities/reduceFieldsToValuesWithValidation.ts` (+ new spec), `packages/ui/src/forms/fieldSchemasToFormState/addFieldStatePromise.ts` (+ new spec `disableFormDataOption.spec.ts`)

Payload's form runtime submits every data field's current form-state value —
including fields hidden by `admin.condition`, whose page-load values ride along
unchanged. A field that is ALSO written out-of-band (server actions, a custom
editor surface) therefore gets clobbered on any doc-form save: the form
resubmits the stale rows it loaded with. The existing internal escape hatch,
the form-state `disableFormData` flag honored by `reduceFieldsToValues` /
`reduceFieldsToValuesWithValidation`, cannot express this: for array/blocks
fields it is already `true` whenever rows exist (the parent's value is just the
row count) and the actual row data submits via the `<path>.N.*` child keys,
which nothing filters.

New opt-in field config, on all data-affecting field types:

```ts
admin: {
  disableFormData?: boolean
    | ((args: { blockData: Data | undefined; data: Data; siblingData: Data }) => boolean)
}
```

When it resolves `true` for the current document, the field's value AND its
entire subtree are excluded from every admin form submission — manual save,
publish, autosave, drawer saves all funnel through the same two reduce
utilities. Mechanism, three additive pieces:

- **Evaluation** (`addFieldStatePromise`, inside the data-affecting branch):
  runs server-side on every form-state build — initial render and every
  `buildFormState` refresh — with `data` = full document data, `siblingData` =
  the field's sibling data, `blockData` = nearest parent block. Synchronous,
  server-only (stripped from the client config via
  `serverOnlyFieldAdminProperties`, like `condition`).
- **New form-state marker** `FieldState.disableFormDataSubtree` — stamped
  explicitly `true`/`false` whenever the option is configured (so
  `mergeServerFormState`'s shallow spread tracks per-document flips in both
  directions), absent otherwise (zero wire/behavior change for every field not
  using the option). Distinct from `disableFormData` because that flag's
  existing semantics (drop the parent key only, children still submit) must
  stay untouched for arrays/blocks.
- **Subtree filtering** in `reduceFieldsToValues` (payload) and
  `reduceFieldsToValuesWithValidation` (ui): a marked key and every
  `<key>.`-prefixed descendant are dropped from submitted data (omitted keys
  contribute neither values nor validity); `ignoreDisableFormData: true`
  bypasses the marker exactly as it bypasses `disableFormData`, so
  `buildFormState`'s full-data reconstruction keeps seeing everything.

Deliberately NOT touched: `admin.disabled` semantics, the global default that
condition-hidden fields keep submitting their data, `getSiblingData` /
`getDataByPath` (custom components and client-side consumers still see the
field's data), and rendering — the field renders/hides per its normal
condition; only the submission changes. Because the marker sits on the parent
key and filtering is prefix-based, rows added client-side while the option is
active are omitted too.

Caveat: an omitted field simply doesn't appear in the request body, so the
server keeps the stored value (standard partial-update semantics) — on CREATE
this means the field lands as its default/empty. Live Preview windows also
receive the reduced data, so a preview of a doc where the option resolves true
falls back to the stored value for that field rather than the (stale) in-form
rows — an improvement for the motivating case.

Motivating use: varig's `products.curriculumItems` blocks field. In
Structured Learning mode the Curriculum Studio owns those rows through server
actions while the doc form hides them behind a tab condition; any form save
(title edit, autosave, publish) used to resubmit the page-load rows over the
studio's writes. varig sets
`admin.disableFormData: ({ data }) => data?.type === 'curriculum' && data?.curriculumMode === 'structuredLearning'`
on the field; every other curriculum mode keeps the stock form-based builder,
whose in-form edits submit exactly as before.

### 76. Tabs field: `__after-tabs` right-side portal slot on the tab row

**Files:** `packages/ui/src/fields/Tabs/index.tsx`, `packages/ui/src/fields/Tabs/index.scss`

The Tabs field's tab row (`tabs-field__tabs-wrap > tabs-field__tabs`) owns a
full row of chrome but uses only its left side; consuming apps that want a
right-aligned toolbar on that row (varig portals its canvas builder's simulate
bar + undo/redo/history cluster there, reclaiming a row of vertical space) had
no target short of duplicating the whole Tabs field.

New zero-API portal target: inside `__tabs-wrap`, after `__tabs`, the field now
renders an empty

```tsx
<div
  className="tabs-field__after-tabs"
  id={`after-tabs-${(path || 'tabs').replace(/\./g, '__')}`}
/>
```

**Id scheme:** `after-tabs-<path>` where `<path>` is the tabs field's own
`path` prop with dots flattened to `__` (Payload's standard `field-…` id
flattening). A top-level unnamed tabs field's path is its positional segment
(e.g. `_index-5`), a nested/named one carries its dotted path — so multiple
tabs fields on one document never collide. The id is deterministic per
(document form, field path); the same collection opened in a DocumentDrawer
over itself repeats the path, so consumers that can mount inside drawers
should resolve THEIR field's slot by ancestor scoping —
`element.closest('.tabs-field')` → `':scope > .tabs-field__tabs-wrap > .tabs-field__after-tabs'`
— rather than a document-wide id lookup.

**SCSS:** `__tabs-wrap` becomes a flex row (`justify-content: space-between;
align-items: center` — overflow-x scrolling and `margin-bottom` unchanged).
`__tabs` trades `min-width: 100%` for `flex: 1 0 auto`: the same full-width
fill (its `border-bottom` underline still reaches the slot), without pushing
the slot out, and no shrink so an overflowing tab set still scrolls the wrap.
The slot itself is `align-self: stretch; display: flex; align-items: center;
flex-shrink: 0` with its own matching `border-bottom` and
`padding-right: var(--gutter-h)`, so the underline runs continuously edge to
edge whether the slot is empty (every tabs field renders it; empty = one
gutter-width bordered strip, visually identical to before) or populated.

Constraint for consumers: keep slot content no taller than the tab row (the
tab buttons' `%h4` + `base(1)` padding ≈ 45px; a 32px control row fits) — a
taller slot would center the `__tabs` block and detach the active-tab
indicator from the underline by the difference.

No config API, no behavior change to tab switching, hashes, conditions, or
drawers.

---

### 77. CSS variables for the spacing above a document's tab row

**Files:** `packages/ui/src/elements/DocumentFields/index.scss`, `packages/ui/src/fields/Tabs/index.scss`

The dead space above a document's tab row is the sum of two hard-coded
constants: `.document-fields__edit { padding-top: calc(var(--base) * 1.5) }`
(~30px) and `.tabs-field { margin-top: base(2) }` (~40px). A consuming app
that wants a tighter document header (varig compacts the ~70px to ~15px on
its admin edit views) had to override both rules at matching specificity
inside `@layer payload-default`.

Both values are now CSS variables with their current values as defaults —
zero behavior change for consumers that don't set them:

```scss
.document-fields__edit {
  padding-top: var(--doc-edit-padding-top, calc(var(--base) * 1.5));
}
.tabs-field {
  margin-top: var(--tabs-field-margin-top, #{base(2)});
}
```

Every other rule in both files is untouched (the sidebar's own
`padding-top: calc(var(--base) * 1.5)` in `__sidebar-fields` deliberately
stays hard-coded — the variable governs the edit column only). No config
API, no markup change.

---

### 78. Tabs field: `?tab=<slug>` replaces the URL hash (typed `slug`, SSR-correct, condition-aware)

**Files:** `packages/payload/src/fields/config/types.ts`, `packages/ui/src/fields/Tabs/index.tsx`, `packages/ui/src/fields/Tabs/resolveTabIndex.ts` (+ `.spec.ts`), `packages/ui/src/elements/DocumentDrawer/types.ts`, `packages/ui/src/views/Edit/index.tsx`, `packages/next/src/views/Document/index.tsx`, `packages/ui/src/utilities/buildClientFieldSchemaMap/traverseFields.ts` (the rich-text schema-map loop told a Block from a Tab by `'slug' in x` — now also requires no `name`/`label`, since tabs may carry a slug)

Supersedes #8 (hash-based tab navigation) and #57 (`admin:hashchange`), and the
hash halves of #64 and #70. #59 (drawer scoping), #60 (tab-level condition),
#65 (sticky `_` params) and #76 (tab-row slot) carry unchanged.

**Why.** The hash lived only in the browser: the server never saw it, so every
deep-linked tab rendered the FIRST tab in the SSR HTML and flipped after
hydration (a visible jump, a wasted first paint, and — for tabs that host
lazy-booting embeds — a boot that could only start post-hydration). The hash
also collided with in-page anchors, needed a custom announce event
(`admin:hashchange`) because `replaceState` is silent, and required three
client-side effects (initial selection, `hashchange` listener, dependency-less
per-render re-derive) to stay in sync.

**Config.** The untyped `(tab as any).hash` becomes a typed `slug?: string` on
`TabBase` (so `NamedTab`, `UnnamedTab` and `ClientTab` all carry it). No
`hash` alias. `hideTabs` (#58) now keys off `slug`.

**Selector.** The query param `tab`: `…/collections/products/<id>?tab=page`.
One derivation, identical on server and client (`resolveTabIndex.ts`):

1. `useSearchParams().get('tab')` → `indexOfSlug(tabStates, slug)` — the
   FIRST tab whose slug matches **and whose condition passes** (the old code
   bailed on the first slug match even when hidden). Condition-exclusive
   tabs may therefore share a slug (varig: a create-form Details tab and an
   edit-form Content tab are both `content`).
2. else the local click state, if that tab is still visible (slug-less tabs
   never touch the URL);
3. else the first visible tab.

The addressed tab is in the SSR HTML — no hydration flip. Inside a
`DocumentDrawer` the param is never read or written (#59). A tabs field none
of whose tabs carry a slug never touches the URL at all. Multiple tabs fields
on one document resolve `tab` independently; a non-matching field falls back
to its first visible tab.

**Write path** (`handleTabChange`): rebuild `URLSearchParams(location.search)`,
set/delete `tab`, `pathname + ?qs + location.hash` (the fragment passes
through untouched — it is an in-page anchor now, never a tab), and only when
the URL actually changes, `history.replaceState` (a tab is a lens, not a
destination — Back leaves the document, it never steps through tabs). The #70
identical-URL guard is kept verbatim: it is the anti-wedge invariant for
Next's server-action queue. The click also sets local state marked "in
flight" (`wrote`) so the switch renders immediately instead of waiting on
Next's async search-param sync; when the router reflects the write the mark
clears, and any OTHER change of the param (popstate, a Next navigation,
another field's write) drops the stale click — the URL is the truth.

**Events.** `payload-tab-change` (#22) now fires whenever the DERIVED index
changes — click, popstate, Next navigation — not only on click; the detail
gains an additive `slug`. `admin:hashchange` is no longer emitted. Consumers
that want to observe tab state subscribe to `payload-tab-change` + `popstate`
and read `location.search`.

**Redirects.** The client post-create redirect (`views/Edit`, was #64)
carries `?tab=` (and still the fragment) onto the new doc's URL; the server
autosave redirect (`views/Document`, #65) treats `tab` as sticky beside the
`_`-prefixed params. `handleAuthRedirect` already round-trips the full query
through `?redirect=`, so a login bounce keeps the tab for free (the hash
never survived that hop).

**RULE for consumers (the SSR contract).** Never gate a field server
component's output on the tab — every field renders on every doc load
(`buildFormState({ renderAllFields: true })`), and intra-session tab switches
are client-only (no server round-trip). Server-rendered data is at most a
HINT for the tab the URL addresses; the client keeps its own fetch for
anything that must be fresh after a switch.

**Tests.** `resolveTabIndex.spec.ts` (vitest `unit` project): slug → index,
condition-aware first match (both exclusivity directions), unknown/hidden/
empty slug → null, the fallback chain, and the in-flight click preference.

---

### 80. `admin.components.edit.Title` — app-supplied document title slot on DocumentControls

**Files:** `packages/payload/src/admin/views/document.ts` (`TitleClientProps` / `TitleServerProps` / `TitleServerPropsOnly`), `packages/payload/src/admin/types.ts` (`DocumentSlots.Title` + type exports), `packages/payload/src/collections/config/types.ts` (`admin.components.edit.Title`), `packages/payload/src/bin/generateImportMap/iterateCollections.ts`, `packages/next/src/views/Document/renderDocumentSlots.tsx`, `packages/ui/src/views/Edit/index.tsx`, `packages/ui/src/elements/DocumentControls/index.tsx`. SCSS untouched.

(#79 — page width tiers — was cut and reverted the same day; the number is retired.)

**Why.** The document title in the controls bar (`RenderTitle`, gated by `showTitleInControls`) is Payload's own: it reads `useAsTitle`, falls back to `ID: <hex>` for an unnamed doc, and is inert. An app that wants the title to BE the identity control (rename in place, a placeholder noun instead of the id, a link editor beside it) had to turn `showTitleInControls` off and portal its own control into `.doc-controls__content` from a `beforeDocumentControls` component — a DOM-lookup workaround that depends on the bar's class names and on the render order of a sibling slot. Complements #73 (`setTitleOverride`), which re-titles Payload's OWN renderers; this replaces the controls-bar renderer wholesale.

**Config.** Collection-level `admin.components.edit.Title?: PayloadComponent<TitleServerProps, TitleClientProps>`. Client props: `{ collectionSlug, id?, isEditing }` (`isEditing` = the doc exists; `false` on the create view). Server props: the standard `ServerProps`. Collections only — a global's title is its label.

**Render.** `renderDocumentSlots` renders it into `DocumentSlots.Title`; `DefaultEditView` threads it through `customComponents`; `DocumentControls` renders it in `.doc-controls__content` **in place of** `RenderTitle`:

- rendered on the edit view AND the create view (the app decides what an unsaved document is called);
- **never inside a DocumentDrawer** — the drawer header already carries the title (#43), so the slot is skipped when `isInDrawer`;
- when it renders, the "Creating new <Label>" meta line yields to it exactly as `showTitleInControls: true` makes it yield to `RenderTitle`;
- absent → behavior is byte-identical to before (`showTitleInControls` + `RenderTitle`).

**Import map.** `iterateCollections` registers the component like the other `edit.*` slots.

### 81. `admin.hideWhenSingle` on the Tabs field — no tab bar when only one tab is visible

**Files:** `packages/payload/src/fields/config/types.ts` (`TabsFieldAdminExtras`, threaded into `TabsField.admin` + `TabsFieldClient.admin`), `packages/ui/src/fields/Tabs/index.tsx`. SCSS untouched.

**Why.** A tabs field whose tabs carry `admin.condition`s can end up with exactly one tab passing — a strip with a single tab is chrome without a choice (varig's pages: the Card tab is public-kind-only, so home / lesson / collection pages showed a lone "Page" tab). Payload always draws the bar when the field renders; the only app-side escape was a condition on the whole tabs field plus a duplicated standalone field for the other kinds.

**Config.** `admin.hideWhenSingle?: boolean` on the tabs field (opt-in, default `false` = unchanged behavior). Passes to the client like any other admin boolean.

**Render.** When the flag is set and at most one tab passes its condition, the field renders the active tab's content without `.tabs-field__tabs-wrap` — no tab headers and **no `__after-tabs` slot (#76)**, so consumers that portal into that slot must fall back to their own row when it is absent (varig's inline canvas already does). The field gets `.tabs-field--bar-hidden` for styling hooks. Zero visible tabs still hides the whole field (`--hidden`, as before); two or more visible tabs render the bar exactly as before. Fields without the flag are byte-identical.

### 86. Tabs: `hideWhenSingle` hides the LABELS, not the row

**Files:** `packages/ui/src/fields/Tabs/index.tsx`, `packages/ui/src/fields/Tabs/index.scss`. Revises #81.

**Why.** #81 read "a strip with a single tab is chrome without a choice" and removed the whole bar — taking the `__after-tabs` slot (#76) with it. That was too much: the ROW has a second job. In varig a container page's row carries the canvas's tab-scoped controls (undo / redo / history / navigator / full screen, and a collection page's own lifecycle pill and Publish), so hiding the row pushed exactly those hosts back onto a dedicated band of their own. The thing that is chrome-without-a-choice is the lone LABEL and its active indicator, not the row it sits on.

**Config.** Unchanged: `admin.hideWhenSingle?: boolean`, opt-in, default `false`.

**Render.** When the flag is set and at most one tab passes its condition, `.tabs-field__tabs` (the buttons + the indicator) is not rendered; `.tabs-field__tabs-wrap` and its `__after-tabs` slot still are. The field gets `.tabs-field--labels-hidden` (replacing `--bar-hidden`, which no longer describes anything). SCSS: under that class the slot takes `flex: 1 0 auto; justify-content: flex-end`, since with the labels gone it is the row's only child and `space-between` would park it at the left; it keeps the border-bottom, so the row still carries the underline. Zero visible tabs still hides the whole field (`--hidden`). Two or more visible tabs, or no flag: byte-identical.

**Consumers.** #81's note that portal consumers must fall back when the slot is absent no longer applies to this case — the slot is always there when the field renders at all.

### 82. `ConfirmRenderer` — app-supplied renderer for every `ConfirmationModal`

**Files:** `packages/ui/src/providers/ConfirmRenderer/index.tsx` (new), `packages/ui/src/elements/ConfirmationModal/index.tsx`, `packages/ui/src/elements/DocumentStaleData/index.tsx` (rewritten on `ConfirmationModal`; its `index.scss` deleted), `packages/ui/src/exports/client/index.ts`, `test/locked-documents/e2e.spec.ts` (selector follow-up).

**Why.** A consuming app that standardizes its overlays on its own dialog primitive (varig: shadcn `AlertDialog` for every confirm it authors) still gets Payload's stock `ConfirmationModal` from the surfaces Payload owns — delete / bulk delete / unpublish / revert-to-published / duplicate / leave-without-saving / stale-data reload. Every confirm the merchant sees should look like one system; overriding each slot component just to swap the modal chrome is the wrong layer.

**Provider.** `ConfirmRendererProvider` (`renderer: (props: ConfirmationModalProps) => React.ReactNode | undefined`) + `useConfirmRenderer()`, exported from `@payloadcms/ui`. Register it through `admin.components.providers` — it then wraps every admin route. The renderer receives the full `ConfirmationModalProps` (now exported) including `modalSlug`, and is expected to keep the **modal bus semantics**: mount from `isModalOpen(modalSlug)`, dismiss through `closeModal(modalSlug)`, so callers that drive the slug externally (`openModal` / `toggleModal`, route-change close) keep working unchanged. Return `undefined` to fall through to the stock render for that call. Prefer returning a component element (`<MyConfirm {...props} />`) so the custom confirm's hooks live in their own render.

**`ConfirmationModal`.** Delegates to the renderer BEFORE its own `isModalOpen` early-return, so the custom overlay owns its mount/exit lifecycle. Also gains `hideCancel?: boolean` — a forced-decision confirm with no Cancel button and no close X (the stock render omits both; a custom renderer decides how to honor it).

**`DocumentStaleData`.** Rewritten as a `ConfirmationModal` (`hideCancel`, one primary Reload → `confirmLabel`, `className="document-stale-data"` kept for the e2e `h1` selector) so it inherits the renderer; the confirm is `#confirm-action` now (the spec's `#document-stale-data-reload` selectors updated). Behavior unchanged: `clearRouteCache()` then `onReload()`, and the modal closes through `ConfirmationModal`'s own confirm path.

**Reach.** Every in-tree `ConfirmationModal` consumer inherits the renderer: DeleteDocument, DeleteMany, DuplicateDocument, Status (revert to published), UnpublishButton, UnpublishMany, PublishMany, LeaveWithoutSaving, BulkUpload DiscardWithoutSaving, GenerateConfirmation, RestoreButton/RestoreMany, PermanentlyDeleteButton, ListEmptyTrashButton, ListSelection, the Folder-view confirms, QueryPresetBar, and DocumentStaleData. **`StayLoggedInModal` is the one exception**: `RootProvider` mounts it as a sibling of `children` (outside the app-provider subtree), so no app provider reaches it — it renders the stock modal. Unreachable in varig anyway (its sessions carry no JWT expiry, so the modal never opens).

### 83. DocumentControls ⋯ menu: destructive last, behind a divider

**Files:** `packages/ui/src/elements/DocumentControls/index.tsx`. SCSS untouched.

**Why.** The stock order was Duplicate → Delete → Unpublish → app entries: the one irreversible action sat in the middle of the list, one row above a recoverable one, with nothing separating it. Every other menu in the consuming app (varig) puts its destructive entry last behind a divider.

**Render.** The `PopupList.ButtonGroup` now reads: CopyLocaleData → Duplicate(s) → Unpublish (`UnpublishButton` / its custom slot) → `EditMenuItems` → **`PopupList.Divider` → Delete** (`DeleteDocument` / its custom slot). The divider renders only when the Delete entry does (`hasDeletePermission`). No other behavior changes.

### 84. `admin.components.edit.DocumentMenu` — app-supplied ⋯ menu on DocumentControls

**Files:** `packages/payload/src/admin/views/document.ts` (`DocumentMenuClientProps` / `DocumentMenuServerProps` / `DocumentMenuServerPropsOnly`), `packages/payload/src/admin/types.ts` (`DocumentSlots.DocumentMenu` + type exports), `packages/payload/src/collections/config/types.ts` (`admin.components.edit.DocumentMenu`), `packages/payload/src/bin/generateImportMap/iterateCollections.ts`, `packages/next/src/views/Document/renderDocumentSlots.tsx`, `packages/ui/src/views/Edit/index.tsx`, `packages/ui/src/elements/DocumentControls/index.tsx`. SCSS untouched.

**Why.** The per-entry slots (`DeleteButton`, `UnpublishButton`, `EditMenuItems`) let an app own the entries but not the menu: the trigger and the list stay Payload's `Popup`, so an app that renders every other menu with its own overlay primitive (varig: shadcn `DropdownMenu`, with the drawer focus bridge) gets one foreign-looking menu per document. The same shape as #80 (Title): a whole-block slot with a byte-identical fallback.

**Config.** Collection-level `admin.components.edit.DocumentMenu?: PayloadComponent<DocumentMenuServerProps, DocumentMenuClientProps>`. Client props: `{ collectionSlug, id?, isEditing }`.

**Render.** `renderDocumentSlots` renders it into `DocumentSlots.DocumentMenu`; `DefaultEditView` threads it through `customComponents`; `DocumentControls` renders it **in place of the whole `<Popup>` block** (dots trigger + `PopupList`) under the exact condition the stock menu renders (`showDotMenu && !readOnlyForIncomingUser` — so never in a create drawer, #45, and never for a read-only incoming user). The app owns every entry (duplicate / delete / unpublish / its own); the per-entry slots are not consulted when this slot is set. Absent → byte-identical to before.

**Import map.** `iterateCollections` registers the component like the other `edit.*` slots.

### 85. DocumentControls: the title truncates, the meta keeps its width

**Files:** `packages/ui/src/elements/DocumentControls/index.scss`.

**Why.** `.doc-controls__title` shipped `flex-shrink: 0` with no truncation, so a long document title claimed its full single-line width inside `.doc-controls__content` (`overflow: hidden`) and shoved the status meta past the clipped edge. varig carried this as an unlayered override in its admin `custom.css`; it belongs in the element.

**Render.** `&__title` gains `flex-shrink: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap` (RenderTitle sets the `title` attribute, so hover still shows the full text); `&__meta` gains `flex-shrink: 0` and its `width: 100%` becomes `width: auto` — v3.85.0.37 shipped `flex-shrink: 0` beside the old `width: 100%`, which made the meta claim the whole row and collapsed the (now shrinkable) title to zero on every edit page; v3.85.0.38 corrects it. The status badge always survives; the title takes what the meta leaves.

### 87. DocumentControls: the autosave status joins the publish cluster; the content box stops clipping vertically

**Files:** `packages/ui/src/elements/DocumentControls/index.tsx`, `packages/ui/src/elements/DocumentControls/index.scss`.

**Why.** Two things the controls bar got wrong for an app that renders its own identity in the `Title` slot (#80). (1) The `Autosave` status ("Saving…" / "Last saved less than a minute ago") rendered as the last `<li>` of `.doc-controls__meta`, i.e. INSIDE the content box beside the document's identity and its status, a sentence parked among badges. It is a fact about the Publish cluster — how fresh the draft the button would publish is — and reads there, at the cluster's left edge. (2) `.doc-controls__content` was `overflow: hidden` on a wrapper whose height is a fixed `--doc-controls-height` (56px), so anything an app hung above its title inside the box was cut off: a `FieldError` tooltip (23px tall, hung 31px above its anchor — `--position-top`'s -25px plus the caret's -6px translate) vanished entirely, which forced the consuming app to invent a second error vocabulary for the title.

**Render.** The `Autosave` element leaves `__meta` and mounts once (it PERFORMS the autosave, so it is never rendered twice) as `.doc-controls__autosave`, the first child of `.doc-controls__controls-wrapper`, before `__controls` (preview / publish) and the ⋯ menu. The visibility condition is unchanged (drafts enabled, save permission, autosave on, not a validated unsaved draft, not trashed, and never in a `createEdit` CREATE drawer). SCSS: `&__autosave` is `--theme-elevation-500`, `base(0.65)` (13px) on a `base(1)` line, `white-space: nowrap`, `flex-shrink: 0`, and ends `calc(base(0.8) - var(--controls-gap))` before the wrapper's own gap so the first control sits exactly 16px after it. At `mid-break` it takes the mobile bar's slack (`flex: 1 1 auto`, ellipsized, `--gutter-h` at its start) so the controls and the ⋯ keep their edge.

`&__content`: `overflow: hidden` → `overflow: clip` with `overflow-clip-margin: base(1.6)` (32px — the tooltip's 31px rise from an anchor at the box's top, rounded up) and an explicit `min-width: 0` (`clip` makes no scroll container, so the flex item's automatic minimum is no longer zeroed for free). A runaway row is still cut horizontally; a tooltip hung above the title, or a framed title's few px of inset in the gutter, now paints. The mobile `overflow: auto` on the content box is untouched (that band scrolls).

**Consumers.** varig's `document-identity.client.tsx` (its header row: name, then facts; the save time at the right) and its `PublishFieldError` on the title. Copy is untouched — `general:saving` / `version:lastSavedAgo` — shortening it is a separate copy decision.

---

### 88. `payload.validate()` — `operation: 'create'` with no id

**Files:** `packages/payload/src/collections/operations/validate.ts`, `packages/payload/src/collections/operations/local/validate.ts`, `packages/payload/src/index.ts`

The dry-run validator from the second `#46` loaded the original document by id before it validated anything, whatever `operation` said. So it could only ever answer questions about a document that already exists: a CREATE form had nothing to be pre-flighted against, and its Save fell through to Payload's native submit — a 400 whose `ValidationError` carries BOTH the field list (which Payload puts into form state, the pill and the frame on the field) and its own summary sentence (which Payload raises as a toast through `FieldErrorsToast`). One refusal, said twice, once in a corner beside the field it has just framed.

Fix, in three parts:

1. **`id` is optional**, and the read is keyed on the OPERATION, not on the id: `operation: 'create'` reads nothing (`originalDoc = {}`, exactly what the real `create` operation hands `beforeChange` when nothing is duplicated-from), `operation: 'update'` reads as before. An update with no id is now an explicit `APIError` rather than a crash inside `findByID`.
2. **A create runs the FIELD-level `beforeValidate` step first** — the step the real create operation runs immediately before `beforeChange`, whose documented job includes "compute default values for undefined fields". Without it every required field with a `defaultValue` that the caller did not spell out reads as missing, so a create pre-flight would refuse forms the real create accepts. The UPDATE path is deliberately left byte-identical to `#46`: there the original document already carries every stored value, so defaults are moot, and a shipped pre-flight (the publish cascade) keeps its exact behavior.
3. `data` is no longer merged onto an original doc on the create path — the submitted data IS the document.

**Still out of scope, by design, and it matters more on a create.** `validate()` runs field-level validation only; COLLECTION-level `beforeValidate` / `beforeChange` hooks are skipped because they may have side effects unsafe in a dry run. On an update that is invisible (the stored doc already holds whatever those hooks wrote). On a create, any required field that a collection hook fills — rather than the form — will read as missing. Callers supply those themselves; the varig consumer supplies `store`, the one required field its permission hook writes.

```ts
await payload.validate({
  collection: 'curations',
  data: formData, // no id
  operation: 'create',
  overrideAccess: false,
  user,
})
```

**Consumer.** varig's `preflightSave` (`src/lib/admin/save-preflight.actions.js`) and the Save button in front of it (`src/components/admin/save-with-preflight.client.jsx`), on the document views with no drafts (Media, Collections). Its create form now asks the same authority a stored document asks, for every rule. It deletes a second spelling: until this change the button read "the name is empty" out of form state in the browser and refused there, so "a collection's name is required" was written in two places, one of which could never learn a rule the schema added later.

---

### 89. Text and Textarea forward `maxLength` to the native input

**Files:** `packages/ui/src/fields/Text/index.tsx`, `packages/ui/src/fields/Text/Input.tsx`, `packages/ui/src/fields/Text/types.ts`, `packages/ui/src/fields/Textarea/index.tsx`, `packages/ui/src/fields/Textarea/Input.tsx`, `packages/ui/src/fields/Textarea/types.ts`

A field config's `maxLength` reached exactly one place: the `memoizedValidate` closure, which hands it to the validator that REFUSES an over-long value after the merchant has typed it, tabbed away and submitted. The `<input>` and `<textarea>` themselves were rendered without the attribute, so the box happily accepted the 201st character of a 200-character field and the merchant learned the cap from an error.

`maxLength` now rides from the field component into `TextInput` / `TextareaInput` as a prop and onto the native element, so the browser stops accepting characters at the cap: an impossible state is made impossible rather than refused. Paste is truncated at the cap by the same attribute. The validator is untouched — it remains the authority for an API write, a hostile client, or a value that was already over the cap when the document was stored.

Placed BEFORE the `{...(htmlAttributes ?? {})}` spread on the text input, so an app that passes its own `maxLength` through `htmlAttributes` still wins.

**Not covered, and why.**

- **`hasMany` text** renders react-select, not an input; a cap on each created option is a different feature.
- **Email** has no `maxLength` in its field config at all (`EmailField` omits it, unlike `TextField` / `TextareaField` / `CodeField`), so there is nothing to forward.
- **Code** carries `maxLength` in its config but renders a Monaco editor, which has no such attribute; capping it means a change listener, which is a behavior change rather than a forwarding.
- **A field with a custom `validate` and no declared `maxLength` key** is out of reach: the cap lives inside the validator, and nothing in the config says what it is. Consuming apps that put their length wall in a custom `validate` (to control the sentence) should ALSO declare `maxLength` — the custom validate still suppresses Payload's own length validator, so the sentence does not change, but the input gets its cap.

**Consumer.** varig, whose schema comment at `src/lib/admin/collections.ts` → _THE LENGTH WALL, IN THE HOUSE SENTENCE_ named this fork change as the open half of its own rule.

---

### 90. Tab error counter: one fault, counted once

**Files:** `packages/ui/src/forms/WatchChildErrors/index.tsx`, `packages/ui/src/forms/WatchChildErrors/countChildErrors.ts` (new), `packages/ui/src/forms/WatchChildErrors/countChildErrors.spec.ts` (new)

The badge on a tab (and on a collapsible, and the bulk-upload error count) counted every invalid key in form state whose path matched the subtree. Server-built form state marks a CONTAINER invalid beside the leaf that is actually at fault — one subtitle track with no name flags both `subtitles.0.name` and `subtitles` — so a single missing value read as **2**. The merchant opens the tab, finds one framed field, and is told there is another one somewhere.

The count now takes only the DEEPEST invalid key of each chain: an invalid key that has an invalid descendant (`<key>.` prefix, checked against every invalid key in form state, not only the matching ones) is the same fault said twice and is skipped. Everything else about the matching is unchanged.

A genuinely container-level error is NOT hidden: `minRows` on an array whose rows are all valid, or a group whose own `validate` failed, has no invalid descendant and still counts 1. The one lossy case is a container error AND a leaf error at the same time, which reads 1 instead of 2 — the badge still says the tab is in error, which is what it is for, and the alternative (counting the parent) mis-states every single-leaf fault, which is the common one.

The counting itself moved out of the effect into a pure `countChildErrors({ formState, parentPath, segmentsToMatch })`, so it has a spec (9 cases: one fault once, two leaves in one row, one leaf per faulty row, `minRows` alone still 1, a plain sibling beside an array fault, all-valid, out-of-subtree, a tab inside an array row, and a name-prefix sibling that must not be read as a descendant). Four of the nine are red against the old body. `WatchChildErrors` is otherwise unchanged — same props, same throttle, same `hasSubmitted` gate.

**Consumer.** varig's Files document, whose Playback tab read 2 for one nameless subtitle track.

---

### 91. Read-only viewers see the document actions inert, not hidden

**Files:** `packages/ui/src/elements/DocumentControls/index.tsx`, `packages/ui/src/elements/DocumentControls/index.scss`, `packages/ui/src/elements/DocumentControls/getDotMenuState.ts` (new), `packages/ui/src/elements/DocumentControls/getDotMenuState.spec.ts` (new), `packages/ui/src/elements/PublishButton/index.tsx`, `packages/next/src/views/Document/renderDocumentSlots.tsx`

**Why.** For a viewer without update permission Payload removed the document header's actions outright: the Save / Save Draft / Publish cluster was wrapped in `hasSavePermission &&`, `PublishButton` returned `null` without publish permission, and the ⋯ menu rendered only when the viewer could create or delete. The header of a read-only document therefore read as a document with no actions at all. The consuming app's rule is "disable, don't hide" (varig Axiom 11): an affordance stays visible and becomes inert.

**Render.** Four places, one rule:

1. **DocumentControls save cluster** — the gate is `!isTrashed` alone. The Edit view already disables the `Form` for a viewer without save permission (`views/Edit` → `disabled={… || !hasSavePermission …}`), and every stock button (and any app button built on `FormSubmit`) is disabled while the form is, so the cluster renders visible and inert. The `Autosave` status stays gated on save permission (it performs the autosave).
2. **`PublishButton`** — the early `return null` without publish permission is gone. `canPublish` already requires the permission, and so do the schedule / per-locale submenu, so the button renders disabled.
3. **`renderDocumentSlots`** — the custom `PublishButton` / `UnpublishButton` / `SaveDraftButton` / `SaveButton` slots were only rendered when `hasSavePermission`. They now always render, so a read-only viewer sees the APP's button (inert), not the stock fallback that (1) would otherwise show in its place.
4. **⋯ menu** — the visibility test moved into a pure `getDotMenuState(...) → { show, inert }`. `show` keeps every stock placement rule (not `disableActions`, never in a create drawer #45, a saved collection doc or a global with drafts/localization) and adds "…or the viewer has no update permission". `inert` = shown but nothing in it is actionable (collection: no create and no delete; global: no update). An inert menu renders the stock `Popup` with `disabled` (a disabled trigger button that cannot open) and the modifier `doc-controls__popup--inert` (dots dimmed to `--theme-elevation-400`, `cursor: not-allowed`, no hover answer). A viewer with no update permission but with create (Duplicate) or delete keeps a live menu. A viewer with update but neither create nor delete still gets no menu, as stock. Spec: 11 cases.

**App-supplied menu (#84).** `admin.components.edit.DocumentMenu` renders under the same `show` condition, so it now MOUNTS for a read-only viewer too. It is a pre-rendered node and receives no `inert` signal: the app owns rendering its own trigger inert (it has `useDocumentInfo().hasSavePermission` / `docPermissions`).

**App-supplied buttons.** An app's custom Publish/Save that itself returns `null` without permission (the pattern the stock button used) keeps hiding — the app has to drop that early return to follow suit.

**Not changed.** A document locked by another user (`readOnlyForIncomingUser`) keeps the stock treatment (Take Over button, no ⋯ menu); the trashed view is untouched.

---

### 92. Read-only text inputs use `readonly`, not `disabled`

**Files:** `packages/ui/src/fields/Text/Input.tsx`, `packages/ui/src/fields/Textarea/Input.tsx`, `packages/ui/src/fields/Email/index.tsx`, `packages/ui/src/fields/Number/index.tsx`, `packages/ui/src/fields/Point/index.tsx`, `packages/ui/src/elements/DatePicker/DatePicker.tsx`, `packages/ui/src/elements/DatePicker/index.scss`, `packages/ui/src/scss/vars.scss`

**Why.** Payload rendered a read-only Text / Textarea / Email / Number / Point / Date value as a `disabled` control. A disabled control cannot be focused and its text cannot be selected, so a viewer without update permission could read an email address, an ID or a URL but not copy it, and the greyed text (`--theme-elevation-400`) read as "switched off" rather than "not yours to edit".

**Render.** The native `<input>` / `<textarea>` now takes `readOnly={…}` where it took `disabled={…}` (the same expression — `readOnly`, or `readOnly || disabled` where the field already folded in the form's `disabled`). The date picker passes `readOnly` to react-datepicker instead of `disabled` (react-datepicker keeps the calendar closed for either) and its ✕ clear button is `disabled` when read-only (it used to stay clickable) and dimmed (`opacity: 0.4`, default cursor). The value is focusable, selectable and copyable; it cannot be typed into, and the Number field's arrows/wheel do nothing (`readonly` blocks them natively).

**Style** (the grey fill is REVISED by #96 — read-only text inputs are now white). A new `readOnlyText` mixin, applied by `formInput` to `&[readonly]`: the same fill as the existing `readOnly` mixin (`--theme-elevation-100`, so it still reads as not-editable beside editable siblings) but the value keeps its full text colour (`--theme-elevation-800`), no caret (`caret-color: transparent`), no hover answer, and the stock keyboard-focus border stays (focusing to select is a real use). Every `formInput` consumer picks it up for `[readonly]` — including the Password field, which already rendered `readOnly` when the form is disabled.

**Not changed.** `hasMany` Text/Number (react-select), Select, Checkbox, Radio, Relationship and Upload stay `disabled` (none of them holds selectable text); Password's own input stays `disabled` when read-only (a password is not meant to be copied); Code/JSON (Monaco) already used `readOnly`. No spec: the fork's unit project is node-only with no DOM renderer; the change is one attribute per input.

---

### 93. No icon on error toasts

**Files:** `packages/ui/src/providers/ToastContainer/index.tsx`, `packages/ui/src/scss/toasts.scss`

**Why.** The admin Toaster painted a red circle-✕ beside every error toast. The error level is already said by the toast's red surface and its sentence; the glyph read as a second, louder "no". The consuming app's toast rule (R2): no icon on errors.

**Render (as shipped in v3.85.0.42 — DID NOT TAKE EFFECT, fixed by #95).** The `error` entry is removed from the Toaster's `icons` map. Sonner falls back to its OWN default glyph for any level missing from the map (`icon || icons[type] || getAsset(type)`), so the icon slot is also hidden for the error level in CSS: `.payload-toast-item.toast-error .toast-icon { display: none }`. Info, success and warning keep their icons. The `Error` icon component is still exported (`ErrorIcon`) for anything else that uses it.

**What went wrong.** The CSS hide never applied, so error toasts showed sonner's default ✕ instead of Payload's. Payload compiles its admin stylesheet inside `@layer payload-default`; sonner injects `styles.css` at runtime UNLAYERED. An unlayered normal declaration beats a layered one regardless of specificity, so sonner's `:where([data-sonner-toast]) :where([data-icon]) { display: flex }` won over the fork's `.toast-error .toast-icon { display: none }` — specificity never came into it. Removing the map entry only swapped Payload's glyph for sonner's. See #95.

---

### 94. Localized save-failure toasts

**Files:** `packages/ui/src/forms/Form/index.tsx`, `packages/ui/src/forms/Form/submitFailureMessage.ts` (new), `packages/ui/src/forms/Form/submitFailureMessage.spec.ts` (new), `packages/translations/src/clientKeys.ts`, `packages/translations/src/languages/*.ts` (all 44)

**Why.** A save that failed painted the transport's raw English: a dropped connection showed the browser's `TypeError` message ("Failed to fetch" / "NetworkError when attempting to fetch resource." / "Load failed"), and a server fault showed whatever the 500 carried — `statusText` ("Internal Server Error"), Payload's "Something went wrong.", or in debug a raw exception message.

**Keys.** `error:couldNotReachServer` — en "Couldn't reach the server. Check your connection and try again." / pt "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente." — and `error:couldNotSave` — en "Couldn't save. Please try again." / pt "Não foi possível salvar. Tente novamente." Both are client keys. The other 42 languages carry the English sentence (the translation objects are typed complete; translate on demand).

**Rule** (pure helpers, spec'd — 15 cases):

- **The submit threw** (`thrownSubmitFailureMessage`): no response had come back AND the throw is the network's (`isNetworkError`: an `AbortError`, or a `TypeError` whose message is one of the browsers' fetch sentences — a `TypeError` from a bug is not) → `couldNotReachServer`; anything else → `couldNotSave`. Never `err.message`.
- **A failure response** (`responseSubmitFailureMessage`): status ≥ 500 → `couldNotSave`, whatever the body said; a 4xx that carries its own sentence (`json.message`, or a non-field entry of `json.errors`) keeps it — an `APIError` an app threw on purpose, a 403's "not allowed"; a response with no sentence → `couldNotSave` instead of `statusText` (the hard-coded 413 message in `errorMessages.ts` still wins where it applied).
- **A 5xx with a `json.errors` array**: field-path errors are still dispatched into form state; the non-field entries become ONE `couldNotSave` toast instead of one raw toast each.
- **Validation errors** (4xx with `json.errors`) are untouched: `ADD_SERVER_ERRORS` for the fields, `FieldErrorsToast` for the summary.

A `handleResponse` prop still owns its own toasts.

---

### 95. Error toasts really have no icon (fixes #93)

**Files:** `packages/ui/src/providers/ToastContainer/index.tsx`, `packages/ui/src/scss/toasts.scss`

**Why.** #93 did not take effect (see its _What went wrong_): the layered `display: none` lost to sonner's unlayered `display: flex`, and the missing `icons.error` made sonner paint its own default ✕.

**Render.** Three layers of defence:

1. **No glyph.** The Toaster's `icons.error` is an empty `<React.Fragment />`. Sonner's resolution is `toast.icon || icons[type] || defaultGlyph(type)`; an element is truthy, so sonner takes it and renders nothing — no fallback to its default. (`null` / `undefined` would fall through to the default, which is the #93 bug.)
2. **No slot.** Sonner always renders the `[data-icon]` wrapper for a typed toast, whatever the map holds, so the wrapper is taken out of the flex row in CSS with `!important`: `.payload-toast-item.toast-error .toast-icon { display: none !important }`. An `!important` declaration inside a layer beats every unlayered normal declaration, so it wins over sonner's rule. `display: none` removes the box, so the item's `gap: 1rem` leaves no hole.
3. **No empty box anywhere.** `.payload-toast-item .toast-icon:empty { display: none !important }` — any icon slot with nothing in it (any level, any app-supplied empty icon) takes no space.

A promise toast that settles into an error loses its icon the same way. A per-toast `icon` passed to `toast.error(..., { icon })` still renders nothing visible (the slot is hidden for the error level).

**Layer audit of the other fork CSS in #91/#92.** The same trap only bites where an UNLAYERED stylesheet targets the same element. #91's `.doc-controls__popup--inert .doc-controls__dots` and #92's date-picker ✕ (`&__clear-button:disabled`) and `readOnlyText` only compete with Payload's own `@layer payload-default` rules (react-datepicker's CSS is copied into the same layer in `DatePicker/library.scss`; sonner styles nothing but toasts), so specificity inside the layer decides and they apply as written — no `!important` needed. Verified against the compiled `@payloadcms/next/dist/prod/styles.css`.

---

### 96. Read-only text inputs render on the normal input surface (revises #92)

**Files:** `packages/ui/src/scss/vars.scss`, `packages/ui/src/fields/Textarea/index.scss`

**Why.** #92 kept the grey `readOnly` fill (`--theme-elevation-100`) on a read-only Text / Textarea / Email / Number / Point / Date input so it would read as not-editable beside editable siblings. The consuming app ruled the other way: a read-only value is WHITE — the same face as Payload's read-only select / relationship fields in the app and the app's own read-only controls.

**Style.** The `readOnlyText` mixin (applied by `formInput` to `&[readonly]`) now sets `background: var(--theme-input-bg)`, the full-strength value colour (`--theme-elevation-800`), the resting border (`--theme-elevation-150`) and the resting `shadow-sm` — the normal input at rest. Hover changes nothing (border and shadow pinned to the resting values). The caret stays `transparent`. The focus border (`--theme-elevation-400`) is restated inside the mixin for `:focus` / `:focus-visible`, because `&[readonly]` comes after `formInput`'s `&:focus` at the same specificity and would otherwise flatten it; nested, it is one class higher and also wins over the hover lock while focused. The value stays focusable and selectable (native `readonly`, #92).

**Textarea.** Upstream painted `.field-type.textarea.read-only .textarea-outer` with the grey `readOnly` mixin; with a white textarea on top the grey showed at its rounded corners. The rule is removed — the textarea carries the read-only face itself.

**Layer.** All of this lives in `@layer payload-default` and competes only with Payload's own layered rules (no unlayered stylesheet targets these inputs), so no `!important` is needed; confirmed in the compiled `styles.css`.

**Not changed.** `disabled` controls keep the grey `readOnly` mixin (react-select, checkbox, radio, code, Password's own input). The Password field's `[readonly]` state (form disabled) picks up the white face too, as `formInput` consumer.

---

### 97. A server path error with no field on screen toasts its own message

**Files:** `packages/ui/src/forms/Form/index.tsx`, `packages/ui/src/forms/Form/offScreenFieldErrors.ts` (new), `packages/ui/src/forms/Form/offScreenFieldErrors.spec.ts` (new), `packages/ui/src/elements/Toasts/fieldErrors.tsx`

**Why.** A `ValidationError`'s message is "The following field is invalid: <label or path>". For a field on screen that works — ADD_SERVER_ERRORS frames it and the toast names it. For a path the form does not render (a hook-validated virtual path, a field not in the form), nothing frames and the toast reads "The following field is invalid: items.0.offer" — a raw path the viewer cannot act on. Each path error also carries its own `message`, which an app writes as a localized sentence.

**Rule** (pure helper `offScreenErrorMessages`, spec'd — 11 cases). For each 4xx error entry that carries `data.errors`: a path is ON SCREEN when the form state (captured before ADD_SERVER_ERRORS, which creates a state for every path) holds a field for it whose `passesCondition` is not `false`. The messages of the OFF-screen path errors — trimmed, de-duplicated, in server order — replace the stock toast: one message renders plainly, several as a list (the stock multi-error shape). When every path is on screen, or the off-screen entries carry no message, the stock `FieldErrorsToast` stays. When on- and off-screen errors mix, the toast carries the off-screen messages and the on-screen fields frame themselves as before.

**Not changed.** ADD_SERVER_ERRORS (the per-field frame) is untouched; 5xx handling (#94) is untouched; `BulkUpload/FormsManager` keeps the stock toast.

---

### 98. A hidden field is off screen unless a component claims its path (revises #97, #90)

**Files:** `packages/ui/src/forms/useClaimFieldPath/index.tsx` (new), `packages/ui/src/forms/useClaimFieldPath/claimRegistry.ts` (new), `packages/ui/src/forms/useClaimFieldPath/claimRegistry.spec.ts` (new), `packages/ui/src/forms/Form/index.tsx`, `packages/ui/src/forms/Form/offScreenFieldErrors.ts`, `packages/ui/src/forms/Form/offScreenFieldErrors.spec.ts`, `packages/ui/src/forms/WatchChildErrors/index.tsx`, `packages/ui/src/forms/WatchChildErrors/countChildErrors.ts`, `packages/ui/src/forms/WatchChildErrors/countChildErrors.spec.ts`, `packages/ui/src/forms/fieldSchemasToFormState/addFieldStatePromise.ts`, `packages/ui/src/exports/client/index.ts`, `packages/payload/src/admin/forms/Form.ts`, `packages/payload/src/fields/config/types.ts`, `packages/payload/src/fields/config/client.ts`

**Why.** An `admin.hidden` field renders no stock control. #97 counted a path as ON screen whenever the form held a field state for it that passed its condition, so a server `ValidationError` on a hidden field toasted the stock "The following field is invalid: checkpointPolicy" (a raw path), and #90's tab counter counted it, so the tab showed a badge pointing at nothing. But "hidden = never counts" is wrong too: a custom component can render a hidden field's error itself (varig's curriculum Sell sentence binds the hidden `checkpointPolicy` with `useField` and paints the frame and the pill).

**Rule.** A hidden field is OFF screen unless a mounted component CLAIMS its path.

- **Form state knows a field is hidden.** `addFieldStatePromise` stamps `hidden: true` on the state of a data field with `admin.hidden` (or `hidden`), only when true, as it does for `passesCondition: false`. `mergeServerFormState`'s shallow spread carries it.
- **`useClaimFieldPath(path)`** (new, exported from `@payloadcms/ui`, with `useClaimedFieldPaths()`). The component that shows the field's error calls it; the path is registered in the nearest `Form` for as long as the component is mounted. Claims are ref-counted per path, and the release is idempotent. A falsy path holds no claim. `useField` is unchanged. The registry is a pure `createClaimRegistry` (spec'd) held in `useState` by `Form`, which provides it through two contexts: a stable registry context, and a reactive `ReadonlySet` of the claimed paths that `WatchChildErrors` reads.
- **The toast (#97).** `isFieldOnScreen(fields, path, claimedPaths)`: a hidden field is on screen only if claimed. So an unclaimed hidden path toasts its own message. A claimed one gets no toast entry and its component frames it. Because the stock sentence would name a claimed path by its raw path, an error entry whose paths are all on screen but include a claimed hidden one toasts the stock `error:correctInvalidFields` ("Please correct invalid fields.", the same toast client-side validation uses) instead of `FieldErrorsToast` (new helper `claimedErrorPaths`). Mixed with off-screen paths, the off-screen messages toast as in #97.
- **The badge (#90).** `countChildErrors` skips an invalid HIDDEN key unless it is claimed (`claimedPaths`) or statically claimed (`claimedByComponent: true`, below). An unclaimed hidden-field error counts nowhere: it is toasted. A hidden leaf still makes its container a same-fault duplicate, so an unclaimed hidden leaf does not come back as its group's error. The badge goes to the tab (or collapsible) the field lives in by schema: the claim says the error is shown, and the schema says where.

**The static fallback: `admin.claimedByComponent`.** The registry lives in the form, and the Tabs field mounts only the ACTIVE tab, so a merchant on another tab has no claim mounted when the server refuses the save. The field can therefore declare the claim statically: `admin.claimedByComponent: true | ({ blockData, data, siblingData }) => boolean`. It is evaluated server-side at form-state build time and stamped onto form state as `claimedByComponent` (explicitly `true`/`false` whenever it is configured, so per-document flips merge, the #75 `disableFormData` pattern). It is a server-only admin property, never sent to the client config. The function form scopes the claim to the documents where the component actually renders. A statically claimed error:

- **badges its tab** even while the component is unmounted;
- **still toasts its own message** while unmounted (nothing on screen shows it). Once the component mounts and calls the hook, the live claim takes over and the error is on screen.

We chose a static prop over "claims persist after unmount" because a sticky claim fails for a tab that was never opened in this session, and the doc may open on another tab. The function form, rather than a bare boolean, keeps the badge off documents where the component does not render (varig: a non-curriculum product refused on `checkpointPolicy` by the rules wall).

**Spec'd.** `claimRegistry.spec.ts` (5 cases), `offScreenFieldErrors.spec.ts` (+8: an unclaimed hidden field is off screen; claimed is on; a static claim alone is not on screen; a claim does not beat a false condition; a claim on a visible field changes nothing; an unclaimed hidden error toasts its sentence; a claimed one gets no entry and is reported claimed; `claimedErrorPaths` filtering), `countChildErrors.spec.ts` (+9: unclaimed counts nowhere; mounted claim counts; static claim counts with nothing mounted; a static claim `false` for this document does not; a claim on another path does not; a visible sibling still counts; an unclaimed hidden leaf does not resurface as its group; a claimed hidden leaf in a group counts once; a valid hidden field never counts).

**Not changed.** `useField`, ADD_SERVER_ERRORS, 5xx handling (#94), and `BulkUpload/FormsManager` (stock toast). Fields that are not hidden behave exactly as in #97/#90, including condition-hidden ones. A server error at a path with NO field state at all is still off screen for the toast and, as before, still counted by a matching container segment.

**Consumer (varig).** `src/components/admin/product-sell-curriculum.client.tsx`: `useClaimFieldPath('checkpointPolicy')` beside its `useField({ path: 'checkpointPolicy' })`. `src/lib/admin/collections.ts`, the `checkpointPolicy` field: `admin: { hidden: true, claimedByComponent: ({ data }) => data?.type === 'curriculum' }`.

---

### 99. Every server error on screen toasts "Please correct invalid fields." (revises #97, #98)

**Files:** `packages/ui/src/forms/Form/index.tsx`, `packages/ui/src/forms/Form/offScreenFieldErrors.ts`, `packages/ui/src/forms/Form/offScreenFieldErrors.spec.ts`

**Why.** When a server refusal's path errors all land on fields that are on screen, each field already frames itself and shows its message in its pill. The stock `FieldErrorsToast` ("The following field is invalid: …") repeats that, and when an app hook throws `ValidationError` without a `label` it names the field by its raw path. #98 already swapped in `error:correctInvalidFields` for the case where a claimed hidden field was involved; #99 makes that the rule for every all-on-screen entry.

**Rule** (pure helper `serverErrorToast`, spec'd — replaces #98's `claimedErrorPaths`). Per 4xx error entry, with "on screen" as in `isFieldOnScreen` (a condition-false or unclaimed hidden field is off screen, a claimed hidden field is on screen, #98):

- some path errors off screen and they carry a message → those messages (`OffScreenErrorsToast`, #97), whether or not on-screen ones are mixed in;
- the entry carries at least one path error and every path is on screen → `t('error:correctInvalidFields')` ("Please correct invalid fields.", the same toast client-side validation and #98's claimed case use; new helper `allErrorPathsOnScreen`);
- otherwise (no path errors at all, or off-screen paths with no message of their own) → the stock `FieldErrorsToast`.

**Spec'd.** `offScreenFieldErrors.spec.ts`: the #98 claimed case now asserts `allErrorPathsOnScreen`; new `serverErrorToast (#99)` block (8 cases: all visible → correctInvalidFields; an unlabelled raw-path sentence → correctInvalidFields; a claimed hidden path counts on screen; an unclaimed hidden path toasts its message; mixed → off-screen messages only; all off screen → their messages; message-less off-screen paths → stock, including when mixed with an on-screen one; no path errors → stock).

**Not changed.** ADD_SERVER_ERRORS (the per-field frame), 5xx handling (#94), the claim registry and the tab badge (#98/#90). `BulkUpload/FormsManager` keeps the stock `FieldErrorsToast`: it has its own submit loop and never went through the #97/#98 decision, so it does not share this code path.

---

## Summary

Recounted 2026-06-22: 62 entry headers across the catalog. Note `#46` is used **twice** (two unrelated changes — "List Status Cell Shows Changed" and "`payload.validate()` Dry-Run"), and `#2` is **DROPPED** (absorbed upstream in v3.85.0). That leaves **62 active changes**. Category counts below are a best-effort classification — several entries straddle fix/feature (a behavior correction that also adds a prop), so treat the split as indicative, not exact. _(Updated 2026-06-29: +#69 → 63 active. Updated 2026-07-02: +#70 → 64 active. Updated 2026-07-23: +#71 → 65 active. Updated 2026-07-24: +#72 → 66 active. Updated 2026-08-01: +#73 → 67 active. Updated 2026-08-24: +#74 and +#75 → 69 active. Updated 2026-08-31: +#76 → 70 active. Updated 2026-08-31: +#77 → 71 active. Updated 2026-09-01: +#78 → 72 active. Updated 2026-09-05: +#80 → 72 active per the table recount; #79 cut and reverted the same day, number retired. Updated 2026-09-06: +#81 → 73 active. Updated 2026-09-07: +#82 → 74 active. Updated 2026-09-13: +#86 → 78 active, revising #81. Updated 2026-09-16: +#87 → 79 active. Updated 2026-09-19: +#88, +#89 and +#90 → 82 active. Updated 2026-09-23: +#91, +#92, +#93 and +#94 → 86 active. Updated 2026-09-24: +#95 (fixes #93), +#96 (revises #92) and +#97 → 89 active. Updated 2026-09-24: +#98 (revises #97 and #90) → 90 active. Updated 2026-09-24: +#99 (revises #97 and #98) → 91 active.)_

| Category           | Count  |
| ------------------ | ------ |
| Bug Fixes          | 21     |
| Features           | 56     |
| Documentation      | 1      |
| Dropped (absorbed) | 1      |
| **Total active**   | **78** |
