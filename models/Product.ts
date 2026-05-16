import mongoose, { Schema, Document, Model } from "mongoose";
import { DEFAULT_PRODUCT_CATEGORY } from "@/lib/product-categories";

export interface IProductDocument extends Document {
  name: string;
  category: string;
  image?: string;
  /** Si false, le produit n’apparaît pas dans les nouvelles ventes. */
  isActive: boolean;
  /** Prix de vente unitaire marché (référence catalogue, affichage et ventes). */
  marketSellingPrice: number;
  /** Quantité d’unités dans un casier / pack standard (référence appro & import). */
  quantiteStandardPack?: number;
  /** Prix d’achat d’un casier standard en FCFA (référence appro & import). */
  prixCasier?: number;
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
    quantiteStandardPack: {
      type: Number,
      validate: {
        validator(v: number | null | undefined) {
          return v == null || (Number.isFinite(v) && Number.isInteger(v) && v >= 1);
        },
        message: "La quantité standard pack doit être un entier ≥ 1",
      },
    },
    prixCasier: {
      type: Number,
      validate: {
        validator(v: number | null | undefined) {
          return v == null || (Number.isFinite(v) && v >= 0);
        },
        message: "Le prix casier doit être un nombre ≥ 0",
      },
    },
  },
  { timestamps: true }
);

const existingModel = mongoose.models.Product as Model<IProductDocument> | undefined;

if (existingModel) {
  const categoryPath = existingModel.schema.path("category") as
    | {
        enumValues?: string[];
        options?: { enum?: unknown };
        validators?: Array<{ type?: string }>;
      }
    | undefined;
  if (categoryPath) {
    if (Array.isArray(categoryPath.enumValues)) {
      categoryPath.enumValues = [];
    }
    if (categoryPath.options && "enum" in categoryPath.options) {
      delete categoryPath.options.enum;
    }
    if (Array.isArray(categoryPath.validators)) {
      categoryPath.validators = categoryPath.validators.filter((v) => v.type !== "enum");
    }
  }

  if (!existingModel.schema.path("category")) {
    existingModel.schema.add({
      category: {
        type: String,
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
  if (!existingModel.schema.path("quantiteStandardPack")) {
    existingModel.schema.add({
      quantiteStandardPack: {
        type: Number,
        validate: {
          validator(v: number | null | undefined) {
            return v == null || (Number.isFinite(v) && Number.isInteger(v) && v >= 1);
          },
          message: "La quantité standard pack doit être un entier ≥ 1",
        },
      },
    });
  }
  if (!existingModel.schema.path("prixCasier")) {
    existingModel.schema.add({
      prixCasier: {
        type: Number,
        validate: {
          validator(v: number | null | undefined) {
            return v == null || (Number.isFinite(v) && v >= 0);
          },
          message: "Le prix casier doit être un nombre ≥ 0",
        },
      },
    });
  }
}

const Product: Model<IProductDocument> =
  existingModel || mongoose.model<IProductDocument>("Product", ProductSchema);

export default Product;
