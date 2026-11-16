import mongoose, { Schema, type Document, type Types } from 'mongoose';

export type CustomerSegment = 'Enterprise' | 'Mid-Market' | 'SMB';
export type CustomerStatus = 'Active' | 'Onboarding' | 'At Risk' | 'Churned';

export interface ICustomer extends Document {
  _id: Types.ObjectId;
  name: string;
  company: string;
  email: string;
  phone: string;
  industry: string;
  segment: CustomerSegment;
  status: CustomerStatus;
  lifetimeValue: number;
  address: string;
  website: string;
  notes: string;
  assignedTo?: Types.ObjectId | null;
  createdBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new Schema<ICustomer>(
  {
    name: {
      type: String,
      required: [true, 'Primary contact name is required'],
      trim: true,
    },
    company: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    industry: {
      type: String,
      trim: true,
      default: 'Technology',
    },
    segment: {
      type: String,
      enum: ['Enterprise', 'Mid-Market', 'SMB'],
      default: 'Mid-Market',
    },
    status: {
      type: String,
      enum: ['Active', 'Onboarding', 'At Risk', 'Churned'],
      default: 'Active',
    },
    lifetimeValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    website: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
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

export const Customer =
  mongoose.models.Customer || mongoose.model<ICustomer>('Customer', customerSchema);
