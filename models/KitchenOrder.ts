import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IKitchenOrderItemDocument {
  menu: Types.ObjectId;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface IKitchenOrderDocument extends Document {
  exercice: Types.ObjectId;
  cook: Types.ObjectId;
  kitchenWaitress?: Types.ObjectId;
  plate: Types.ObjectId;
  items: IKitchenOrderItemDocument[];
  totalAmount: number;
  amountPaid?: number;
  change?: number;
  changeReturnedAck?: boolean;
  paymentMethod?: "CASH" | "MOBILE_MONEY";
  status: "PENDING" | "COMPLETED" | "CANCELLED";
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const KitchenOrderItemSchema = new Schema<IKitchenOrderItemDocument>(
  {
    menu: {
      type: Schema.Types.ObjectId,
      ref: "Menu",
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

const KitchenOrderSchema = new Schema<IKitchenOrderDocument>(
  {
    exercice: {
      type: Schema.Types.ObjectId,
      ref: "Exercice",
      required: [true, "L’exercice est requis"],
      index: true,
    },
    cook: {
      type: Schema.Types.ObjectId,
      ref: "Cook",
      required: [true, "La cuisinière est requise"],
    },
    kitchenWaitress: {
      type: Schema.Types.ObjectId,
      ref: "KitchenWaitress",
    },
    plate: {
      type: Schema.Types.ObjectId,
      ref: "KitchenPlate",
      required: [true, "La plaquette est requise"],
    },
    items: {
      type: [KitchenOrderItemSchema],
      validate: {
        validator: (items: IKitchenOrderItemDocument[]) => items.length > 0,
        message: "La commande doit contenir au moins un menu",
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

KitchenOrderSchema.index({ status: 1, createdAt: -1 });
KitchenOrderSchema.index({ plate: 1, status: 1 });
KitchenOrderSchema.index({ kitchenWaitress: 1, createdAt: -1 });
KitchenOrderSchema.index({ exercice: 1, status: 1, createdAt: -1 });

const existingKitchenOrder = mongoose.models.KitchenOrder as Model<IKitchenOrderDocument> | undefined;
if (
  (existingKitchenOrder && !existingKitchenOrder.schema.path("kitchenWaitress")) ||
  (existingKitchenOrder && !existingKitchenOrder.schema.path("exercice"))
) {
  if (existingKitchenOrder && !existingKitchenOrder.schema.path("exercice")) {
    mongoose.deleteModel("KitchenOrder");
  } else if (existingKitchenOrder && !existingKitchenOrder.schema.path("kitchenWaitress")) {
    existingKitchenOrder.schema.add({
      kitchenWaitress: { type: Schema.Types.ObjectId, ref: "KitchenWaitress" },
    });
  }
}

const KitchenOrder: Model<IKitchenOrderDocument> =
  (mongoose.models.KitchenOrder as Model<IKitchenOrderDocument> | undefined) ||
  mongoose.model<IKitchenOrderDocument>("KitchenOrder", KitchenOrderSchema);

export default KitchenOrder;
