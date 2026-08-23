import {
  BOARD_SIZE,
  GO_SALARY,
  JAIL_POSITION,
  forwardDistance,
  getTile,
} from '../models/index.js';
import type { GameState, Player } from '../models/index.js';
import { log } from './log.js';

function wrap(position: number): number {
  return ((position % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE;
}

function payGoSalary(state: GameState, player: Player, times: number): void {
  if (times <= 0) return;
  player.cash += GO_SALARY * times;
  log(state, `${player.name} passed Go and collected ${GO_SALARY * times}.`);
}

function land(state: GameState, player: Player, position: number): void {
  player.position = position;
  log(state, `${player.name} landed on ${getTile(position).name}.`);
}

/**
 * Move a token forward, paying the Go salary for each time it passes or
 * lands on Go. Used for dice rolls, where passing Go always pays.
 */
export function advance(state: GameState, player: Player, steps: number): void {
  if (steps < 0) throw new Error('advance() moves forward; use moveRelative()');
  payGoSalary(state, player, Math.floor((player.position + steps) / BOARD_SIZE));
  land(state, player, wrap(player.position + steps));
}

/**
 * Send a token to a fixed board position, travelling forward only.
 *
 * The salary is paid only when the card says to AND the trip actually wraps
 * past Go: "Advance to Pall Mall" pays nothing to a player already past it.
 */
export function advanceTo(
  state: GameState,
  player: Player,
  position: number,
  collectGoSalary: boolean,
): void {
  const distance = forwardDistance(player.position, position);
  if (collectGoSalary) {
    payGoSalary(state, player, Math.floor((player.position + distance) / BOARD_SIZE));
  }
  land(state, player, wrap(position));
}

/**
 * Move by a signed offset, as the "Go back three spaces" card does.
 *
 * A backward move never pays the salary. The rulebook states the exception
 * outright: you do not pass Go when you are sent back. Landing on Go itself
 * by moving backward pays nothing either.
 */
export function moveRelative(state: GameState, player: Player, offset: number): void {
  if (offset >= 0) {
    advance(state, player, offset);
    return;
  }
  land(state, player, wrap(player.position + offset));
}

/**
 * Straight to Jail. No salary is paid however far the token travels, and
 * the doubles run is broken. Ending the turn is the caller's job.
 */
export function goToJail(state: GameState, player: Player): void {
  player.position = JAIL_POSITION;
  player.inJail = true;
  player.jailTurns = 0;
  state.doublesCount = 0;
  log(state, `${player.name} was sent to Jail, without collecting ${GO_SALARY}.`);
}
