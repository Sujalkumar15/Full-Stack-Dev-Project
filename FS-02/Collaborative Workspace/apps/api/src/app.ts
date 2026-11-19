import { randomUUID } from 'node:crypto';

import type { HealthResponse } from '@collaborative-workspace/shared';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import pino from 'pino';
import { pinoHttp } from 'pino-http';

import { createAuthRouter } from './auth/routes.js';
import { errorHandler, notFoundHandler } from './errors.js';
import { createPageRouter } from './pages/routes.js';
import { createWorkspaceRouter } from './workspaces/routes.js';

export interface AppConfig {
  cookieSecret: string;
  frontendOrigin: string;
  nodeEnv: 'development' | 'test' | 'production';
}

export function createApp(config: AppConfig) {
  const app = express();
  const logger = pino({
    level: config.nodeEnv === 'test' ? 'silent' : (process.env.LOG_LEVEL ?? 'info'),
  });

  app.disable('x-powered-by');
  if (config.nodeEnv === 'production') {
    app.set('trust proxy', 1);
  }
  app.use(
    pinoHttp({
      logger,
      autoLogging: config.nodeEnv !== 'test',
      genReqId(request, response) {
        const forwardedId = request.headers['x-request-id'];
        const requestId = typeof forwardedId === 'string' ? forwardedId : randomUUID();
        response.setHeader('x-request-id', requestId);
        return requestId;
      },
    }),
  );
  app.use(helmet());
  app.use(
    cors({
      origin: config.frontendOrigin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-Request-ID'],
    }),
  );
  app.use(cookieParser(config.cookieSecret));
  app.use(express.json({ limit: '1mb' }));

  app.use('/api/auth', createAuthRouter(config));
  app.use('/api/workspaces/:workspaceId/pages', createPageRouter(config));
  app.use('/api/workspaces', createWorkspaceRouter());

  app.get('/api/health', (request, response) => {
    const body: HealthResponse = {
      status: 'ok',
      service: 'collaborative-workspace-api',
      timestamp: new Date().toISOString(),
      requestId: String(request.id),
    };

    response.status(200).json(body);
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
