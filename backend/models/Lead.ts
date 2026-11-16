import mongoose, { Schema, type Document, type Types } from 'mongoose';

export type LeadSource =
  | 'Website'
  | 'Referral'
  | 'LinkedIn'
  | 'Cold Outreach'
  | 'Partner'
  | 'Conference';

export type LeadStatus = 'New' | 'Contacted' | 'Qualified' | 'Converted' | 'Lost';

export interface ILead extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  company: string;
  source: LeadSource;
  status: LeadStatus;
  estimatedValue: number;
  assignedTo?: Types.ObjectId | null;
  notes: string;
  convertedCustomerId?: Types.ObjectId | null;
  createdBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const leadSchema = new Schema<ILead>(
  {
    name: {
      type: String,
      required: [true, 'Lead name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Lead email is required'],
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    company: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
    },
    source: {
      type: String,
      enum: ['Website', 'Referral', 'LinkedIn', 'Cold Outreach', 'Partner', 'Conference'],
      default: 'Website',
    },
    status: {
      type: String,
      enum: ['New', 'Contacted', 'Qualified', 'Converted', 'Lost'],
      default: 'New',
    },
    estimatedValue: {
      type: Number,
      default: 15000,
      min: 0,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    convertedCustomerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

leadSchema.index({ name: 'text', email: 'text', company: 'text' });

export const Lead = mongoose.models.Lead || mongoose.model<ILead>('Lead', leadSchema);
