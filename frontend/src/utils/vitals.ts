/**
 * Shared Clinical Vitals Formatting & Extraction Utility (Frontend)
 * Enforces standardized medical unit conventions across MedPulse UI:
 * - Blood Pressure always formatted with mmHg (e.g. 120/80 mmHg) without duplicate units
 * - Pulse in bpm
 * - Temperature with °F or °C
 * - SpO2 with single % (preventing double %%)
 * - Weight in kg, Height in cm, and calculated BMI
 */

export interface FormattedVitals {
  bp: string | null;
  pulse: string | null;
  temperature: string | null;
  spo2: string | null;
  weight: string | null;
  height: string | null;
  respiratoryRate?: string | null;
  bmi?: string | null;
}

/**
 * Format Blood Pressure to always include 'mmHg' unit without duplicate appending.
 * Preserves systolic/diastolic representation (e.g., "120/80 mmHg").
 */
export function formatBP(bp?: string | number | null): string | null {
  if (bp === null || bp === undefined) return null;
  const str = String(bp).trim();
  if (!str || str.toLowerCase() === 'n/a' || str.toLowerCase() === 'null' || str === '-') return null;

  // If already ends with mmHg (case-insensitive, optional whitespace)
  if (/mmHg$/i.test(str)) {
    return str.replace(/\s*mmHg$/i, ' mmHg');
  }

  if (/mm\s*hg/i.test(str)) {
    return str.replace(/\s*mm\s*hg/i, ' mmHg');
  }

  return `${str} mmHg`;
}

/**
 * Format separate systolic and diastolic numbers into standard "120/80 mmHg"
 */
export function formatSystolicDiastolicBP(
  sys?: number | string | null,
  dia?: number | string | null
): string | null {
  const cleanSys = sys !== null && sys !== undefined && String(sys).trim() !== '' ? String(sys).trim() : null;
  const cleanDia = dia !== null && dia !== undefined && String(dia).trim() !== '' ? String(dia).trim() : null;

  if (!cleanSys && !cleanDia) return null;
  if (cleanSys && cleanDia) {
    return formatBP(`${cleanSys}/${cleanDia}`);
  }
  return formatBP(cleanSys || cleanDia);
}

/**
 * Format pulse rate with 'bpm'
 */
export function formatPulse(pulse?: number | string | null): string | null {
  if (pulse === null || pulse === undefined) return null;
  const str = String(pulse).trim();
  if (!str || str.toLowerCase() === 'n/a' || str.toLowerCase() === 'null') return null;
  if (/bpm$/i.test(str)) return str.replace(/\s*bpm$/i, ' bpm');
  return `${str} bpm`;
}

/**
 * Format temperature with degree unit
 */
export function formatTemperature(temp?: number | string | null): string | null {
  if (temp === null || temp === undefined) return null;
  const str = String(temp).trim();
  if (!str || str.toLowerCase() === 'n/a' || str.toLowerCase() === 'null') return null;
  if (/°[FC]$/i.test(str)) return str;
  if (/[FC]$/i.test(str)) return str.replace(/([FC])$/i, '°$1');
  return `${str} °F`;
}

/**
 * Format SpO2 percentage cleanly, preventing double % signs (e.g. 99%% -> 99%)
 */
export function formatSpO2(spo2?: number | string | null): string | null {
  if (spo2 === null || spo2 === undefined) return null;
  const str = String(spo2).trim();
  if (!str || str.toLowerCase() === 'n/a' || str.toLowerCase() === 'null') return null;
  const cleaned = str.replace(/%+$/, '').trim();
  return `${cleaned}%`;
}

/**
 * Format weight with 'kg'
 */
export function formatWeight(weight?: number | string | null): string | null {
  if (weight === null || weight === undefined) return null;
  const str = String(weight).trim();
  if (!str || str.toLowerCase() === 'n/a' || str.toLowerCase() === 'null') return null;
  if (/kg$/i.test(str)) return str.replace(/\s*kg$/i, ' kg');
  return `${str} kg`;
}

/**
 * Format height with 'cm'
 */
export function formatHeight(height?: number | string | null): string | null {
  if (height === null || height === undefined) return null;
  const str = String(height).trim();
  if (!str || str.toLowerCase() === 'n/a' || str.toLowerCase() === 'null') return null;
  if (/cm$/i.test(str)) return str.replace(/\s*cm$/i, ' cm');
  return `${str} cm`;
}

/**
 * Calculate BMI from weight (kg) and height (cm)
 */
export function calculateBMI(
  weight?: number | string | null,
  height?: number | string | null
): string | null {
  if (!weight || !height) return null;
  const w = parseFloat(String(weight));
  const h = parseFloat(String(height));
  if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) return null;

  const hMeters = h > 3 ? h / 100 : h;
  const bmiVal = w / (hMeters * hMeters);
  if (isNaN(bmiVal) || !isFinite(bmiVal) || bmiVal < 5 || bmiVal > 150) return null;

  return `${bmiVal.toFixed(1)} kg/m²`;
}

/**
 * Format respiratory rate
 */
export function formatRespiratoryRate(rr?: number | string | null): string | null {
  if (rr === null || rr === undefined) return null;
  const str = String(rr).trim();
  if (!str || str.toLowerCase() === 'n/a' || str.toLowerCase() === 'null') return null;
  if (/\/min$/i.test(str)) return str;
  return `${str} /min`;
}

/**
 * Format vitals into a single inline string for display/logging
 * Example: BP: 120/80 mmHg | Pulse: 80 bpm | Temp: 98°F | SpO₂: 99% | Weight: 65 kg
 */
export function formatVitalsSummary(vitals: FormattedVitals | null | undefined): string {
  if (!vitals) return 'No vitals recorded';
  const parts: string[] = [];
  if (vitals.bp) parts.push(`BP: ${vitals.bp}`);
  if (vitals.pulse) parts.push(`Pulse: ${vitals.pulse}`);
  if (vitals.temperature) parts.push(`Temp: ${vitals.temperature}`);
  if (vitals.spo2) parts.push(`SpO2: ${vitals.spo2}`);
  if (vitals.respiratoryRate) parts.push(`Resp: ${vitals.respiratoryRate}`);
  if (vitals.weight) parts.push(`Weight: ${vitals.weight}`);
  if (vitals.height) parts.push(`Height: ${vitals.height}`);
  if (vitals.bmi) parts.push(`BMI: ${vitals.bmi}`);
  return parts.length > 0 ? parts.join('   |   ') : 'No vitals recorded';
}
