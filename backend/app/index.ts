// app/index.ts
//
// Express server bootstrap: configures middleware, PostgreSQL-backed
// sessions, mounts the auth routes, and starts listening. Also
// populates the in-memory Bloom filter from the database before
// accepting traffic.

import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import cors from 'cors';
import { Pool } from 'pg';

import authRoutes from './api/routes/auth.routes';
import usernameBloomFilter from './models/bloomFilter';
import prisma from './models/prismaClient';

// Side-effect import: augments express-session's SessionData type
// with `userId` / `username`. Must stay imported somewhere in the
// compiled program for the ambient declaration to take effect.


const pgSession = connectPgSimple(session);

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const isProduction = process.env.NODE_ENV === 'production';

// ---------------------------------------------------------------------
// Core middleware
// ---------------------------------------------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',').map((origin) => origin.trim()) || 'http://localhost:5173',
  credentials: true,
}));

// If running behind a reverse proxy / load balancer (Heroku, Render,
// nginx, etc.) in production, this is required for `secure` cookies
// and correct `req.ip` / protocol detection.
if (isProduction) {
  app.set('trust proxy', 1);
}

// ---------------------------------------------------------------------
// Session store: PostgreSQL via connect-pg-simple
// ---------------------------------------------------------------------
// A dedicated `pg` Pool is used for the session store (separate from
// Prisma's own connection pool, since connect-pg-simple talks to
// Postgres directly with raw SQL rather than through Prisma Client).
const sessionPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

if (!process.env.SESSION_SECRET) {
  console.warn(
    '[index] WARNING: SESSION_SECRET is not set. Set a strong random ' +
      'value in your environment before running in production.'
  );
}

app.use(
  session({
    store: new pgSession({
      pool: sessionPool,
      tableName: 'session', // matches the Session model's @@map("session")
      createTableIfMissing: true,
    }),
    name: process.env.SESSION_COOKIE_NAME || 'monopoly.sid',
    secret: process.env.SESSION_SECRET as string, // required — see .env.example
    resave: false,
    saveUninitialized: false,
    rolling: true, // refresh cookie expiry on every request
    cookie: {
      httpOnly: true, // not accessible via client-side JS
      secure: isProduction, // HTTPS only in production
      sameSite: isProduction ? 'strict' : 'lax', // CSRF mitigation
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  })
);

// ---------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);

// Fallback 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Generic error handler (catches synchronous errors thrown in routes)
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error('[unhandled error]', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ---------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------
async function start(): Promise<void> {
  try {
    // Populate the Bloom filter with existing usernames before the
    // server starts accepting requests, so the very first
    // /check-username call is already fast and accurate.
    await usernameBloomFilter.init(prisma);

    app.listen(PORT, () => {
      console.log(`[index] Monopoly backend listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('[index] Failed to start server:', error);
    process.exit(1);
  }
}

start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[index] SIGTERM received, shutting down...');
  await prisma.$disconnect();
  await sessionPool.end();
  process.exit(0);
});

export default app;
