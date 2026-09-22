import { Types } from "mongoose";
import Expense from "@/models/Expense";
import { getActiveExerciceId, withExercice } from "@/lib/exercice";

export async function getVersedTotal(
  immobilisationId: string | Types.ObjectId,
  exerciceId?: string | Types.ObjectId
): Promise<number> {
  const eid = exerciceId ?? (await getActiveExerciceId());
  const rows = await Expense.aggregate<{ total: number }>([
    {
      $match: withExercice(eid, {
        immobilisation: new Types.ObjectId(String(immobilisationId)),
      }),
    },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  return rows[0]?.total ?? 0;
}

export async function getVersedTotalsByImmobilisation(
  immobilisationIds: Array<string | Types.ObjectId>,
  exerciceId?: string | Types.ObjectId
): Promise<Map<string, number>> {
  const ids = immobilisationIds.map((id) => new Types.ObjectId(String(id)));
  if (ids.length === 0) return new Map();

  const eid = exerciceId ?? (await getActiveExerciceId());
  const rows = await Expense.aggregate<{ _id: Types.ObjectId; total: number }>([
    {
      $match: withExercice(eid, {
        immobilisation: { $in: ids },
      }),
    },
    { $group: { _id: "$immobilisation", total: { $sum: "$amount" } } },
  ]);

  return new Map(rows.map((row) => [String(row._id), row.total]));
}
