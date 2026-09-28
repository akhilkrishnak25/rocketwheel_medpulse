import dotenv from 'dotenv';
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const paymentMode = process.env.PAYMENT_MODE || 'demo';
const otpMode = process.env.OTP_MODE || 'console';

if (!['disabled', 'demo', 'razorpay'].includes(paymentMode)) {
  throw new Error('PAYMENT_MODE must be disabled, demo, or razorpay');
}

if (!['disabled', 'console', 'smtp'].includes(otpMode)) {
  throw new Error('OTP_MODE must be disabled, console, or smtp');
}

const requiredProductionVariables = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'CLIENT_URL',
  'BASE_URL',
];

if (isProduction) {
  const missing = requiredProductionVariables.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing production environment variables: ${missing.join(', ')}`);
  }

  if (!process.env.DATABASE_URL?.startsWith('postgresql://') && !process.env.DATABASE_URL?.startsWith('postgres://')) {
    throw new Error('Production DATABASE_URL must be a PostgreSQL connection string (postgresql:// or postgres://)');
  }

  if (paymentMode === 'razorpay') {
    const missingPaymentVariables = ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET']
      .filter((name) => !process.env[name]);
    if (missingPaymentVariables.length > 0) {
      throw new Error(`Missing Razorpay environment variables: ${missingPaymentVariables.join(', ')}`);
    }
  }

  if (otpMode === 'smtp') {
    const missingSmtpVariables = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'OTP_FROM']
      .filter((name) => !process.env[name]);
    if (missingSmtpVariables.length > 0) {
      throw new Error(`Missing SMTP environment variables: ${missingSmtpVariables.join(', ')}`);
    }
  }
}

export const ENV = {
  PORT: process.env.PORT || '5000',
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db',
  JWT_SECRET: process.env.JWT_SECRET || 'local-development-only-jwt-secret',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'local-development-only-refresh-secret',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '2h',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  PAYMENT_MODE: paymentMode as 'disabled' | 'demo' | 'razorpay',
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || '',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || '',
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  BASE_URL: process.env.BASE_URL || 'http://localhost:5000',
  PLATFORM_FEE: Number(process.env.PLATFORM_FEE || 20),
  OTP_MODE: otpMode as 'disabled' | 'console' | 'smtp',
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: Number(process.env.SMTP_PORT || 465),
  SMTP_SECURE: process.env.SMTP_SECURE !== 'false',
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  OTP_FROM: process.env.OTP_FROM || process.env.SMTP_USER || '',
};
