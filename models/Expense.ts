import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IExpenseDocument extends Document {
  exercice: Types.ObjectId;
  label: string;
  category: Types.ObjectId;
  amount: number;
  date: Date;
  paymentMethod: Types.ObjectId;
  comment?: string;
  attachmentUrl?: string;
  immobilisation?: Types.ObjectId;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseSchema = new Schema<IExpenseDocument>(
  {
    exercice: {
      type: Schema.Types.ObjectId,
      ref: "Exercice",
      required: [true, "L’exercice est requis"],
      index: true,
    },
    label: {
      type: String,
      required: [true, "Le libellé est requis"],
      trim: true,
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: "ExpenseCategory",
      required: [true, "La catégorie est requise"],
    },
    amount: {
      type: Number,
      required: [true, "Le montant est requis"],
      min: [0, "Le montant ne peut pas être négatif"],
    },
    date: {
      type: Date,
      required: [true, "La date est requise"],
    },
    paymentMethod: {
      type: Schema.Types.ObjectId,
      ref: "ExpensePaymentMethod",
      required: [true, "Le mode de paiement est requis"],
    },
    comment: {
      type: String,
      trim: true,
    },
    attachmentUrl: {
      type: String,
      trim: true,
    },
    immobilisation: {
      type: Schema.Types.ObjectId,
      ref: "Immobilisation",
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

ExpenseSchema.index({ date: -1 });
ExpenseSchema.index({ category: 1, date: -1 });
ExpenseSchema.index({ immobilisation: 1, date: -1 });
ExpenseSchema.index({ exercice: 1, date: -1 });

const existingExpense = mongoose.models.Expense as Model<IExpenseDocument> | undefined;
if (
  (existingExpense && !existingExpense.schema.path("immobilisation")) ||
  (existingExpense && !existingExpense.schema.path("exercice"))
) {
  mongoose.deleteModel("Expense");
}

const Expense: Model<IExpenseDocument> =
  (mongoose.models.Expense as Model<IExpenseDocument> | undefined) ||
  mongoose.model<IExpenseDocument>("Expense", ExpenseSchema);

export default Expense;
