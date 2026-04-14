import type { PaginatedDocs, PayloadRequest, SanitizedCollectionConfig } from 'payload'

/**
 * Enriches list view documents with correct draft status display.
 * When draft=true is used in the query, Payload returns the latest draft version if it exists.
 * This function checks if draft documents also have a published version to determine "changed" status.
 *
 * Performance: Uses a single query to find all documents with "changed" status instead of N queries.
 */
export async function enrichDocsWithVersionStatus({
  collectionConfig,
  data,
  req,
}: {
  collectionConfig: SanitizedCollectionConfig
  data: PaginatedDocs
  req: PayloadRequest
}): Promise<PaginatedDocs> {
  const draftsEnabled = collectionConfig?.versions?.drafts

  if (!draftsEnabled || !data?.docs?.length) {
    return data
  }

  // Find all draft documents
  // When querying with draft:true, we get the latest draft if it exists
  // We need to check if these drafts have a published version
  const draftDocs = data.docs.filter((doc) => doc._status === 'draft')

  if (draftDocs.length === 0) {
    return data
  }

  const draftDocIds = draftDocs.map((doc) => doc.id).filter(Boolean)

  if (draftDocIds.length === 0) {
    return data
  }

  // Determine which of the draft-resolved docs are in a "Changed" state vs
  // a true "Draft" state.
  //
  // Why we query the main collection (committed state) instead of the versions
  // table:
  //
  //   The list view fetches with `draft: true`, which returns the latest
  //   version per doc — so a doc that was published and then edited as a draft
  //   (autosave) comes back with `_status: 'draft'` from the version record.
  //   The original implementation checked the versions table for any record
  //   with `version._status: 'published'`, but that flag lingers on old
  //   version records even after an explicit unpublish: unpublish writes a new
  //   draft version without removing or flagging the old published ones, so
  //   autosave-after-publish and unpublish become indistinguishable from the
  //   version records alone.
  //
  //   The main collection table's `_status` field, however, IS a reliable
  //   signal. In `update.ts`, the main table is only written when
  //   `isSavingDraft === false`: publish sets main._status to 'published',
  //   unpublish sets it to 'draft', and draft saves (autosave) leave it alone.
  //   So:
  //     - Published doc + pending autosave → main.'published', version.'draft' → "Changed"
  //     - Published doc → unpublished       → main.'draft', version.'draft'     → "Draft"
  //
  //   Querying the main collection (without `draft: true`) for docs still in
  //   `_status: 'published'` correctly identifies only the "Changed" case.
  try {
    const committedPublishedDocs = await req.payload.find({
      collection: collectionConfig.slug,
      depth: 0,
      limit: draftDocIds.length,
      overrideAccess: true,
      pagination: false,
      select: {
        _status: true,
      },
      where: {
        and: [
          {
            id: {
              in: draftDocIds,
            },
          },
          {
            _status: {
              equals: 'published',
            },
          },
        ],
      },
    })

    // Create a Set of doc IDs whose committed (main-table) state is still
    // 'published' — these are the ones with pending draft edits ("Changed").
    const currentlyPublishedSet = new Set(
      committedPublishedDocs.docs.map((doc) => doc.id).filter(Boolean),
    )

    // Enrich documents with display status
    const enrichedDocs = data.docs.map((doc) => {
      // Draft version + committed state still published → "Changed".
      // Draft version + committed state draft → true "Draft" (never published,
      // or explicitly unpublished).
      if (doc._status === 'draft' && currentlyPublishedSet.has(doc.id)) {
        return {
          ...doc,
          _displayStatus: 'changed' as const,
        }
      }

      return {
        ...doc,
        _displayStatus: doc._status as 'draft' | 'published',
      }
    })

    return {
      ...data,
      docs: enrichedDocs,
    }
  } catch (error) {
    // If there's an error querying versions, just return the original data
    req.payload.logger.error({
      err: error,
      msg: `Error checking version status for collection ${collectionConfig.slug}`,
    })
    return data
  }
}
