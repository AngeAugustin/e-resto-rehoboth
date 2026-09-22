import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IExerciceDocument extends Document {
  name: string;
  startedAt: Date;
  closedAt?: Date;
  isActive: boolean;
  openingBalance: number;
  note?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ExerciceSchema = new Schema<IExerciceDocument>(
  {
    name: {
      type: String,
      required: [true, "Le nom de l’exercice est requis"],
      trim: true,
    },
    startedAt: {
      type: Date,
      required: [true, "La date de début est requise"],
      index: true,
    },
    closedAt: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    openingBalance: {
      type: Number,
      required: [true, "Le solde d’ouverture est requis"],
      min: [0, "Le solde d’ouverture ne peut pas être négatif"],
      default: 0,
    },
    note: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

ExerciceSchema.index({ isActive: 1, startedAt: -1 });

const Exercice: Model<IExerciceDocument> =
  (mongoose.models.Exercice as Model<IExerciceDocument> | undefined) ||
  mongoose.model<IExerciceDocument>("Exercice", ExerciceSchema);

export default Exercice;
