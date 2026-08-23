import {
  JAIL_FINE,
  VARIANT_RULES,
  getTile,
  isOwnable,
  richestPlayerIds,
} from '../models/index.js';
import type { DiceRoller, GameState, Player } from '../models/index.js';
import { agentFor } from './agents.js';
import type { AgentsByPlayer } from './agents.js';
import { deckForTile, drawAndApply, useJailCard } from './cards.js';
import { ownerOf } from './holdings.js';
import { log } from './log.js';
import { advance, goToJail } from './movement.js';
import { charge } from './payments.js';
import { rentFor } from './rent.js';

/** Doubles in a row that send a player to Jail. */
const DOUBLES_LIMIT = 3;

/** Turns spent in Jail before the fine becomes compulsory. */
const JAIL_TURN_LIMIT = 3;

/**
 * How many times a single landing may bounce the token onward. A card can
 * move a player onto another card tile ("Go back three spaces" from the
 * second Chance lands on Community Chest), which is legal and terminates,
 * but the cap stops a data error becoming an infinite loop.
 */
const MAX_CHAINED_MOVES = 8;

export interface GameOptions {
  /** Injected so tests can script the dice. */
  roll: DiceRoller;
  /** Injected so a timed game can be tested without waiting. */
  now?: () => number;
  /** Stop after this many turns. A safety net for AI-only games. */
  maxTurns?: number;
}

function currentPlayer(state: GameState): Player {
  const player = state.players[state.currentPlayerIndex];
  if (!player) throw new Error(`No player at index ${state.currentPlayerIndex}`);
  return player;
}

function solventPlayers(state: GameState): Player[] {
  return state.players.filter((p) => !p.bankrupt);
}

/**
 * Auction a tile to the highest bidder. The rulebook makes this compulsory
 * when a player declines to buy, and lets the player who declined bid too.
 *
 * Bidding goes round the table; anyone who does not raise drops out. It ends
 * when a full round passes with no raise, and the tile stays with the Bank
 * if nobody bid at all.
 */
export async function auction(
  state: GameState,
  position: number,
  agents: AgentsByPlayer,
): Promise<void> {
  const tile = getTile(position);
  if (!isOwnable(tile)) return;

  let active = solventPlayers(state).map((p) => p.id);
  let highestBid = 0;
  let highestBidderId: string | null = null;
  log(state, `${tile.name} goes to auction.`);

  while (active.length > 0) {
    let raised = false;

    for (const bidderId of [...active]) {
      // The leader is not asked to outbid themselves. Anyone else still in
      // gets a turn, including a lone bidder who has yet to open.
      if (bidderId === highestBidderId) continue;

      state.pending = {
        type: 'AUCTION_BID',
        playerId: bidderId,
        position,
        highestBid,
        highestBidderId,
        activeBidderIds: [...active],
      };
      const decision = await agentFor(agents, bidderId).decide(state, state.pending);
      state.pending = null;
      if (decision.type !== 'AUCTION_BID') throw new Error('Expected an auction bid');

      const bidder = state.players.find((p) => p.id === bidderId);
      const bid = decision.bid;
      if (bid === null || bid <= highestBid || !bidder || bid > bidder.cash) {
        active = active.filter((id) => id !== bidderId);
        log(state, `${bidder?.name ?? bidderId} dropped out of the auction.`);
        continue;
      }

      highestBid = bid;
      highestBidderId = bidderId;
      raised = true;
      log(state, `${bidder.name} bid ${bid} for ${tile.name}.`);
    }

    if (!raised) break;
  }

  if (highestBidderId === null) {
    log(state, `Nobody bid for ${tile.name}; it stays with the Bank.`);
    return;
  }
  transferFromBank(state, highestBidderId, position, highestBid);
}

function transferFromBank(
  state: GameState,
  buyerId: string,
  position: number,
  price: number,
): void {
  const buyer = state.players.find((p) => p.id === buyerId);
  const holding = state.properties[position];
  if (!buyer || !holding) return;
  charge(state, buyerId, price, null);
  // Paying may have taken everything they had; a bankrupt buyer gets nothing.
  if (buyer.bankrupt) return;
  holding.ownerId = buyerId;
  buyer.properties.push(position);
  log(state, `${buyer.name} took ${getTile(position).name} for ${price}.`);
}

/**
 * Work out what landing on a tile costs or offers, following the token on
 * if a card moves it again.
 */
async function resolveLanding(
  state: GameState,
  player: Player,
  diceTotal: number,
  agents: AgentsByPlayer,
  rentMultiplier?: number,
  depth = 0,
): Promise<void> {
  if (player.bankrupt || depth >= MAX_CHAINED_MOVES) return;

  const tile = getTile(player.position);

  if (isOwnable(tile)) {
    const owner = ownerOf(state, tile.position);
    if (owner === null) {
      await offerPurchase(state, player, tile.position, agents);
      return;
    }
    if (owner === player.id) return;
    const rent = rentFor(state, tile.position, diceTotal, rentMultiplier);
    if (rent > 0) charge(state, player.id, rent, owner);
    return;
  }

  switch (tile.kind) {
    case 'TAX':
      charge(state, player.id, tile.amount, null);
      return;

    case 'CHANCE':
    case 'COMMUNITY_CHEST': {
      const deck = deckForTile(tile.position);
      if (!deck) return;
      const outcome = drawAndApply(state, player, deck, diceTotal);
      if (!outcome.moved) return;
      await resolveLanding(
        state,
        player,
        diceTotal,
        agents,
        outcome.rentMultiplier,
        depth + 1,
      );
      return;
    }

    case 'CORNER':
      if (tile.corner === 'GO_TO_JAIL') goToJail(state, player);
      // Go, Free Parking and Just Visiting all cost nothing.
      return;
  }
}

/** Offer an unowned tile at its printed price, auctioning it if declined. */
async function offerPurchase(
  state: GameState,
  player: Player,
  position: number,
  agents: AgentsByPlayer,
): Promise<void> {
  const tile = getTile(position);
  if (!isOwnable(tile)) return;

  state.pending = { type: 'BUY_PROPERTY', playerId: player.id, position, price: tile.price };
  const decision = await agentFor(agents, player.id).decide(state, state.pending);
  state.pending = null;
  if (decision.type !== 'BUY_PROPERTY') throw new Error('Expected a purchase decision');

  if (decision.buy && player.cash >= tile.price) {
    transferFromBank(state, player.id, position, tile.price);
    return;
  }
  await auction(state, position, agents);
}

/**
 * Get a player out of Jail, or leave them there.
 *
 * Returns the roll to move with when the player is free to move this turn,
 * or null when their turn ends in Jail. A double rolled to get out moves the
 * token but does not earn another go, which is what the rulebook means by
 * moving out "using this dice roll".
 */
async function resolveJail(
  state: GameState,
  player: Player,
  agents: AgentsByPlayer,
  options: GameOptions,
): Promise<{ steps: number; earnedAnotherTurn: boolean } | null> {
  const mustPay = player.jailTurns >= JAIL_TURN_LIMIT - 1;
  state.pending = {
    type: 'JAIL_DECISION',
    playerId: player.id,
    fine: JAIL_FINE,
    mustPay,
  };
  const decision = await agentFor(agents, player.id).decide(state, state.pending);
  state.pending = null;
  if (decision.type !== 'JAIL_DECISION') throw new Error('Expected a jail decision');

  if (decision.action === 'CARD' && useJailCard(state, player)) {
    const dice = options.roll();
    return { steps: dice.total, earnedAnotherTurn: dice.isDouble };
  }

  if (decision.action === 'PAY' || (decision.action === 'CARD' && mustPay)) {
    charge(state, player.id, JAIL_FINE, null);
    if (player.bankrupt) return null;
    player.inJail = false;
    player.jailTurns = 0;
    const dice = options.roll();
    return { steps: dice.total, earnedAnotherTurn: dice.isDouble };
  }

  // Rolling for a double.
  const dice = options.roll();
  if (dice.isDouble) {
    player.inJail = false;
    player.jailTurns = 0;
    log(state, `${player.name} rolled a double and left Jail.`);
    return { steps: dice.total, earnedAnotherTurn: false };
  }

  player.jailTurns += 1;
  if (player.jailTurns < JAIL_TURN_LIMIT) {
    log(state, `${player.name} failed to roll a double and stays in Jail.`);
    return null;
  }

  // Third failed attempt: the fine is now compulsory and the token still moves.
  log(state, `${player.name} served three turns and must pay the fine.`);
  charge(state, player.id, JAIL_FINE, null);
  if (player.bankrupt) return null;
  player.inJail = false;
  player.jailTurns = 0;
  return { steps: dice.total, earnedAnotherTurn: false };
}

/**
 * Play one player's whole turn: their roll or rolls, the tiles they land on,
 * and the doubles rule that either grants another go or sends them to Jail.
 */
export async function takeTurn(
  state: GameState,
  agents: AgentsByPlayer,
  options: GameOptions,
): Promise<void> {
  const player = currentPlayer(state);
  if (player.bankrupt) return;

  state.doublesCount = 0;
  state.hasRolled = false;

  if (player.inJail) {
    const release = await resolveJail(state, player, agents, options);
    if (!release) return;
    state.hasRolled = true;
    advance(state, player, release.steps);
    await resolveLanding(state, player, release.steps, agents);
    if (!release.earnedAnotherTurn || player.bankrupt || player.inJail) return;
  }

  while (!player.bankrupt) {
    state.pending = {
      type: 'ROLL',
      playerId: player.id,
      doublesSoFar: state.doublesCount,
    };
    const decision = await agentFor(agents, player.id).decide(state, state.pending);
    state.pending = null;
    if (decision.type !== 'ROLL') throw new Error('Expected a roll');

    const dice = options.roll();
    state.hasRolled = true;
    log(state, `${player.name} rolled ${dice.die1} and ${dice.die2}.`);

    if (dice.isDouble) {
      state.doublesCount += 1;
      if (state.doublesCount === DOUBLES_LIMIT) {
        log(state, `${player.name} rolled a third double in a row.`);
        goToJail(state, player);
        return;
      }
    }

    advance(state, player, dice.total);
    await resolveLanding(state, player, dice.total, agents);

    // Being sent to Jail ends the turn however the token got there.
    if (!dice.isDouble || player.inJail || player.bankrupt) return;
  }
}

/** Move play to the next player who is still in the game. */
export function advanceToNextPlayer(state: GameState): void {
  const total = state.players.length;
  for (let step = 1; step <= total; step += 1) {
    const index = (state.currentPlayerIndex + step) % total;
    if (!state.players[index]?.bankrupt) {
      state.currentPlayerIndex = index;
      state.turnCount += 1;
      return;
    }
  }
}

/**
 * Decide whether the game is over, by whichever ending this variant uses,
 * and record the winner. Returns true once play should stop.
 */
export function checkGameOver(state: GameState, options: GameOptions): boolean {
  const rules = VARIANT_RULES[state.variant];
  const standing = solventPlayers(state);

  const finish = (winnerId: string | null, why: string): boolean => {
    state.phase = 'FINISHED';
    state.winnerId = winnerId;
    log(state, why);
    return true;
  };

  if (standing.length <= 1) {
    const last = standing[0];
    return finish(last?.id ?? null, last ? `${last.name} is the last player standing.` : 'Everyone is bankrupt.');
  }

  const bankrupts = state.players.length - standing.length;
  if (rules.endsOn === 'SECOND_BANKRUPTCY' && bankrupts >= 2) {
    const richest = richestPlayerIds(state, rules);
    return finish(richest.length === 1 ? richest[0]! : null, 'Second bankruptcy: the richest player wins.');
  }

  if (rules.endsOn === 'DEADLINE' && state.endsAt !== null) {
    const now = options.now ?? Date.now;
    if (now() >= state.endsAt) {
      const richest = richestPlayerIds(state, rules);
      return finish(richest.length === 1 ? richest[0]! : null, 'Time is up: the richest player wins.');
    }
  }

  return false;
}

/**
 * Play until the game ends.
 *
 * The loop is the same for everyone: ask, wait, act, hand on. A human agent
 * leaves the await pending until a button is clicked, an AI agent resolves
 * straight away, and nothing else about the turn changes.
 */
export async function runGame(
  state: GameState,
  agents: AgentsByPlayer,
  options: GameOptions,
): Promise<GameState> {
  const limit = options.maxTurns ?? Infinity;
  let played = 0;

  while (state.phase === 'IN_PROGRESS' && played < limit) {
    await takeTurn(state, agents, options);
    played += 1;
    if (checkGameOver(state, options)) break;
    advanceToNextPlayer(state);
  }

  state.pending = null;
  return state;
}
