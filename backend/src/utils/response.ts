import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: any;
}

export const successResponse = <T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200
) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

export const errorResponse = (
  res: Response,
  message: string = 'Internal Server Error',
  statusCode: number = 500,
  error?: any
) => {
  let displayMessage = message;
  if (typeof displayMessage === 'string' && displayMessage.trim().startsWith('[') && displayMessage.trim().endsWith(']')) {
    try {
      const parsed = JSON.parse(displayMessage);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].message) {
        displayMessage = parsed
          .map((err: any) => {
            const field = Array.isArray(err.path) && err.path.length ? `${err.path.join('.')}: ` : '';
            return `${field}${err.message}`;
          })
          .join('; ');
      }
    } catch {}
  }

  return res.status(statusCode).json({
    success: false,
    message: displayMessage,
    error,
  });
};
