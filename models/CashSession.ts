import mongoose, { Schema, Document, Model } from "mongoose";

export type CashSessionStatus = "OPEN" | "CLOSED";
export type CashSessionKind = "BAR" | "KITCHEN";

export interface ICashSessionDocument extends Document {
  exercice: mongoose.Types.ObjectId;
  name: string;
  sessionDate: Date;
  openingFloat: number;
  /** Renseigné à la clôture : le fond a-t-il été repris ? */
  openingFloatRecovered?: boolean;
  /** BAR par défaut (sessions existantes sans champ). */
  kind: CashSessionKind;
  status: CashSessionStatus;
  closedAt?: Date;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CashSessionSchema = new Schema<ICashSessionDocument>(
  {
    exercice: {
      type: Schema.Types.ObjectId,
      ref: "Exercice",
      required: [true, "L’exercice est requis"],
      index: true,
    },
    name: {
      type: String,
      required: [true, "Le nom de session est requis"],
      trim: true,
    },
    sessionDate: {
      type: Date,
      required: [true, "La date de session est requise"],
      index: true,
    },
    openingFloat: {
      type: Number,
      required: [true, "Le fond de caisse est requis"],
      min: [0, "Le fond de caisse ne peut pas être négatif"],
    },
    openingFloatRecovered: {
      type: Boolean,
      required: false,
    },
    kind: {
      type: String,
      enum: ["BAR", "KITCHEN"],
      default: "BAR",
      index: true,
    },
    status: {
      type: String,
      enum: ["OPEN", "CLOSED"],
      default: "OPEN",
      index: true,
    },
    closedAt: {
      type: Date,
      required: false,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

CashSessionSchema.index({ status: 1, createdAt: -1 });
CashSessionSchema.index({ kind: 1, status: 1, createdAt: -1 });
CashSessionSchema.index({ exercice: 1, kind: 1, status: 1, createdAt: -1 });

const existingModel = mongoose.models.CashSession as Model<ICashSessionDocument> | undefined;

if (
  (existingModel && !existingModel.schema.path("kind")) ||
  (existingModel && !existingModel.schema.path("exercice"))
) {
  mongoose.deleteModel("CashSession");
}

const CashSession: Model<ICashSessionDocument> =
  (mongoose.models.CashSession as Model<ICashSessionDocument> | undefined) ||
  mongoose.model<ICashSessionDocument>("CashSession", CashSessionSchema);

export default CashSession;
