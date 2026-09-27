import prisma from '../config/prisma';

export interface CreateAuditLogParams {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: Record<string, any> | string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export class AuditService {
  static async log(params: CreateAuditLogParams) {
    try {
      const detailsString =
        typeof params.details === 'object' && params.details !== null
          ? JSON.stringify(params.details)
          : (params.details as string) || null;

      return await prisma.auditLog.create({
        data: {
          userId: params.userId || null,
          action: params.action,
          entity: params.entity,
          entityId: params.entityId || null,
          details: detailsString,
          ipAddress: params.ipAddress || null,
          userAgent: params.userAgent || null,
        },
      });
    } catch (err) {
      console.error('AuditLog creation warning:', err);
      // Non-blocking for primary application flow
      return null;
    }
  }
}
