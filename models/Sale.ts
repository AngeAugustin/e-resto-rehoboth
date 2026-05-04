import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface ISaleItemDocument {
  product: Types.ObjectId;
  quantity: number;
  unitPrice: number;
  /** Coût d’achat unitaire (dernier appro au moment de la ligne), pour la marge */
  unitCost?: number;
  total: number;
}

export interface ISaleDocument extends Document {
  waitress: Types.ObjectId;
  /** Ancien schéma mono-table (migration automatique vers `tables`) */
  table?: Types.ObjectId;
  tables?: Types.ObjectId[];
  items: ISaleItemDocument[];
  totalAmount: number;
  amountPaid?: number;
  change?: number;
  /** À la clôture : confirmé par l’opérateur si une monnaie était à rendre */
  changeReturnedAck?: boolean;
  paymentMethod?: "CASH" | "MOBILE_MONEY";
  status: "PENDING" | "COMPLETED" | "CANCELLED";
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
    unitCost: {
      type: Number,
      min: [0, "Le coût ne peut pas être négatif"],
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
      required: false,
    },
    tables: {
      type: [Schema.Types.ObjectId],
      ref: "RestaurantTable",
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
    changeReturnedAck: {
      type: Boolean,
      required: false,
    },
    paymentMethod: {
      type: String,
      enum: ["CASH", "MOBILE_MONEY"],
    },
    status: {
      type: String,
      enum: ["PENDING", "COMPLETED", "CANCELLED"],
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

SaleSchema.pre("validate", function (next) {
  const tables = this.tables as Types.ObjectId[] | undefined;
  if ((!tables || tables.length === 0) && this.table) {
    this.set("tables", [this.table]);
  }
  if (!this.tables || this.tables.length === 0) {
    this.invalidate("tables", "Au moins une table est requise");
  }
  next();
});

SaleSchema.pre("save", function (next) {
  if (this.tables && this.tables.length > 0) {
    this.set("table", undefined);
  }
  next();
});

SaleSchema.index({ status: 1, createdAt: -1 });

const existingModel = mongoose.models.Sale as Model<ISaleDocument> | undefined;

if (existingModel) {
  const statusPath = existingModel.schema.path("status") as
    | (mongoose.SchemaType & { options?: { enum?: string[] } })
    | undefined;
  const enumValues = statusPath?.options?.enum;
  if (
    statusPath &&
    Array.isArray(enumValues) &&
    !enumValues.includes("CANCELLED")
  ) {
    statusPath.options = { ...statusPath.options, enum: [...enumValues, "CANCELLED"] };
  }
}

const Sale: Model<ISaleDocument> = existingModel || mongoose.model<ISaleDocument>("Sale", SaleSchema);

export default Sale;
