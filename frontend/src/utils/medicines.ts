export interface HasPriority {
  priority?: number | string | null;
  [key: string]: any;
}

/**
 * Validates and extracts a positive integer priority.
 * Returns 999999 if missing, invalid, zero, or negative.
 */
export function parsePriority(val: any): number {
  if (typeof val === 'number' && !isNaN(val) && val > 0 && Number.isFinite(val)) {
    return Math.floor(val);
  }
  if (typeof val === 'string' && val.trim()) {
    const parsed = parseInt(val.trim(), 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 999999;
}

/**
 * Automatically sorts medicines in ascending order of priority number:
 * Priority 1 first, Priority 2 second, Priority 3 third, etc.
 * Preserves the original relative order for duplicate priority numbers (stable sort).
 */
export function sortMedicinesByPriority<T extends HasPriority>(medicines: T[]): T[] {
  if (!Array.isArray(medicines)) return [];
  return [...medicines].sort((a, b) => {
    const pA = parsePriority(a?.priority);
    const pB = parsePriority(b?.priority);
    return pA - pB;
  });
}
