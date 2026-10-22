import type { TransactionPg } from '../types.js'
import type { DeleteWhere } from './types.js'

export const deleteWhere: DeleteWhere = async function deleteWhere({
  db,
  returningIDs,
  tableName,
  where,
}) {
  const table = this.tables[tableName]

  if (returningIDs) {
    // One statement: `DELETE … RETURNING id` names exactly the rows this statement removed, so a
    // row another writer removed first is simply not in it (fork change #128).
    const rows = await (db as TransactionPg).delete(table).where(where).returning({ id: table.id })
    return rows.map(({ id }) => id as number | string)
  }

  await (db as TransactionPg).delete(table).where(where)
}
