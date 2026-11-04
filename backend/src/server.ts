import app from './app';
import { ENV } from './config/env';
import prisma from './config/prisma';

const server = app.listen(ENV.PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🏥 MediPulse Multi-Hospital Backend API Server Running`);
  console.log(`📡 URL: http://localhost:${ENV.PORT}`);
  console.log(`🌐 Client: ${ENV.CLIENT_URL}`);
  console.log(`🔧 Environment: ${ENV.NODE_ENV}`);
  console.log(`======================================================\n`);

  // Asynchronously pre-warm database connection pool on startup
  prisma.$queryRaw`SELECT 1 as warmup`
    .then(() => console.log('⚡ Prisma database connection pool warmed up and ready.'))
    .catch((err) => console.warn('⚠️ Database warmup notice:', err.message));

  // Keep-alive heartbeat: Prevents Render free-tier spin-down (15m) and Neon compute sleep (5m)
  if (ENV.NODE_ENV === 'production' && ENV.BASE_URL) {
    const PING_INTERVAL_MS = 4 * 60 * 1000; // 4 minutes
    setInterval(async () => {
      try {
        await prisma.$queryRaw`SELECT 1 as keepalive`;
        if (ENV.BASE_URL.startsWith('http')) {
          await fetch(`${ENV.BASE_URL.replace(/\/$/, '')}/api/health`, { method: 'GET' }).catch(() => {});
        }
      } catch {
        // Suppress transient network blips
      }
    }, PING_INTERVAL_MS);
    console.log('🔄 Automatic keep-alive heartbeat active (4m interval)');
  }
});

// Graceful shutdown
const shutdown = async () => {
  console.log('Shutting down server gracefully...');
  server.close(async () => {
    await prisma.$disconnect();
    console.log('Database connection closed. Process exited.');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
