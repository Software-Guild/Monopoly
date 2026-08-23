// app/models/bloomFilter.ts
//
// In-memory Bloom Filter used to answer "is this username taken?"
// checks very quickly without hitting PostgreSQL on every keystroke
// of a sign-up form.
//
// IMPORTANT: A Bloom filter can produce FALSE POSITIVES (it may say a
// username "might exist" when it actually doesn't) but NEVER false
// negatives (if it says a username is "definitely available", that is
// always true, since it was never inserted).
//
// Because of the false-positive possibility, callers MUST treat a
// "possibly exists" answer from `.has()` as a hint only, and confirm
// with a real database lookup before rejecting a registration. See
// auth.controller.ts#register for the double-check pattern.

import { BloomFilter } from 'bloom-filters';
import type { PrismaClient } from '@prisma/client';

// Tunable parameters -----------------------------------------------------
// Expected number of usernames the filter should be sized for, and the
// target false-positive rate. Adjust EXPECTED_ELEMENTS upward as your
// user base grows; a filter sized too small will have a rapidly rising
// false-positive rate as it fills up.
const EXPECTED_ELEMENTS = 100_000;
const FALSE_POSITIVE_RATE = 0.01; // 1%

class UsernameBloomFilter {
  private _filter: BloomFilter;
  private _ready: boolean;

  constructor() {
    this._filter = BloomFilter.create(EXPECTED_ELEMENTS, FALSE_POSITIVE_RATE);
    this._ready = false;
  }

  /**
   * Populate the filter from all existing usernames in the database.
   * Should be called once at server startup, before the app starts
   * accepting traffic.
   */
  async init(prisma: PrismaClient): Promise<void> {
    const users = await prisma.user.findMany({ select: { username: true } });

    for (const { username } of users) {
      this._filter.add(this._normalize(username));
    }

    this._ready = true;
    console.log(
      `[bloomFilter] Initialized with ${users.length} existing username(s).`
    );
  }

  /**
   * Add a newly registered username to the filter. Call this
   * immediately after a successful registration, inside the same
   * request that persisted the user to PostgreSQL.
   */
  add(username: string): void {
    this._filter.add(this._normalize(username));
  }

  /**
   * Check whether a username is *possibly* already taken.
   * - false  => definitely available, no DB check needed.
   * - true   => possibly taken (or a false positive) — verify with DB.
   */
  has(username: string): boolean {
    return this._filter.has(this._normalize(username));
  }

  isReady(): boolean {
    return this._ready;
  }

  private _normalize(username: string): string {
    // Usernames are treated case-insensitively for availability checks.
    return username.trim().toLowerCase();
  }
}

// Export a singleton instance — a single Bloom filter shared across
// the whole process, populated once at startup in index.ts.
export default new UsernameBloomFilter();
