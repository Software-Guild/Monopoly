// app/schema/auth.schema.js
// Zod schemas used to validate incoming request bodies/queries for the
// auth API. Keeping validation here (rather than in controllers) keeps
// the controller logic focused on orchestration.

const { z } = require('zod');

// Reusable primitives -------------------------------------------------

const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Username must be at least 3 characters long')
  .max(20, 'Username must be at most 20 characters long')
  .regex(
    /^[a-zA-Z0-9_]+$/,
    'Username can only contain letters, numbers, and underscores'
  );

// Strict-ish email validation. Zod's built-in .email() already covers
// most RFC 5322 cases reasonably well; we layer a small extra regex
// check on top for defense in depth against obviously malformed input.
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Invalid email address')
  .regex(EMAIL_REGEX, 'Invalid email address');

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(128, 'Password must be at most 128 characters long')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

// Endpoint schemas ------------------------------------------------------

const registerSchema = z
  .object({
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Password and confirmPassword do not match',
    path: ['confirmPassword'],
  });

const loginSchema = z
  .object({
    email: emailSchema.optional(),
    username: usernameSchema.optional(),
    password: z.string().min(1, 'Password is required'),
  })
  .refine((data) => data.email || data.username, {
    message: 'Either email or username is required',
    path: ['email'],
  });

const checkUsernameQuerySchema = z.object({
  username: usernameSchema,
});

module.exports = {
  registerSchema,
  loginSchema,
  checkUsernameQuerySchema,
};
