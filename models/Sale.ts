import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface ISaleItemDocument {
  product: Types.ObjectId;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ISaleDocument extends Document {
  waitress: Types.ObjectId;
  table: Types.ObjectId;
  items: ISaleItemDocument[];
  totalAmount: number;
  amountPaid?: number;
  change?: number;
  paymentMethod?: "CASH" | "MOBILE_MONEY";
  status: "PENDING" | "COMPLETED";
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SaleItemSchema = new Schema<ISaleItemDocument>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, "La quantité doit être au moins 1"],
    },
    unitPrice: {
      type: Number,
      required: true,
      min: [0, "Le prix ne peut pas être négatif"],
    },
    total: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const SaleSchema = new Schema<ISaleDocument>(
  {
    waitress: {
      type: Schema.Types.ObjectId,
      ref: "Waitress",
      required: [true, "La serveuse est requise"],
    },
    table: {
      type: Schema.Types.ObjectId,
      ref: "RestaurantTable",
      required: [true, "La table est requise"],
    },
    items: {
      type: [SaleItemSchema],
      validate: {
        validator: (items: ISaleItemDocument[]) => items.length > 0,
        message: "La vente doit contenir au moins un produit",
      },
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    amountPaid: {
      type: Number,
      min: 0,
    },
    change: {
      type: Number,
      default: 0,
    },
    paymentMethod: {
      type: String,
      enum: ["CASH", "MOBILE_MONEY"],
    },
    status: {
      type: String,
      enum: ["PENDING", "COMPLETED"],
      default: "PENDING",
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

SaleSchema.index({ status: 1, createdAt: -1 });

const Sale: Model<ISaleDocument> =
  mongoose.models.Sale || mongoose.model<ISaleDocument>("Sale", SaleSchema);

export default Sale;
