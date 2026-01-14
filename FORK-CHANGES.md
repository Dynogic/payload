# Fork Changes

## Bug Fixes

### 1. Tab ID State Key Fix

**File:** `packages/ui/src/forms/fieldSchemasToFormState/addFieldStatePromise.ts`

Fixed tab condition state tracking for nested tabs. Previously used just `field.id`, now uses `parentPath.field.id` for array items. This fixes tabs inside arrays not properly tracking their condition state.

### 2. Folder View "Create" Buttons Swapped

**File:** `packages/ui/src/views/CollectionFolder/index.tsx`

The "Create Document" and "Create Folder" buttons were swapped/mislabeled in the empty folder state. Fixed so correct labels match correct actions.

---

## Features

### 3. Hash-Based Tab Navigation

**File:** `packages/ui/src/fields/Tabs/index.tsx`

- Tabs now use URL hash (`#tab-name`) instead of preferences storage
- Enables shareable/bookmarkable tab URLs
- Listens to `hashchange` events for browser back/forward navigation
- Handles Next.js navigation (which doesn't trigger hashchange)
- SSR-safe: initializes to first visible tab, then switches to hash-selected tab after hydration
- Removed dependency on `usePreferences` and `useDocumentInfo`

### 4. Dynamic Routes for Multi-Tenant

**Files:** `packages/payload/src/config/createDynamicRoutes.ts`, `packages/payload/src/config/defaults.ts`

- New `createDynamicRoutes()` helper for request-time route resolution
- Fixed `defaults.ts` to preserve getters when merging routes (spread was resolving them prematurely)
- Useful for multi-tenant setups where admin/api routes vary by request context

### 5. Field-Level URL Parameter Defaults

**Files:** `packages/payload/src/fields/config/types.ts`, `packages/payload/src/admin/forms/Form.ts`, `packages/next/src/views/Document/index.tsx`

- New `urlParam` field config option to populate default values from URL query parameters
- Passes search params as `defaultValues` during document creation

### 6. MIME Type Validation for Uploads

**File:** `packages/ui/src/elements/Upload/index.tsx`, `packages/ui/src/fields/Upload/index.tsx`

- New `allowedMimeTypes` prop for Upload component
- New `onInvalidFile` callback for handling invalid file types
- Validates file types client-side before upload begins
- Supports wildcard patterns like `audio/*`, `image/*`

### 7. Upload filterOptions in Lexical Rich Text

**Files:** `packages/richtext-lexical/src/features/upload/server/index.ts`, `packages/richtext-lexical/src/features/upload/client/drawer/index.tsx`, `packages/ui/src/elements/DocumentDrawer/*`

- New `filterOptions` prop for `UploadFeature` in Lexical editor
- Allows filtering upload collections based on context (user, field values, etc.)
- Passes through DocumentDrawer for filtered upload selection

### 8. File Type Icons in Folder View

**Files:** `packages/ui/src/elements/FolderView/FolderFileCard/index.tsx`, `packages/ui/src/elements/FolderView/FolderFileCard/getFileIcon.tsx`, `packages/ui/src/icons/*`

- New icons: `FileIcon`, `ImageIcon`, `VideoIcon`
- Folder view now shows appropriate icon based on file MIME type
- Images show image icon, videos show video icon, others show generic file icon

### 9. Upload Progress in UI

**Files:** `packages/translations/src/languages/*.ts` (43 files)

- Upload status now shows percentage: `"Uploading ({{progress}}%)"`
- Bulk upload shows: `"Uploading {{current}} of {{total}} ({{progress}}%)"`

### 10. Upload Handler Enhancements

**Files:** `packages/plugin-cloud-storage/src/client/createClientUploadHandler.tsx`, `packages/ui/src/providers/UploadHandlers/index.tsx`

- Extended upload handlers with `formData` and `onProgress` callback support
- Enables progress tracking for cloud storage uploads

### 11. Markdown Paste Support in Lexical

**Files:** `packages/richtext-lexical/src/lexical/plugins/MarkdownPaste/index.tsx`, `packages/richtext-lexical/src/lexical/LexicalEditor.tsx`

- Pasting markdown text auto-formats it (e.g., `**bold**` becomes bold)
- Uses existing markdown transformer infrastructure
- Cmd+Shift+V (or Ctrl+Shift+V) pastes without markdown formatting
- Detects markdown patterns to avoid false positives on regular text

---

## Configuration/Documentation

### 12. Fork Development Workflow

**Files:** `FORK-DEVELOPMENT.md`, `.gitattributes`, `.gitignore`

- Documentation for building and using the fork locally
- Git LFS tracking for packed `.tgz` files

---

## Summary

| Category      | Count |
| ------------- | ----- |
| Bug Fixes     | 2     |
| Features      | 9     |
| Documentation | 1     |
