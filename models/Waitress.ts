import mongoose, { Schema, Document, Model } from "mongoose";

export interface IWaitressDocument extends Document {
  firstName: string;
  lastName: string;
  phone?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WaitressSchema = new Schema<IWaitressDocument>(
  {
    firstName: {
      type: String,
      required: [true, "Le prénom est requis"],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, "Le nom est requis"],
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

const Waitress: Model<IWaitressDocument> =
  mongoose.models.Waitress || mongoose.model<IWaitressDocument>("Waitress", WaitressSchema);

export default Waitress;
