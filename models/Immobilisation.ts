import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IImmobilisationDocument extends Document {
  exercice: Types.ObjectId;
  name: string;
  amount: number;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ImmobilisationSchema = new Schema<IImmobilisationDocument>(
  {
    exercice: {
      type: Schema.Types.ObjectId,
      ref: "Exercice",
      required: [true, "L’exercice est requis"],
      index: true,
    },
    name: {
      type: String,
      required: [true, "Le nom est requis"],
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, "Le montant est requis"],
      min: [0, "Le montant ne peut pas être négatif"],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

ImmobilisationSchema.index({ createdAt: -1 });
ImmobilisationSchema.index({ exercice: 1, createdAt: -1 });

const existingImmobilisation = mongoose.models.Immobilisation as Model<IImmobilisationDocument> | undefined;
if (existingImmobilisation && !existingImmobilisation.schema.path("exercice")) {
  mongoose.deleteModel("Immobilisation");
}

const Immobilisation: Model<IImmobilisationDocument> =
  (mongoose.models.Immobilisation as Model<IImmobilisationDocument> | undefined) ||
  mongoose.model<IImmobilisationDocument>("Immobilisation", ImmobilisationSchema);

export default Immobilisation;
