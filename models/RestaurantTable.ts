import mongoose, { Schema, Document, Model } from "mongoose";

export interface IRestaurantTableDocument extends Document {
  number: number;
  name?: string;
  capacity?: number;
  createdAt: Date;
  updatedAt: Date;
}

const RestaurantTableSchema = new Schema<IRestaurantTableDocument>(
  {
    number: {
      type: Number,
      required: [true, "Le numéro de table est requis"],
      unique: true,
      min: [1, "Le numéro de table doit être au moins 1"],
    },
    name: {
      type: String,
      trim: true,
    },
    capacity: {
      type: Number,
      min: [1, "La capacité doit être au moins 1"],
    },
  },
  { timestamps: true }
);

const RestaurantTable: Model<IRestaurantTableDocument> =
  mongoose.models.RestaurantTable ||
  mongoose.model<IRestaurantTableDocument>("RestaurantTable", RestaurantTableSchema);

export default RestaurantTable;
