import { Request, Response, NextFunction } from 'express';
import { errorResponse } from '../utils/response';

export const notFoundHandler = (req: Request, res: Response) => {
  return errorResponse(res, `Route ${req.method} ${req.originalUrl} not found`, 404);
};

export const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Unhandled Server Error:', err);

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'An unexpected internal error occurred';

  return errorResponse(res, message, statusCode, process.env.NODE_ENV === 'development' ? err.stack : undefined);
};
