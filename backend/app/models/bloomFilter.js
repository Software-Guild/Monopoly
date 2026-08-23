// app/models/bloomFilter.js
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
// auth.controller.js#register for the double-check pattern.

const { BloomFilter } = require('bloom-filters');

// Tunable parameters -----------------------------------------------------
// Expected number of usernames the filter should be sized for, and the
// target false-positive rate. Adjust EXPECTED_ELEMENTS upward as your
// user base grows; a filter sized too small will have a rapidly rising
// false-positive rate as it fills up.
const EXPECTED_ELEMENTS = 100_000;
const FALSE_POSITIVE_RATE = 0.01; // 1%

class UsernameBloomFilter {
  constructor() {
    this._filter = BloomFilter.create(EXPECTED_ELEMENTS, FALSE_POSITIVE_RATE);
    this._ready = false;
  }

  /**
   * Populate the filter from all existing usernames in the database.
   * Should be called once at server startup, before the app starts
   * accepting traffic.
   * @param {import('@prisma/client').PrismaClient} prisma
   */
  async init(prisma) {
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
   * @param {string} username
   */
  add(username) {
    this._filter.add(this._normalize(username));
  }

  /**
   * Check whether a username is *possibly* already taken.
   * - false  => definitely available, no DB check needed.
   * - true   => possibly taken (or a false positive) — verify with DB.
   * @param {string} username
   * @returns {boolean}
   */
  has(username) {
    return this._filter.has(this._normalize(username));
  }

  isReady() {
    return this._ready;
  }

  _normalize(username) {
    // Usernames are treated case-insensitively for availability checks.
    return username.trim().toLowerCase();
  }
}

// Export a singleton instance — a single Bloom filter shared across
// the whole process, populated once at startup in index.js.
module.exports = new UsernameBloomFilter();
