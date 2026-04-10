import mongoose, { Schema, Document, Model } from "mongoose";

export interface IProductDocument extends Document {
  name: string;
  image?: string;
  sellingPrice: number;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProductDocument>(
  {
    name: {
      type: String,
      required: [true, "Le nom du produit est requis"],
      trim: true,
      unique: true,
    },
    image: {
      type: String,
      default: "",
    },
    sellingPrice: {
      type: Number,
      required: [true, "Le prix de vente est requis"],
      min: [0, "Le prix ne peut pas être négatif"],
      default: 0,
    },
  },
  { timestamps: true }
);

const Product: Model<IProductDocument> =
  mongoose.models.Product || mongoose.model<IProductDocument>("Product", ProductSchema);

export default Product;
