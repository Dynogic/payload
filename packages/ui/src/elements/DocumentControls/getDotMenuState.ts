/**
 * Fork change #91 — the ⋯ document menu for a read-only viewer is shown
 * INERT, not hidden ("disable, don't hide").
 *
 * The stock rule rendered the menu only when it had something the viewer
 * could do (collection: create or delete permission; global: drafts or
 * localization). A viewer with no update permission therefore lost the
 * affordance entirely, and the header read as if the document had no
 * actions at all. Now:
 *
 *  - `show`  — where the menu belongs (not disabled by the host, not in a
 *              create drawer, a saved collection doc or a global with menu
 *              entries) AND either something in it is actionable or the
 *              viewer is read-only.
 *  - `inert` — shown, but nothing in it is actionable: the trigger renders
 *              disabled and cannot open.
 *
 * "Actionable" is the stock test for a collection (create → Duplicate,
 * delete → Delete). For a global every entry (copy-to-locale, unpublish)
 * writes the document, so it is the update permission.
 */
export const getDotMenuState = ({
  id,
  disableActions,
  hasCreatePermission,
  hasDeletePermission,
  hasSavePermission,
  hasVersionsOrLocalization,
  isCollection,
  isCreateDrawer,
  isGlobal,
}: {
  disableActions?: boolean
  hasCreatePermission?: boolean
  hasDeletePermission?: boolean
  hasSavePermission?: boolean
  /** Global only: drafts enabled or localization configured (the stock global test). */
  hasVersionsOrLocalization?: boolean
  id?: number | string
  isCollection: boolean
  isCreateDrawer?: boolean
  isGlobal: boolean
}): { inert: boolean; show: boolean } => {
  const placed = Boolean(
    !disableActions &&
      // Fork change #45: never in a create drawer.
      !isCreateDrawer &&
      ((isCollection && id) || (isGlobal && hasVersionsOrLocalization)),
  )

  const actionable = isCollection
    ? Boolean(hasCreatePermission || hasDeletePermission)
    : Boolean(hasSavePermission)

  const show = placed && (actionable || !hasSavePermission)

  return { inert: show && !actionable, show }
}
