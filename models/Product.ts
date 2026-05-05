import mongoose, { Schema, Document, Model } from "mongoose";
import { DEFAULT_PRODUCT_CATEGORY, PRODUCT_CATEGORIES } from "@/lib/product-categories";

export interface IProductDocument extends Document {
  name: string;
  category: string;
  image?: string;
  /** Si false, le produit n’apparaît pas dans les nouvelles ventes. */
  isActive: boolean;
  /** Prix de vente unitaire marché (référence catalogue, affichage et ventes). */
  marketSellingPrice: number;
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
    marketSellingPrice: {
      type: Number,
      required: [true, "Le prix de vente marché est requis"],
      validate: {
        validator(v: number) {
          return Number.isFinite(v) && v > 0;
        },
        message: "Le prix de vente marché doit être strictement positif",
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const existingModel = mongoose.models.Product as Model<IProductDocument> | undefined;

if (existingModel) {
  if (!existingModel.schema.path("category")) {
    existingModel.schema.add({
      category: {
        type: String,
        enum: PRODUCT_CATEGORIES,
        default: DEFAULT_PRODUCT_CATEGORY,
        trim: true,
      },
    });
  }
  if (!existingModel.schema.path("marketSellingPrice")) {
    existingModel.schema.add({
      marketSellingPrice: {
        type: Number,
        validate: {
          validator(v: number) {
            return v == null || (Number.isFinite(v) && v > 0);
          },
          message: "Le prix de vente marché doit être strictement positif",
        },
      },
    });
  }
  if (!existingModel.schema.path("isActive")) {
    existingModel.schema.add({
      isActive: {
        type: Boolean,
        default: true,
      },
    });
  }
}

const Product: Model<IProductDocument> =
  existingModel || mongoose.model<IProductDocument>("Product", ProductSchema);

export default Product;
