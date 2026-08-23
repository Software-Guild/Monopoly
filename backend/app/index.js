// app/index.js
//
// Express server bootstrap: configures middleware, PostgreSQL-backed
// sessions, mounts the auth routes, and starts listening. Also
// populates the in-memory Bloom filter from the database before
// accepting traffic.

require('dotenv').config();

const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');

const authRoutes = require('./api/routes/auth.routes');
const usernameBloomFilter = require('./models/bloomFilter');
const prisma = require('./models/prismaClient');

const app = express();
const PORT = process.env.PORT || 4000;
const isProduction = process.env.NODE_ENV === 'production';

// ---------------------------------------------------------------------
// Core middleware
// ---------------------------------------------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

app.use(
  session({
    store: new pgSession({
      pool: sessionPool,
      tableName: 'session', // matches the Session model's @@map("session")
      createTableIfMissing: true,
    }),
    name: process.env.SESSION_COOKIE_NAME || 'monopoly.sid',
    secret: process.env.SESSION_SECRET, // required — see .env.example
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

if (!process.env.SESSION_SECRET) {
  console.warn(
    '[index] WARNING: SESSION_SECRET is not set. Set a strong random ' +
      'value in your environment before running in production.'
  );
}

// ---------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);

// Fallback 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Generic error handler (catches synchronous errors thrown in routes)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[unhandled error]', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ---------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------
async function start() {
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

module.exports = app;
