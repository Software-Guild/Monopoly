import type { GameState } from '../models/index.js';

/**
 * Append a line to the game log. Every engine action that a player could
 * dispute — money moving, a deed changing hands, a building sold — goes
 * through here, so the log is a complete account rather than a highlight reel.
 */
export function log(state: GameState, message: string): void {
  state.log.push(message);
}
