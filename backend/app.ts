import cors from 'cors';
import express, { type Express } from 'express';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.ts';
import activityRoutes from './routes/activityRoutes.ts';
import adminRoutes from './routes/adminRoutes.ts';
import authRoutes from './routes/authRoutes.ts';
import customerRoutes from './routes/customerRoutes.ts';
import dashboardRoutes from './routes/dashboardRoutes.ts';
import dealRoutes from './routes/dealRoutes.ts';
import leadRoutes from './routes/leadRoutes.ts';
import reportRoutes from './routes/reportRoutes.ts';
import settingsRoutes from './routes/settingsRoutes.ts';

export function createApiApp(): Express {
  const app = express();

  const allowedOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: allowedOrigins.length > 0 ? allowedOrigins : true,
      credentials: true,
    })
  );

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.get('/api/health', (_req, res) => {
    res.json({ success: true, service: 'NEXORA CRM API', status: 'operational' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/leads', leadRoutes);
  app.use('/api/customers', customerRoutes);
  app.use('/api/deals', dealRoutes);
  app.use('/api/activities', activityRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/settings', settingsRoutes);

  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}
