import { JAIL_FINE, getTile, isOwnable } from '../models/index.js';
import type { GameState, Pending, Player } from '../models/index.js';
import { countOwnedOfKind, ownerOf } from './holdings.js';

/**
 * The answer to a pending decision. Each variant matches the Pending it
 * replies to, so a mismatched answer is a type error rather than a
 * silently-ignored field.
 */
export type Decision =
  | { type: 'ROLL' }
  | { type: 'BUY_PROPERTY'; buy: boolean }
  /** `bid` of null drops out of the auction. */
  | { type: 'AUCTION_BID'; bid: number | null }
  | { type: 'JAIL_DECISION'; action: 'PAY' | 'CARD' | 'ROLL' };

/**
 * Whoever answers for a player. The turn loop awaits this and does not care
 * whether the answer took a millisecond or a minute, which is what lets one
 * loop serve both a person clicking a button and an AI deciding at once.
 */
export interface PlayerAgent {
  readonly playerId: string;
  decide(state: GameState, pending: Pending): Promise<Decision>;
}

/**
 * An agent driven from outside: `decide` returns a promise that stays
 * unresolved until the transport layer calls `submit` with what the player
 * clicked. Exactly one decision can be outstanding at a time, which mirrors
 * the game having at most one pending decision.
 */
export class HumanAgent implements PlayerAgent {
  private waiting: {
    pending: Pending;
    resolve: (decision: Decision) => void;
    reject: (error: Error) => void;
  } | null = null;

  constructor(readonly playerId: string) {}

  /** What this player is being asked, or null when nothing is outstanding. */
  get awaiting(): Pending | null {
    return this.waiting?.pending ?? null;
  }

  decide(_state: GameState, pending: Pending): Promise<Decision> {
    if (this.waiting) {
      return Promise.reject(new Error(`${this.playerId} is already being asked something`));
    }
    return new Promise<Decision>((resolve, reject) => {
      this.waiting = { pending, resolve, reject };
    });
  }

  /** Called by the HTTP or socket layer when the player answers. */
  submit(decision: Decision): void {
    const waiting = this.waiting;
    if (!waiting) throw new Error(`${this.playerId} was not asked anything`);
    if (decision.type !== waiting.pending.type) {
      throw new Error(
        `${this.playerId} answered ${decision.type} to a ${waiting.pending.type} decision`,
      );
    }
    this.waiting = null;
    waiting.resolve(decision);
  }

  /** Abandon an outstanding question, e.g. when the player disconnects. */
  cancel(reason: string): void {
    const waiting = this.waiting;
    if (!waiting) return;
    this.waiting = null;
    waiting.reject(new Error(reason));
  }
}

/**
 * Cash a player keeps back rather than spending, so that buying a Site does
 * not immediately bankrupt them on someone else's rent. One Go salary is a
 * reasonable cushion.
 */
const RESERVE = 200;

/** How much of a tile's price the AI will go to in an auction. */
const MAX_AUCTION_FRACTION = 0.75;

const AUCTION_INCREMENT = 10;

function playerOf(state: GameState, id: string): Player {
  const player = state.players.find((p) => p.id === id);
  if (!player) throw new Error(`No player ${id} in game ${state.id}`);
  return player;
}

/**
 * Would owning this tile give the player a second, third or fourth of a
 * kind? Sets, Stations and Utilities are all worth more in a group, so this
 * is the one thing that makes the AI stretch past its reserve.
 */
function buildsOnWhatTheyHave(state: GameState, player: Player, position: number): boolean {
  const tile = getTile(position);
  if (tile.kind === 'PROPERTY') {
    return player.properties.some((owned) => {
      const other = getTile(owned);
      return other.kind === 'PROPERTY' && other.group === tile.group;
    });
  }
  return countOwnedOfKind(state, player.id, tile.kind) > 0;
}

/**
 * A deliberately plain opponent. It plays soundly rather than well: it buys
 * what it can afford, pays more for tiles that build on what it already
 * holds, stays in Jail while that is free, and bids up to three quarters of
 * a tile's printed price.
 */
export class AiAgent implements PlayerAgent {
  constructor(readonly playerId: string) {}

  decide(state: GameState, pending: Pending): Promise<Decision> {
    return Promise.resolve(this.choose(state, pending));
  }

  private choose(state: GameState, pending: Pending): Decision {
    const player = playerOf(state, this.playerId);

    switch (pending.type) {
      case 'ROLL':
        return { type: 'ROLL' };

      case 'BUY_PROPERTY': {
        const affordable = player.cash - pending.price >= RESERVE;
        const worthStretching =
          player.cash >= pending.price &&
          buildsOnWhatTheyHave(state, player, pending.position);
        return { type: 'BUY_PROPERTY', buy: affordable || worthStretching };
      }

      case 'AUCTION_BID': {
        const tile = getTile(pending.position);
        if (!isOwnable(tile)) return { type: 'AUCTION_BID', bid: null };
        const ceiling = Math.min(
          Math.floor(tile.price * MAX_AUCTION_FRACTION),
          player.cash,
        );
        const next = pending.highestBid + AUCTION_INCREMENT;
        return { type: 'AUCTION_BID', bid: next <= ceiling ? next : null };
      }

      case 'JAIL_DECISION': {
        if (player.heldCards.length > 0) return { type: 'JAIL_DECISION', action: 'CARD' };
        // Rolling for a double costs nothing, so only pay when forced or
        // when the fine is trivial next to what is in hand.
        if (pending.mustPay) return { type: 'JAIL_DECISION', action: 'PAY' };
        if (player.cash > JAIL_FINE * 20) return { type: 'JAIL_DECISION', action: 'PAY' };
        return { type: 'JAIL_DECISION', action: 'ROLL' };
      }

      default:
        throw new Error(`AI cannot answer a ${pending.type} decision`);
    }
  }
}

/** Convenience for the turn loop: the agent answering for a given player. */
export type AgentsByPlayer = ReadonlyMap<string, PlayerAgent>;

export function agentFor(agents: AgentsByPlayer, playerId: string): PlayerAgent {
  const agent = agents.get(playerId);
  if (!agent) throw new Error(`No agent for player ${playerId}`);
  return agent;
}

/** Re-exported so callers can check ownership when writing their own agents. */
export { ownerOf };
