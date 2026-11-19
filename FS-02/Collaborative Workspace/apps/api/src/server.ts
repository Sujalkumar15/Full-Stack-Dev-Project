import 'dotenv/config';

import { createServer } from 'node:http';

import { createApp } from './app.js';
import { createCollaborationServer } from './collaboration/server.js';
import { loadEnvironment } from './env.js';
import { prisma } from './lib/prisma.js';

const environment = loadEnvironment();
const app = createApp({
  cookieSecret: environment.COOKIE_SECRET,
  frontendOrigin: environment.FRONTEND_ORIGIN,
  nodeEnv: environment.NODE_ENV,
});
const server = createServer(app);
const collaborationServer = createCollaborationServer(server, {
  tokenSecret: environment.COOKIE_SECRET,
  frontendOrigin: environment.FRONTEND_ORIGIN,
});
let shuttingDown = false;

async function start() {
  await prisma.$connect();
  await prisma.$queryRaw<Array<{ ready: number }>>`SELECT 1 AS ready`;

  server.listen(environment.PORT, () => {
    app.request.log?.info?.(`API listening on http://localhost:${environment.PORT}`);
  });
}

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`${signal} received; shutting down.`);
  await collaborationServer.shutdown();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await prisma.$disconnect();
  process.exit(0);
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

start().catch(async (error: unknown) => {
  console.error('API failed to start.', error);
  await prisma.$disconnect();
  process.exit(1);
});
