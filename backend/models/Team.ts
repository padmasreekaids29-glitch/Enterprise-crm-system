import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface ITeam extends Document {
  _id: Types.ObjectId;
  name: string;
  region: string;
  description: string;
  managerId?: Types.ObjectId | null;
  monthlyQuota: number;
  createdAt: Date;
  updatedAt: Date;
}

const teamSchema = new Schema<ITeam>(
  {
    name: {
      type: String,
      required: [true, 'Team name is required'],
      trim: true,
      unique: true,
    },
    region: {
      type: String,
      trim: true,
      default: 'North America',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    managerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    monthlyQuota: {
      type: Number,
      default: 250000,
      min: 0,
    },
  },
  { timestamps: true }
);

export const Team = mongoose.models.Team || mongoose.model<ITeam>('Team', teamSchema);
