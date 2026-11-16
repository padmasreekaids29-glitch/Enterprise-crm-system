import mongoose, { Schema, type Document, type Types } from 'mongoose';

export type DealStage =
  | 'Prospecting'
  | 'Qualification'
  | 'Proposal'
  | 'Negotiation'
  | 'Won'
  | 'Lost';

export type DealPriority = 'Low' | 'Medium' | 'High';

export const STAGE_PROBABILITY: Record<DealStage, number> = {
  Prospecting: 15,
  Qualification: 35,
  Proposal: 60,
  Negotiation: 80,
  Won: 100,
  Lost: 0,
};

export interface IDeal extends Document {
  _id: Types.ObjectId;
  title: string;
  customerId?: Types.ObjectId | null;
  companyName: string;
  value: number;
  stage: DealStage;
  probability: number;
  expectedCloseDate: Date;
  closedAt?: Date | null;
  priority: DealPriority;
  assignedTo?: Types.ObjectId | null;
  notes: string;
  createdBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const dealSchema = new Schema<IDeal>(
  {
    title: {
      type: String,
      required: [true, 'Deal title is required'],
      trim: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
    },
    companyName: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
    },
    value: {
      type: Number,
      required: [true, 'Deal value is required'],
      min: 0,
    },
    stage: {
      type: String,
      enum: ['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Won', 'Lost'],
      default: 'Prospecting',
    },
    probability: {
      type: Number,
      min: 0,
      max: 100,
      default: 15,
    },
    expectedCloseDate: {
      type: Date,
      required: [true, 'Expected closing date is required'],
    },
    closedAt: {
      type: Date,
      default: null,
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Medium',
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
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

export const Deal = mongoose.models.Deal || mongoose.model<IDeal>('Deal', dealSchema);
