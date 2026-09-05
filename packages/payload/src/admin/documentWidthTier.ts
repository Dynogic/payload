/**
 * FORK (#79): admin page width tiers.
 *
 * A document view declares how wide its page may grow through
 * `admin.custom.widthTier` on the collection / global (the document default)
 * and on any tab (`tab.admin.custom.widthTier`, the active tab's declaration
 * overrides the document's). `DocumentFields` stamps the resolved tier on its
 * root as `data-width-tier`; the Tabs field stamps the active tab's content
 * div. The cap itself is CSS (DocumentFields/index.scss), keyed on tokens the
 * consuming app may override (`--page-width-form|wide|editor`,
 * `--page-fields-column`) with these px references as fallbacks:
 *
 *   form       950px  (default — a 638px fields column + a reserved side column)
 *   wide      1280px
 *   editor    1600px
 *   fullbleed  none
 *
 * Inside a drawer nothing is stamped — a drawer's document is never capped.
 */
export type DocumentWidthTier = 'editor' | 'form' | 'fullbleed' | 'wide'

export const documentWidthTiers: readonly DocumentWidthTier[] = [
  'form',
  'wide',
  'editor',
  'fullbleed',
]

export const defaultDocumentWidthTier: DocumentWidthTier = 'form'

/** The declared value if it is a known tier, else `undefined` (the caller decides the fallback). */
export function resolveDocumentWidthTier(value: unknown): DocumentWidthTier | undefined {
  return typeof value === 'string' && (documentWidthTiers as readonly string[]).includes(value)
    ? (value as DocumentWidthTier)
    : undefined
}
