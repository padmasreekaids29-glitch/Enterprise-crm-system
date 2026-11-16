import { AuditLog } from '../models/AuditLog.ts';
import type { IUser } from '../models/User.ts';

export async function recordAudit(
  actor: Pick<IUser, '_id' | 'name' | 'role'> | { _id?: null; name: string; role: string },
  action: string,
  entityType: string,
  entityId: string,
  summary: string
): Promise<void> {
  try {
    await AuditLog.create({
      actorId: actor._id || null,
      actorName: actor.name,
      actorRole: actor.role,
      action,
      entityType,
      entityId,
      summary,
    });
  } catch (err) {
    console.warn('[NEXORA Audit] Failed to record audit log:', err);
  }
}
