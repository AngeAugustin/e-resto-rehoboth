import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type PayrollBeneficiaryType = "WAITRESS" | "KITCHEN_WAITRESS" | "COOK" | "MANAGER";

export interface IPayrollDocument extends Document {
  exercice: Types.ObjectId;
  beneficiaryType: PayrollBeneficiaryType;
  waitress?: Types.ObjectId;
  kitchenWaitress?: Types.ObjectId;
  cook?: Types.ObjectId;
  user?: Types.ObjectId;
  jobTitle?: Types.ObjectId;
  periodStart: Date;
  periodEnd: Date;
  baseSalary: number;
  bonuses?: { name: string; amount: number }[];
  bonusName?: string;
  bonusAmount: number;
  amount: number;
  paidAt: Date;
  comment?: string;
  attachmentUrl?: string;
  isPaid?: boolean;
  promoter?: {
    user: Types.ObjectId;
    firstName: string;
    lastName: string;
    signatureUrl?: string;
  };
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PayrollSchema = new Schema<IPayrollDocument>(
  {
    exercice: {
      type: Schema.Types.ObjectId,
      ref: "Exercice",
      required: [true, "L’exercice est requis"],
      index: true,
    },
    beneficiaryType: {
      type: String,
      enum: ["WAITRESS", "KITCHEN_WAITRESS", "COOK", "MANAGER"],
      required: true,
    },
    waitress: { type: Schema.Types.ObjectId, ref: "Waitress" },
    kitchenWaitress: { type: Schema.Types.ObjectId, ref: "KitchenWaitress" },
    cook: { type: Schema.Types.ObjectId, ref: "Cook" },
    user: { type: Schema.Types.ObjectId, ref: "User" },
    jobTitle: { type: Schema.Types.ObjectId, ref: "JobTitle" },
    periodStart: {
      type: Date,
      required: [true, "Le début de période est requis"],
    },
    periodEnd: {
      type: Date,
      required: [true, "La fin de période est requise"],
    },
    baseSalary: {
      type: Number,
      min: [0, "Le salaire ne peut pas être négatif"],
    },
    bonuses: [
      {
        name: { type: String, required: true, trim: true },
        amount: { type: Number, required: true, min: 0 },
      },
    ],
    bonusName: {
      type: String,
      trim: true,
    },
    bonusAmount: {
      type: Number,
      default: 0,
      min: [0, "Le bonus ne peut pas être négatif"],
    },
    amount: {
      type: Number,
      required: [true, "Le montant est requis"],
      min: [0, "Le montant ne peut pas être négatif"],
    },
    paidAt: {
      type: Date,
      required: [true, "La date de paiement est requise"],
    },
    comment: {
      type: String,
      trim: true,
    },
    attachmentUrl: {
      type: String,
      trim: true,
    },
    isPaid: {
      type: Boolean,
      default: false,
    },
    promoter: {
      user: { type: Schema.Types.ObjectId, ref: "User" },
      firstName: { type: String, trim: true },
      lastName: { type: String, trim: true },
      signatureUrl: { type: String, trim: true },
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

PayrollSchema.index({ paidAt: -1 });
PayrollSchema.index({ beneficiaryType: 1, paidAt: -1 });
PayrollSchema.index({ exercice: 1, paidAt: -1 });

const existingPayroll = mongoose.models.Payroll as Model<IPayrollDocument> | undefined;
if (
  existingPayroll?.schema.path("supervisor") ||
  (existingPayroll && !existingPayroll.schema.path("bonusAmount")) ||
  (existingPayroll && !existingPayroll.schema.path("bonuses")) ||
  (existingPayroll && !existingPayroll.schema.path("kitchenWaitress")) ||
  (existingPayroll && !existingPayroll.schema.path("isPaid")) ||
  (existingPayroll && !existingPayroll.schema.path("promoter")) ||
  (existingPayroll && !existingPayroll.schema.path("exercice")) ||
  (existingPayroll &&
    !((existingPayroll.schema.path("beneficiaryType") as { enumValues?: string[] } | undefined)?.enumValues?.includes(
      "KITCHEN_WAITRESS"
    )))
) {
  mongoose.deleteModel("Payroll");
}

const Payroll: Model<IPayrollDocument> =
  (mongoose.models.Payroll as Model<IPayrollDocument> | undefined) ||
  mongoose.model<IPayrollDocument>("Payroll", PayrollSchema);

export default Payroll;
