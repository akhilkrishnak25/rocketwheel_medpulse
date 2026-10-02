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

/**
 * Humanizes raw technical errors (Zod schema issues, Prisma DB errors, type mismatches)
 * into friendly, natural English messages suitable for end users.
 */
export function humanizeErrorMessage(rawError: any): string {
  if (!rawError) return 'An unexpected error occurred. Please try again.';

  let msg = typeof rawError === 'string' ? rawError : rawError.message || String(rawError);

  // If message contains stringified JSON from Zod or an array of error objects
  if (typeof msg === 'string' && msg.trim().startsWith('[') && msg.trim().endsWith(']')) {
    try {
      const parsed = JSON.parse(msg);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
          .map((item: any) => formatSingleZodIssue(item))
          .filter(Boolean)
          .join('. ');
      }
    } catch {}
  }

  // Handle direct ZodError errors array
  if (Array.isArray(rawError.errors) && rawError.errors.length > 0) {
    return rawError.errors
      .map((item: any) => formatSingleZodIssue(item))
      .filter(Boolean)
      .join('. ');
  }

  // Handle Prisma Unique Constraint Violation (P2002)
  if (rawError.code === 'P2002' || msg.includes('Unique constraint failed')) {
    const fields = rawError.meta?.target || extractFieldsFromPrismaMsg(msg);
    if (fields && fields.length) {
      const fieldList = Array.isArray(fields) ? fields.join(', ') : fields;
      return `A record with this ${fieldList} already exists. Please choose a different value.`;
    }
    return 'A record with these unique details already exists in the system.';
  }

  // Handle Prisma Record Not Found (P2025)
  if (rawError.code === 'P2025' || msg.includes('Record to update not found')) {
    return 'The requested record could not be found or has already been updated.';
  }

  // Clean common technical prefixes
  msg = msg.replace(/^Error:\s*/i, '');
  msg = msg.replace(/^Invalid `.*` invocation in.*\n/g, '');
  msg = msg.replace(/\n\s*→.*/g, '');

  // Humanize common validation fragments
  if (msg.includes('invalid_enum_value') || msg.includes('Invalid enum value')) {
    return 'Please select a valid option from the dropdown menu.';
  }
  if (msg.includes('received undefined') || msg.includes('Expected string, received undefined')) {
    return 'Please fill in all mandatory fields.';
  }

  return msg.trim() || 'Operation could not be completed. Please check your input.';
}

function formatSingleZodIssue(item: any): string {
  const fieldName = Array.isArray(item.path) && item.path.length
    ? humanizeFieldName(item.path[item.path.length - 1])
    : 'Field';

  if (item.code === 'invalid_type' && item.received === 'undefined') {
    return `${fieldName} is required`;
  }
  if (item.code === 'invalid_enum_value') {
    return `Please select a valid option for ${fieldName}`;
  }
  if (item.code === 'too_small') {
    if (item.type === 'string') {
      return item.minimum > 1
        ? `${fieldName} must be at least ${item.minimum} characters`
        : `${fieldName} is required`;
    }
    return `${fieldName} is below the minimum value of ${item.minimum}`;
  }
  if (item.code === 'too_big') {
    return `${fieldName} cannot exceed ${item.maximum} characters`;
  }
  if (item.code === 'invalid_string') {
    if (item.validation === 'email') return 'Please enter a valid email address';
    if (item.validation === 'regex') return `Please enter a valid ${fieldName}`;
  }

  return item.message ? `${fieldName}: ${item.message}` : `${fieldName} is invalid`;
}

function humanizeFieldName(raw: string | number): string {
  const str = String(raw);
  // Convert camelCase or snake_case to Title Words
  const result = str
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim();
  return result.charAt(0).toUpperCase() + result.slice(1);
}

function extractFieldsFromPrismaMsg(msg: string): string[] | null {
  const match = msg.match(/\(([^)]+)\)/);
  if (match && match[1]) {
    return match[1].replace(/[`'"]/g, '').split(',').map((s) => s.trim());
  }
  return null;
}

export const errorResponse = (
  res: Response,
  message: string = 'Internal Server Error',
  statusCode: number = 500,
  error?: any
) => {
  // Log technical error details on the server for developers
  if (statusCode >= 500 || (error && statusCode >= 400)) {
    console.error(`[API Error ${statusCode}]`, message, error || '');
  }

  const cleanMessage = humanizeErrorMessage(error || message);

  return res.status(statusCode).json({
    success: false,
    message: cleanMessage,
    error: process.env.NODE_ENV === 'development' ? error : undefined,
  });
};
