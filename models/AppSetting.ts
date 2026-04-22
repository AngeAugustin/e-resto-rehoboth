import mongoose, { Document, Model, Schema } from "mongoose";
import {
  DEFAULT_LOGO_URL,
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_SOLUTION_NAME,
  GLOBAL_SETTINGS_KEY,
} from "@/lib/app-settings";

export interface IAppSettingDocument extends Document {
  key: string;
  primaryColor: string;
  logoUrl: string;
  solutionName: string;
  lowStockAlertEmails: string[];
  createdAt: Date;
  updatedAt: Date;
}

const AppSettingSchema = new Schema<IAppSettingDocument>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: GLOBAL_SETTINGS_KEY,
    },
    primaryColor: {
      type: String,
      required: true,
      default: DEFAULT_PRIMARY_COLOR,
    },
    logoUrl: {
      type: String,
      required: true,
      default: DEFAULT_LOGO_URL,
    },
    solutionName: {
      type: String,
      required: true,
      default: DEFAULT_SOLUTION_NAME,
      trim: true,
      maxlength: 80,
    },
    lowStockAlertEmails: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

const existingModel = mongoose.models.AppSetting as Model<IAppSettingDocument> | undefined;

if (existingModel) {
  // En dev, le modèle peut rester en cache avec un ancien schéma.
  // On ajoute explicitement les nouveaux champs si absents.
  if (!existingModel.schema.path("logoUrl")) {
    existingModel.schema.add({
      logoUrl: {
        type: String,
        required: true,
        default: DEFAULT_LOGO_URL,
      },
    });
  }
  if (!existingModel.schema.path("solutionName")) {
    existingModel.schema.add({
      solutionName: {
        type: String,
        required: true,
        default: DEFAULT_SOLUTION_NAME,
        trim: true,
        maxlength: 80,
      },
    });
  }
}

const AppSetting: Model<IAppSettingDocument> =
  existingModel || mongoose.model<IAppSettingDocument>("AppSetting", AppSettingSchema);

export default AppSetting;
