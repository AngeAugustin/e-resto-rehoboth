import { Types } from "mongoose";
import Exercice, { type IExerciceDocument } from "@/models/Exercice";
import AccountingPeriod from "@/models/AccountingPeriod";
import Sale from "@/models/Sale";
import Supply from "@/models/Supply";
import Expense from "@/models/Expense";
import CashSession from "@/models/CashSession";
import KitchenOrder from "@/models/KitchenOrder";
import Payroll from "@/models/Payroll";
import Immobilisation from "@/models/Immobilisation";

export type ActiveExercice = {
  _id: Types.ObjectId;
  name: string;
  startedAt: Date;
  closedAt?: Date;
  isActive: boolean;
  openingBalance: number;
  note?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const TRANSACTIONAL_MODELS = [
  Sale,
  Supply,
  Expense,
  CashSession,
  KitchenOrder,
  Payroll,
  Immobilisation,
] as const;

function toObjectId(id: string | Types.ObjectId): Types.ObjectId {
  return typeof id === "string" ? new Types.ObjectId(id) : id;
}

/** Filtre Mongo pour scoper une requête à un exercice. */
export function withExercice(
  exerciceId: string | Types.ObjectId,
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  return { ...extra, exercice: toObjectId(exerciceId) };
}

async function backfillMissingExercice(exerciceId: Types.ObjectId): Promise<void> {
  const filter = {
    $or: [{ exercice: { $exists: false } }, { exercice: null }],
  };
  await Promise.all(
    TRANSACTIONAL_MODELS.map((Model) => Model.updateMany(filter, { $set: { exercice: exerciceId } }))
  );
}

/**
 * Garantit qu’un exercice actif existe.
 * Première fois : crée « Exercice initial », reprend le solde AccountingPeriod s’il existe,
 * et rattache toutes les données transactionnelles existantes.
 */
export async function ensureActiveExercice(createdBy?: string | Types.ObjectId): Promise<ActiveExercice> {
  const active = await Exercice.findOne({ isActive: true }).lean<ActiveExercice | null>();
  if (active) {
    await backfillMissingExercice(active._id);
    return active;
  }

  const anyExercice = await Exercice.findOne().sort({ startedAt: -1 }).lean<ActiveExercice | null>();
  if (anyExercice) {
    await Exercice.updateOne({ _id: anyExercice._id }, { $set: { isActive: true, closedAt: null } });
    const restored = await Exercice.findById(anyExercice._id).lean<ActiveExercice | null>();
    if (restored) {
      await backfillMissingExercice(restored._id);
      return restored;
    }
  }

  const legacyPeriod = await AccountingPeriod.findOne().sort({ createdAt: 1 }).lean<{
    openingBalance: number;
    openedAt: Date;
    note?: string;
    createdBy: Types.ObjectId;
  } | null>();

  const creator =
    createdBy != null
      ? toObjectId(createdBy)
      : legacyPeriod?.createdBy ??
        (
          await Sale.findOne().select("createdBy").lean<{ createdBy: Types.ObjectId } | null>()
        )?.createdBy ??
        new Types.ObjectId();

  const created = await Exercice.create({
    name: legacyPeriod
      ? `Exercice ${new Date(legacyPeriod.openedAt).getFullYear()}`
      : `Exercice ${new Date().getFullYear()}`,
    startedAt: legacyPeriod?.openedAt ?? new Date(),
    isActive: true,
    openingBalance: legacyPeriod?.openingBalance ?? 0,
    note: legacyPeriod?.note,
    createdBy: creator,
  });

  await backfillMissingExercice(created._id);
  return created.toObject() as ActiveExercice;
}

export async function getActiveExercice(): Promise<ActiveExercice> {
  return ensureActiveExercice();
}

export async function getActiveExerciceId(): Promise<Types.ObjectId> {
  const exercice = await getActiveExercice();
  return exercice._id;
}

export async function getExerciceById(id: string): Promise<ActiveExercice | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  return Exercice.findById(id).lean<ActiveExercice | null>();
}

export function serializeExercice(exercice: ActiveExercice | IExerciceDocument) {
  const row = "toObject" in exercice && typeof exercice.toObject === "function" ? exercice.toObject() : exercice;
  return {
    _id: String(row._id),
    name: row.name,
    startedAt: new Date(row.startedAt).toISOString(),
    closedAt: row.closedAt ? new Date(row.closedAt).toISOString() : undefined,
    isActive: Boolean(row.isActive),
    openingBalance: Number(row.openingBalance ?? 0),
    note: row.note,
    createdBy: row.createdBy,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : undefined,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : undefined,
  };
}

export type OpenExerciceInput = {
  name: string;
  startedAt: Date;
  openingBalance: number;
  note?: string;
  createdBy: string | Types.ObjectId;
};

/**
 * Clôture l’exercice actif et en ouvre un nouveau.
 * Les données de l’ancien exercice restent archivées (filtrées hors UI courante).
 */
export async function openNewExercice(input: OpenExerciceInput): Promise<ActiveExercice> {
  const name = input.name.trim();
  if (!name) throw new Error("Le nom de l’exercice est requis");
  if (!Number.isFinite(input.openingBalance) || input.openingBalance < 0) {
    throw new Error("Solde d’ouverture invalide");
  }

  await ensureActiveExercice(input.createdBy);

  const now = new Date();
  await Exercice.updateMany(
    { isActive: true },
    { $set: { isActive: false, closedAt: input.startedAt.getTime() < now.getTime() ? input.startedAt : now } }
  );

  const created = await Exercice.create({
    name,
    startedAt: input.startedAt,
    isActive: true,
    openingBalance: input.openingBalance,
    note: input.note?.trim() || undefined,
    createdBy: toObjectId(input.createdBy),
  });

  return created.toObject() as ActiveExercice;
}

export async function updateActiveExerciceOpening(input: {
  openingBalance: number;
  openedAt?: Date;
  note?: string;
}): Promise<ActiveExercice> {
  const active = await ensureActiveExercice();
  if (!Number.isFinite(input.openingBalance) || input.openingBalance < 0) {
    throw new Error("Solde d’ouverture invalide");
  }

  const $set: Record<string, unknown> = {
    openingBalance: input.openingBalance,
  };
  if (input.openedAt) $set.startedAt = input.openedAt;
  if (input.note !== undefined) $set.note = input.note.trim() || undefined;

  await Exercice.updateOne({ _id: active._id }, { $set });
  const updated = await Exercice.findById(active._id).lean<ActiveExercice | null>();
  if (!updated) throw new Error("Exercice introuvable");
  return updated;
}
