// app/models/prismaClient.js
//
// Single shared PrismaClient instance for the whole app. Prisma
// recommends instantiating one client and reusing it (rather than
// creating a new one per request) to avoid exhausting the database
// connection pool.

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

module.exports = prisma;
