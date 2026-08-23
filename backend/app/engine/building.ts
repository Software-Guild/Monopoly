import {
  GROUP_POSITIONS,
  HOTEL_LEVEL,
  VARIANT_RULES,
  getTile,
} from '../models/index.js';
import type { GameState, Player, PropertyTile } from '../models/index.js';
import { groupHasMortgage, ownsWholeGroup } from './holdings.js';
import { log } from './log.js';

/** Why a building cannot go up. Each maps to a rule the rulebook states. */
export type BuildRefusal =
  | 'NOT_A_SITE'
  | 'NOT_THE_OWNER'
  | 'INCOMPLETE_GROUP'
  | 'GROUP_MORTGAGED'
  | 'ALREADY_A_HOTEL'
  | 'UNEVEN'
  | 'GROUP_NOT_READY_FOR_HOTEL'
  | 'BANK_HAS_NO_HOUSES'
  | 'BANK_HAS_NO_HOTELS'
  | 'CANNOT_AFFORD';

export interface BuildCheck {
  allowed: boolean;
  refusal?: BuildRefusal;
  /** What the next building on this Site costs. */
  cost: number;
  /** True when the next building would be a Hotel rather than a House. */
  hotel: boolean;
}

function houseCountsIn(state: GameState, tile: PropertyTile): number[] {
  return GROUP_POSITIONS[tile.group].map((p) => state.properties[p]?.houses ?? 0);
}

/**
 * Whether the next building may go up on a Site, and what it would cost.
 *
 * The three rules that matter, in the rulebook's own terms: you must hold
 * every Site of the colour group; Houses go up evenly, so none may take a
 * second until all have a first; and a Hotel arrives only once every Site
 * of the group carries a full set of Houses.
 */
export function canBuild(state: GameState, playerId: string, position: number): BuildCheck {
  const tile = getTile(position);
  if (tile.kind !== 'PROPERTY') {
    return { allowed: false, refusal: 'NOT_A_SITE', cost: 0, hotel: false };
  }

  const perHotel = VARIANT_RULES[state.variant].housesPerHotel;
  const holding = state.properties[position];
  const houses = holding?.houses ?? 0;
  const hotel = houses === perHotel;
  const refuse = (refusal: BuildRefusal): BuildCheck => ({
    allowed: false,
    refusal,
    cost: tile.houseCost,
    hotel,
  });

  if (!holding || holding.ownerId !== playerId) return refuse('NOT_THE_OWNER');
  if (houses === HOTEL_LEVEL) return refuse('ALREADY_A_HOTEL');
  if (!ownsWholeGroup(state, playerId, tile.group)) return refuse('INCOMPLETE_GROUP');
  // A mortgage anywhere in the group stops building on all of it.
  if (groupHasMortgage(state, tile.group)) return refuse('GROUP_MORTGAGED');

  const counts = houseCountsIn(state, tile);

  if (hotel) {
    // Every other Site must already carry its full set, or a Hotel of its own.
    const ready = counts.every((count) => count >= perHotel);
    if (!ready) return refuse('GROUP_NOT_READY_FOR_HOTEL');
    if (state.bank.hotels < 1) return refuse('BANK_HAS_NO_HOTELS');
  } else {
    // Even building: only a Site level with the lowest in its group may rise.
    if (houses > Math.min(...counts)) return refuse('UNEVEN');
    if (state.bank.houses < 1) return refuse('BANK_HAS_NO_HOUSES');
  }

  const owner = state.players.find((p) => p.id === playerId);
  if (!owner || owner.cash < tile.houseCost) return refuse('CANNOT_AFFORD');

  return { allowed: true, cost: tile.houseCost, hotel };
}

export interface BuildResult {
  built: boolean;
  refusal?: BuildRefusal;
}

/**
 * Put up the next building on a Site: a House, or the Hotel that replaces a
 * full set. Buying a Hotel hands its Houses back to the Bank, which is what
 * frees them for other players during a shortage.
 *
 * Building is voluntary, so this never mortgages or sells to raise the cost;
 * a player who cannot pay outright is simply refused.
 */
export function buildHouse(state: GameState, playerId: string, position: number): BuildResult {
  const check = canBuild(state, playerId, position);
  if (!check.allowed) return { built: false, refusal: check.refusal };

  const tile = getTile(position) as PropertyTile;
  const holding = state.properties[position]!;
  const owner = state.players.find((p) => p.id === playerId) as Player;
  const perHotel = VARIANT_RULES[state.variant].housesPerHotel;

  owner.cash -= check.cost;

  if (check.hotel) {
    holding.houses = HOTEL_LEVEL;
    state.bank.hotels -= 1;
    state.bank.houses += perHotel;
    log(state, `${owner.name} built a Hotel on ${tile.name} for ${check.cost}.`);
  } else {
    holding.houses += 1;
    state.bank.houses -= 1;
    log(state, `${owner.name} built a House on ${tile.name} for ${check.cost}.`);
  }

  return { built: true };
}

/** Every Site this player could put a building on right now. */
export function buildableSites(state: GameState, playerId: string): number[] {
  const owner = state.players.find((p) => p.id === playerId);
  if (!owner) return [];
  return owner.properties.filter((position) => canBuild(state, playerId, position).allowed);
}
