// app/api/controller/auth.controller.ts
//
// Request handlers for all /api/auth/* endpoints. Controllers stay
// thin: they validate input (via Zod schemas), talk to Prisma / the
// Bloom filter, and shape the HTTP response. Password hashing uses
// bcrypt.

import bcrypt from 'bcrypt';
import type { Request, Response } from 'express';
import type { User } from '@prisma/client';
import { Prisma } from '@prisma/client';
import prisma from '../../models/prismaClient';
import usernameBloomFilter from '../../models/bloomFilter';
import {
  registerSchema,
  loginSchema,
  checkUsernameQuerySchema,
} from '../../schema/auth.schema';

const BCRYPT_SALT_ROUNDS = 12;

interface PublicUser {
  id: string;
  username: string;
  email: string;
  createdAt: Date;
}

/**
 * Strips sensitive fields before sending a user object back to the
 * client. Never send the password hash to the frontend.
 */
function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt,
  };
}

// -----------------------------------------------------------------------
// POST /api/auth/register
// -----------------------------------------------------------------------
export async function register(req: Request, res: Response): Promise<Response | void> {
  // 1. Validate input shape (email format, password === confirmPassword,
  //    username charset/length, etc.)
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const { username, email, password } = parsed.data;

  try {
    // 2. Fast-path username availability check via Bloom filter.
    //    If the filter says "definitely not present", we can skip the
    //    DB round trip entirely for the common case of a free username.
    const mightExist = usernameBloomFilter.has(username);

    if (mightExist) {
      // 3. Bloom filter said "maybe taken" — this could be a false
      //    positive, so we MUST confirm against the real database
      //    before rejecting the registration.
      const existingByUsername = await prisma.user.findUnique({
        where: { username },
        select: { id: true },
      });

      if (existingByUsername) {
        return res.status(409).json({
          success: false,
          message: 'Username is already taken',
        });
      }
      // else: false positive — the DB confirms it's actually free,
      // so we fall through and continue registration normally.
    }

    // Email uniqueness always needs a DB check (no Bloom filter for
    // email in this design — usernames are the hot path for the
    // live-typing availability checker).
    const existingByEmail = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingByEmail) {
      return res.status(409).json({
        success: false,
        message: 'Email is already registered',
      });
    }

    // 4. Hash the password — never store plaintext.
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // 5. Persist the new user.
    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: passwordHash,
      },
    });

    // 6. Record the username in the Bloom filter so future checks
    //    (including this same process, for other requests) see it
    //    immediately without waiting on a DB read.
    usernameBloomFilter.add(username);

    // 7. Log the user in immediately by initializing their session.
    //    Regenerate the session id first to prevent session fixation.
    req.session.regenerate((err) => {
      if (err) {
        console.error('[auth.register] session regenerate error:', err);
        res.status(500).json({
          success: false,
          message: 'Registration succeeded but failed to start session',
        });
        return;
      }

      req.session.userId = user.id;
      req.session.username = user.username;

      res.status(201).json({
        success: true,
        message: 'Registration successful',
        user: toPublicUser(user),
      });
    });
  } catch (error) {
    // Handle a rare race condition: two requests pass the checks above
    // concurrently and both attempt to insert the same unique
    // username/email. Prisma surfaces this as error code P2002.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = (error.meta?.target as string[] | undefined)?.join(', ') || 'field';
      return res.status(409).json({
        success: false,
        message: `${target} is already taken`,
      });
    }

    console.error('[auth.register] error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during registration',
    });
  }
}

// -----------------------------------------------------------------------
// POST /api/auth/login
// -----------------------------------------------------------------------
export async function login(req: Request, res: Response): Promise<Response | void> {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const { email, username, password } = parsed.data;

  try {
    const user = await prisma.user.findUnique({
      where: email ? { email } : { username },
    });

    // Use a generic error message for both "user not found" and "wrong
    // password" to avoid leaking which emails/usernames are registered.
    const genericError = {
      success: false,
      message: 'Invalid credentials',
    };

    if (!user) {
      return res.status(401).json(genericError);
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json(genericError);
    }

    // Regenerate session id on login to prevent session fixation attacks.
    req.session.regenerate((err) => {
      if (err) {
        console.error('[auth.login] session regenerate error:', err);
        res.status(500).json({
          success: false,
          message: 'Login failed while starting session',
        });
        return;
      }

      req.session.userId = user.id;
      req.session.username = user.username;

      res.status(200).json({
        success: true,
        message: 'Login successful',
        user: toPublicUser(user),
      });
    });
  } catch (error) {
    console.error('[auth.login] error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during login',
    });
  }
}

// -----------------------------------------------------------------------
// POST /api/auth/logout
// -----------------------------------------------------------------------
export async function logout(req: Request, res: Response): Promise<Response | void> {
  if (!req.session) {
    return res.status(200).json({ success: true, message: 'Already logged out' });
  }

  req.session.destroy((err) => {
    if (err) {
      console.error('[auth.logout] error:', err);
      res.status(500).json({
        success: false,
        message: 'Failed to log out',
      });
      return;
    }

    // Clear the session cookie on the client. Name must match the
    // `name` option passed to express-session in index.ts.
    res.clearCookie(process.env.SESSION_COOKIE_NAME || 'monopoly.sid');

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  });
}

// -----------------------------------------------------------------------
// GET /api/auth/me
// -----------------------------------------------------------------------
export async function me(req: Request, res: Response): Promise<Response | void> {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      success: false,
      message: 'Not authenticated',
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
    });

    if (!user) {
      // Session refers to a user that no longer exists — clean it up.
      req.session.destroy(() => {});
      return res.status(401).json({
        success: false,
        message: 'Session is no longer valid',
      });
    }

    return res.status(200).json({
      success: true,
      user: toPublicUser(user),
    });
  } catch (error) {
    console.error('[auth.me] error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}

// -----------------------------------------------------------------------
// GET /api/auth/check-username?username=...
// -----------------------------------------------------------------------
export async function checkUsername(req: Request, res: Response): Promise<Response> {
  const parsed = checkUsernameQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const { username } = parsed.data;

  try {
    const mightExist = usernameBloomFilter.has(username);

    if (!mightExist) {
      // Bloom filter guarantees no false negatives, so this is a
      // definitive answer with zero DB hits.
      return res.status(200).json({ success: true, available: true });
    }

    // Possibly taken — confirm against the database to rule out a
    // Bloom filter false positive before telling the user "taken".
    const existingUser = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    return res.status(200).json({
      success: true,
      available: !existingUser,
    });
  } catch (error) {
    console.error('[auth.checkUsername] error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}
