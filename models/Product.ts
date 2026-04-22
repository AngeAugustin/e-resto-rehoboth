import mongoose, { Schema, Document, Model } from "mongoose";
import { DEFAULT_PRODUCT_CATEGORY, PRODUCT_CATEGORIES } from "@/lib/product-categories";

export interface IProductDocument extends Document {
  name: string;
  category: string;
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
    category: {
      type: String,
      enum: PRODUCT_CATEGORIES,
      default: DEFAULT_PRODUCT_CATEGORY,
      trim: true,
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

const existingModel = mongoose.models.Product as Model<IProductDocument> | undefined;

if (existingModel && !existingModel.schema.path("category")) {
  // En dev, le modèle peut rester en cache sans le nouveau champ.
  existingModel.schema.add({
    category: {
      type: String,
      enum: PRODUCT_CATEGORIES,
      default: DEFAULT_PRODUCT_CATEGORY,
      trim: true,
    },
  });
}

const Product: Model<IProductDocument> =
  existingModel || mongoose.model<IProductDocument>("Product", ProductSchema);

export default Product;
