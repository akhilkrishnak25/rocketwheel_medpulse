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
