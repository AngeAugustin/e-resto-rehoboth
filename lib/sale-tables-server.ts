import "server-only";

import type { FilterQuery } from "mongoose";
import { Types } from "mongoose";

export function saleTableIdsFromDocument(sale: {
  tables?: Types.ObjectId[] | null;
  table?: Types.ObjectId | null;
}): string[] {
  if (sale.tables && sale.tables.length > 0) {
    return sale.tables.map((t) => t.toString());
  }
  if (sale.table) return [sale.table.toString()];
  return [];
}

/** Corps JSON : `tableIds` (prioritaire) ou `tableId` legacy. */
export function parseTableIdsFromRequestBody(body: {
  tableIds?: unknown;
  tableId?: unknown;
}): string[] | null {
  if (Array.isArray(body.tableIds)) {
    const ids = [
      ...new Set(
        body.tableIds.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      ),
    ];
    return ids.length > 0 ? ids : null;
  }
  if (typeof body.tableId === "string" && body.tableId.trim().length > 0) {
    return [body.tableId.trim()];
  }
  return null;
}

/**
 * Filtre ventes PENDING qui utilisent l’une des tables.
 * Les appelants doivent fusionner avec `withExercice(exerciceId, …)`.
 */
export function pendingSaleUsesAnyTableFilter(
  tableIds: string[],
  excludeSaleId?: string
): FilterQuery<{ status: string }> {
  const filter: FilterQuery<{ status: string }> = {
    status: "PENDING",
    $or: [{ tables: { $in: tableIds } }, { table: { $in: tableIds } }],
  };
  if (excludeSaleId) {
    filter._id = { $ne: excludeSaleId };
  }
  return filter;
}
