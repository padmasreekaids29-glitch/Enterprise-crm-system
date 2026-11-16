import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User, type IUser, type UserRole } from '../models/User.ts';

export interface AuthenticatedRequest extends Request {
  user?: IUser;
}

interface TokenPayload {
  sub: string;
  role: UserRole;
}

function getJwtSecret(): string {
  return process.env.JWT_SECRET?.trim() || 'nexora-enterprise-crm-dev-secret-change-in-production';
}

export function signToken(userId: string, role: UserRole): string {
  const expiresIn = process.env.JWT_EXPIRES_IN?.trim() || '7d';
  return jwt.sign({ sub: userId, role }, getJwtSecret(), {
    expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
  });
}

export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, message: 'Authentication token required' });
      return;
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      res.status(401).json({ success: false, message: 'Authentication token missing' });
      return;
    }

    const decoded = jwt.verify(token, getJwtSecret()) as TokenPayload;
    const user = await User.findById(decoded.sub);
    if (!user || !user.isActive) {
      res.status(401).json({ success: false, message: 'User account inactive or not found' });
      return;
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired authentication token' });
  }
}

export function authorize(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${allowedRoles.join(' or ')}`,
      });
      return;
    }
    next();
  };
}
