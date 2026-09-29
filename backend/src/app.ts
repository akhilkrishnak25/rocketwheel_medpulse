import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import apiRouter from './routes';
import { notFoundHandler, globalErrorHandler } from './middleware/error';
import { ENV } from './config/env';

const app = express();

// Security HTTP headers
app.use(
  helmet({
    contentSecurityPolicy: false, // Allows cross-origin QR and preview loading in development
    crossOriginEmbedderPolicy: false,
  })
);

// CORS configuration
app.use(
  cors({
    origin: (requestOrigin, callback) => {
      if (!requestOrigin) return callback(null, true);
      if (
        requestOrigin === ENV.CLIENT_URL ||
        requestOrigin.endsWith('.onrender.com') ||
        requestOrigin.includes('localhost') ||
        requestOrigin.includes('127.0.0.1')
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-razorpay-signature'],
  })
);

// Request logging
app.use(morgan(ENV.NODE_ENV === 'development' ? 'dev' : 'combined'));

// Rate limiting (200 requests per minute per IP for general endpoints)
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after a minute.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', generalLimiter);

// Preserve the exact webhook payload for Razorpay signature verification.
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Root landing endpoint (GET /)
app.get('/', (req, res) => {
  // If requested by a web browser, return a styled dashboard with link to frontend
  if (req.accepts('html')) {
    return res.setHeader('Content-Type', 'text/html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MediPulse Core API | Rocket Wheel Platform</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background: radial-gradient(circle at 15% 20%, #eff2ff 0%, #ffffff 40%),
                  radial-gradient(circle at 85% 80%, #fff0f5 0%, #ffffff 50%);
      color: #0f172a;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 24px;
      box-shadow: 0 20px 40px -15px rgba(30, 32, 224, 0.08), 0 0 1px 1px rgba(0,0,0,0.02);
      max-width: 640px;
      width: 100%;
      padding: 40px;
      text-align: center;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      background: #ecfdf5;
      color: #059669;
      font-size: 12px;
      font-weight: 700;
      border-radius: 9999px;
      margin-bottom: 20px;
      border: 1px solid #a7f3d0;
    }
    .badge-dot {
      width: 8px;
      height: 8px;
      background: #10b981;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.85); }
    }
    .brand-title {
      font-size: 30px;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin-bottom: 8px;
      color: #0f172a;
    }
    .brand-highlight {
      background: linear-gradient(135deg, #1E20E0 0%, #FF1D6B 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .subtitle {
      font-size: 15px;
      color: #64748b;
      margin-bottom: 28px;
      line-height: 1.5;
    }
    .cta-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      background: #1E20E0;
      color: #ffffff !important;
      font-weight: 700;
      font-size: 15px;
      padding: 14px 28px;
      border-radius: 14px;
      text-decoration: none;
      box-shadow: 0 10px 20px -5px rgba(30, 32, 224, 0.35);
      transition: all 0.2s ease;
      margin-bottom: 28px;
    }
    .cta-btn:hover {
      background: #1618b7;
      transform: translateY(-1px);
      box-shadow: 0 14px 24px -5px rgba(30, 32, 224, 0.45);
    }
    .cta-btn svg {
      width: 18px;
      height: 18px;
      stroke: #ffffff;
    }
    .endpoints-container {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 16px;
      text-align: left;
    }
    .endpoints-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
      margin-bottom: 12px;
    }
    .endpoint-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 10px;
      border-radius: 8px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
    }
    .endpoint-item:hover {
      background: #f1f5f9;
    }
    .endpoint-item a {
      color: #1E20E0;
      text-decoration: none;
      font-weight: 600;
    }
    .endpoint-method {
      background: #e0e7ff;
      color: #3730a3;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
    }
    .footer-text {
      margin-top: 24px;
      font-size: 12px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">
      <span class="badge-dot"></span>
      Backend Core API Operational
    </div>
    <h1 class="brand-title">Rocket Wheel <span class="brand-highlight">MediPulse</span></h1>
    <p class="subtitle">Multi-Hospital Doctor Appointment Platform REST API engine is running smoothly on port 5000.</p>
    
    <div>
      <a href="http://localhost:5173" class="cta-btn">
        <span>Launch Web Application</span>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
        </svg>
      </a>
    </div>

    <div class="endpoints-container">
      <div class="endpoints-title">Quick API Endpoints</div>
      <div class="endpoint-item">
        <a href="/api/health" target="_blank">/api/health</a>
        <span class="endpoint-method">GET</span>
      </div>
      <div class="endpoint-item">
        <a href="/api/hospitals" target="_blank">/api/hospitals</a>
        <span class="endpoint-method">GET</span>
      </div>
      <div class="endpoint-item">
        <a href="/api/doctors" target="_blank">/api/doctors</a>
        <span class="endpoint-method">GET</span>
      </div>
      <div class="endpoint-item">
        <a href="/api/hospitals/departments" target="_blank">/api/hospitals/departments</a>
        <span class="endpoint-method">GET</span>
      </div>
    </div>

    <div class="footer-text">
      Rocket Wheel Platform • Zero-Login Patient Booking • Secure Role-Based Portals
    </div>
  </div>
</body>
</html>`);
  }

  // JSON response for API clients
  return res.json({
    success: true,
    service: 'Rocket Wheel MediPulse Multi-Hospital Appointment Platform Core API',
    status: 'operational',
    version: '1.0.0',
    frontendUrl: 'http://localhost:5173',
    endpoints: {
      health: '/api/health',
      hospitals: '/api/hospitals',
      doctors: '/api/doctors',
      departments: '/api/hospitals/departments',
      appointments: '/api/appointments',
      auth: '/api/auth/login',
    },
  });
});

// Mount all API routes
app.use('/api', apiRouter);

// 404 & Global Error Handling
app.use(notFoundHandler);
app.use(globalErrorHandler);

export default app;
