/**
 * Fork #61's three drawer save behaviors, picked through
 * `drawerContext.saveMode`:
 *  - 'saveAndAdd' : #45 — lone "Save & Add" (create) / "Save" (edit), autosave off.
 *  - 'default'    : upstream Payload — the full-page controls.
 *  - 'createEdit' : create → Save Draft + Publish (close on save); edit →
 *                   autosave + Publish, as on the full page.
 */
export type DrawerSaveMode = 'createEdit' | 'default' | 'saveAndAdd'

/**
 * Fork #129 — the save mode a document drawer runs in when the caller does
 * not name one.
 *
 * An EXISTING document (the drawer has an id) of a collection with DRAFTS
 * defaults to 'createEdit': its edit form autosaves into the draft and
 * publishes through Publish, exactly as on the full page. The #45 default
 * ('saveAndAdd') drew a lone Save there, which submits without `draft=true`
 * and so wrote the live document straight past the draft workflow.
 *
 * Everything else keeps 'saveAndAdd':
 *  - a CREATE drawer, drafts or not: #45's "Save & Add" creates the document
 *    with its `_status` field's default (`draft`), so nothing is published,
 *    and closing with the new id is what a relationship's "add new" wants. A
 *    caller that wants Save Draft + Publish there still opts into
 *    'createEdit' (with `createLabels`).
 *  - an existing document of a collection WITHOUT drafts: Save is its only
 *    write, as on the full page.
 *
 * An explicit `saveMode` always wins.
 */
export const resolveDrawerSaveMode = ({
  draftsEnabled,
  isCreateDrawer,
  saveMode,
}: {
  draftsEnabled: boolean
  isCreateDrawer: boolean
  saveMode?: DrawerSaveMode
}): DrawerSaveMode => {
  if (saveMode) {
    return saveMode
  }

  return draftsEnabled && !isCreateDrawer ? 'createEdit' : 'saveAndAdd'
}
