import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface ISupplyDocument extends Document {
  product: Types.ObjectId;
  lotSize: number;
  lotPrice: number;
  numberOfLots: number;
  marketSellingPrice: number;
  totalUnits: number;
  totalCost: number;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SupplySchema = new Schema<ISupplyDocument>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Le produit est requis"],
    },
    lotSize: {
      type: Number,
      required: [true, "La taille du lot est requise"],
      min: [1, "La taille du lot doit être au moins 1"],
    },
    lotPrice: {
      type: Number,
      required: [true, "Le prix du lot est requis"],
      min: [0, "Le prix ne peut pas être négatif"],
    },
    numberOfLots: {
      type: Number,
      required: [true, "Le nombre de lots est requis"],
      min: [1, "Le nombre de lots doit être au moins 1"],
    },
    marketSellingPrice: {
      type: Number,
      required: [true, "Le prix de vente marché est requis"],
      min: [0, "Le prix ne peut pas être négatif"],
    },
    totalUnits: {
      type: Number,
      required: true,
    },
    totalCost: {
      type: Number,
      required: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

SupplySchema.index({ product: 1 });

// Auto-calculate derived fields before save
SupplySchema.pre("save", function (next) {
  this.totalUnits = this.lotSize * this.numberOfLots;
  this.totalCost = this.lotPrice * this.numberOfLots;
  next();
});

const Supply: Model<ISupplyDocument> =
  mongoose.models.Supply || mongoose.model<ISupplyDocument>("Supply", SupplySchema);

export default Supply;
