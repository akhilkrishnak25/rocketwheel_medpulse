import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload, UserRole } from '../utils/jwt';
import { errorResponse } from '../utils/response';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return errorResponse(res, 'Authentication token missing or invalid', 401);
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = verifyAccessToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    return errorResponse(res, 'Session expired or token invalid. Please log in again.', 401);
  }
};

export const requireRole = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return errorResponse(res, 'Unauthorized', 401);
    }

    if (!allowedRoles.includes(req.user.role)) {
      return errorResponse(res, 'Forbidden: Insufficient privileges for this resource', 403);
    }

    next();
  };
};

export const hospitalAdminGuard = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return errorResponse(res, 'Unauthorized', 401);
  }

  if (req.user.role === 'SUPER_ADMIN') {
    return next();
  }

  if ((req.user.role !== 'HOSPITAL_ADMIN' && req.user.role !== 'HOSPITAL_SUB_ADMIN') || !req.user.hospitalId) {
    return errorResponse(res, 'Forbidden: Hospital Admin access required', 403);
  }

  // Check if route has :hospitalId param and enforce scoping
  const targetHospitalId = req.params.hospitalId || req.query.hospitalId || req.body.hospitalId;
  if (targetHospitalId && targetHospitalId !== req.user.hospitalId) {
    return errorResponse(res, 'Forbidden: Access to another hospital data is restricted', 403);
  }

  next();
};

export const hospitalGuard = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return errorResponse(res, 'Unauthorized', 401);
  }

  if (req.user.role === 'SUPER_ADMIN') {
    return next();
  }

  if (!req.user.hospitalId) {
    return errorResponse(res, 'Forbidden: Hospital affiliation required', 403);
  }

  const targetHospitalId = req.params.hospitalId || req.query.hospitalId || req.body.hospitalId;
  if (targetHospitalId && targetHospitalId !== req.user.hospitalId) {
    return errorResponse(res, 'Forbidden: Access across hospital boundaries is restricted', 403);
  }

  next();
};

export const requirePermission = (permissionKey: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return errorResponse(res, 'Unauthorized', 401);
    }

    if (req.user.role === 'SUPER_ADMIN' || req.user.role === 'HOSPITAL_ADMIN') {
      return next();
    }

    if (req.user.role === 'HOSPITAL_SUB_ADMIN') {
      const permissions = req.user.subAdminPermissions || [];
      if (permissions.includes(permissionKey) || permissions.includes('all')) {
        return next();
      }
      return errorResponse(res, `Forbidden: Missing required sub-admin permission (${permissionKey})`, 403);
    }

    return errorResponse(res, 'Forbidden: Insufficient privileges', 403);
  };
};
