import type { BaseSQLiteAdapter, DeleteWhere } from './types.js'

export const deleteWhere: DeleteWhere = async function (
  // Here 'this' is not a parameter. See:
  // https://www.typescriptlang.org/docs/handbook/2/classes.html#this-parameters
  this: BaseSQLiteAdapter,
  { db, returningIDs, tableName, where },
) {
  const table = this.tables[tableName]

  if (returningIDs) {
    // One statement: `DELETE … RETURNING id` names exactly the rows this statement removed, so a
    // row another writer removed first is simply not in it (fork change #128).
    const rows = await db.delete(table).where(where).returning({ id: table.id })
    return rows.map(({ id }) => id as number | string)
  }

  await db.delete(table).where(where)
}
