import mongoose, { Schema, type Document, type Types } from 'mongoose';

export type UserRole = 'Admin' | 'Manager' | 'Sales Executive';

export interface NotificationPreferences {
  dealStageChanges: boolean;
  leadAssignments: boolean;
  dailyTaskDigest: boolean;
  weeklySummary: boolean;
}

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  title: string;
  phone: string;
  department: string;
  avatar: string;
  teamId?: Types.ObjectId | null;
  isActive: boolean;
  lastLoginAt?: Date | null;
  notificationPreferences: NotificationPreferences;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ['Admin', 'Manager', 'Sales Executive'],
      default: 'Sales Executive',
    },
    title: {
      type: String,
      trim: true,
      default: 'Account Executive',
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    department: {
      type: String,
      trim: true,
      default: 'Enterprise Sales',
    },
    avatar: {
      type: String,
      default: '/src/assets/images/avatar_exec_one_1794844537623.jpg',
    },
    teamId: {
      type: Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    notificationPreferences: {
      dealStageChanges: { type: Boolean, default: true },
      leadAssignments: { type: Boolean, default: true },
      dailyTaskDigest: { type: Boolean, default: true },
      weeklySummary: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

export const User = mongoose.models.User || mongoose.model<IUser>('User', userSchema);
