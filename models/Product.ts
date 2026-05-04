import mongoose, { Schema, Document, Model } from "mongoose";
import { DEFAULT_PRODUCT_CATEGORY, PRODUCT_CATEGORIES } from "@/lib/product-categories";

export interface IProductDocument extends Document {
  name: string;
  category: string;
  image?: string;
  /** Si false, le produit n’apparaît pas dans les nouvelles ventes. */
  isActive: boolean;
  /** Prix catalogue SOBEBRA (référence, toujours inférieur au prix marché) */
  sellingPrice: number;
  /** Prix de vente unitaire marché par défaut (prérempli à l’appro ; modifiable) */
  defaultMarketSellingPrice?: number;
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
    defaultMarketSellingPrice: {
      type: Number,
      min: [0, "Le prix marché ne peut pas être négatif"],
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
  // En dev, le modèle peut rester en cache sans les nouveaux champs.
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
  if (!existingModel.schema.path("defaultMarketSellingPrice")) {
    existingModel.schema.add({
      defaultMarketSellingPrice: {
        type: Number,
        min: [0, "Le prix marché ne peut pas être négatif"],
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
