import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';

export type UserRole =
  | 'SUPER_ADMIN'
  | 'HOSPITAL_ADMIN'
  | 'HOSPITAL_SUB_ADMIN'
  | 'DOCTOR'
  | 'SUPPORT_STAFF'
  | 'LAB_TECHNICIAN'
  | 'PHARMACY_STAFF'
  | 'PATIENT';

export interface TokenPayload {
  userId: string;
  id?: string;
  email: string;
  role: UserRole;
  hospitalId?: string;
  doctorId?: string;
  subAdminPermissions?: string[];
  labId?: string;
  pharmacyId?: string;
}

export const generateTokens = (payload: TokenPayload) => {
  const tokenData = {
    ...payload,
    id: payload.userId,
  };
  const accessToken = jwt.sign(tokenData, ENV.JWT_SECRET, {
    expiresIn: ENV.JWT_EXPIRES_IN as any,
  });

  const refreshToken = jwt.sign(payload, ENV.JWT_REFRESH_SECRET, {
    expiresIn: ENV.JWT_REFRESH_EXPIRES_IN as any,
  });

  return { accessToken, refreshToken };
};

export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, ENV.JWT_SECRET) as TokenPayload;
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  return jwt.verify(token, ENV.JWT_REFRESH_SECRET) as TokenPayload;
};
