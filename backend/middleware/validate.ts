import mongoose from 'mongoose';
import { AppError } from './errorHandler.ts';

export function requireNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AppError(`${label} is required`, 400);
  }
  return value.trim();
}

export function validateEmail(value: unknown, label = 'Email'): string {
  const email = requireNonEmptyString(value, label).toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new AppError(`Please provide a valid ${label.toLowerCase()}`, 400);
  }
  return email;
}

export function assertValidObjectId(id: string | undefined, label = 'ID'): string {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${label}`, 400);
  }
  return id;
}

export function parsePositiveNumber(value: unknown, fallback = 0): number {
  if (value === undefined || value === null || value === '') return fallback;
  const num = Number(value);
  if (Number.isNaN(num) || num < 0) {
    throw new AppError('Numeric value must be zero or positive', 400);
  }
  return num;
}
