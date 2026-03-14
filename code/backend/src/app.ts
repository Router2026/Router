import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
dotenv.config();

import locationsRouter from './routes/locations';
import regionsRouter from './routes/regions';
import reviewsRouter from './routes/reviews';
import reportsRouter from './routes/reports';
import videosRouter from './routes/videos';
import tripsRouter from './routes/trips';
import usersRouter from './routes/users';
import authRouter from './routes/auth';
import favoritesRouter from './routes/favorites';

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/auth', authRouter);
app.use('/locations', locationsRouter);
app.use('/regions', regionsRouter);
app.use('/reviews', reviewsRouter);
app.use('/reports', reportsRouter);
app.use('/videos', videosRouter);
app.use('/trips', tripsRouter);
app.use('/users', usersRouter);
app.use('/favorites', favoritesRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message });
});

export default app;