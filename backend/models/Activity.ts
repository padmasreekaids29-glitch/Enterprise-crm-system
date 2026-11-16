import mongoose, { Schema, type Document, type Types } from 'mongoose';

export type ActivityType = 'Call' | 'Meeting' | 'Task' | 'Note';
export type ActivityRelatedType = 'Lead' | 'Customer' | 'Deal' | 'General';
export type ActivityPriority = 'Low' | 'Medium' | 'High';

export interface IActivity extends Document {
  _id: Types.ObjectId;
  type: ActivityType;
  subject: string;
  description: string;
  relatedType: ActivityRelatedType;
  relatedId?: Types.ObjectId | null;
  relatedName: string;
  followUpDate?: Date | null;
  completed: boolean;
  completedAt?: Date | null;
  priority: ActivityPriority;
  ownerId?: Types.ObjectId | null;
  createdBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const activitySchema = new Schema<IActivity>(
  {
    type: {
      type: String,
      enum: ['Call', 'Meeting', 'Task', 'Note'],
      required: [true, 'Activity type is required'],
    },
    subject: {
      type: String,
      required: [true, 'Activity subject is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    relatedType: {
      type: String,
      enum: ['Lead', 'Customer', 'Deal', 'General'],
      default: 'General',
    },
    relatedId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    relatedName: {
      type: String,
      trim: true,
      default: '',
    },
    followUpDate: {
      type: Date,
      default: null,
    },
    completed: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Medium',
    },
    ownerId: {
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

export const Activity =
  mongoose.models.Activity || mongoose.model<IActivity>('Activity', activitySchema);
