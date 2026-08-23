import type { DiceRoll, DiceRoller } from '../models/index.js';

/** One throw of two dice. */
export function rollDice(random: () => number = Math.random): DiceRoll {
  const die1 = 1 + Math.floor(random() * 6);
  const die2 = 1 + Math.floor(random() * 6);
  return { die1, die2, total: die1 + die2, isDouble: die1 === die2 };
}

/**
 * The roller a real game uses. Every engine entry point takes a DiceRoller
 * so tests can supply their own sequence and no rules code ever reaches for
 * Math.random itself.
 */
export const randomRoller: DiceRoller = () => rollDice();
