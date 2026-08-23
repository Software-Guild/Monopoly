import {
  CHANCE_CARDS,
  COMMUNITY_CHEST_CARDS,
  HOTEL_SUPPLY,
  HOUSE_SUPPLY,
  OWNABLE_POSITIONS,
  STARTING_CASH,
} from '../app/models/index.js';
import type { DiceRoller, GameState, Player, PropertyState } from '../app/models/index.js';

/** London board positions used across the tests, by name. */
export const TILE = {
  go: 0,
  oldKent: 1,
  whitechapel: 3,
  incomeTax: 4,
  kingsCross: 5,
  angel: 6,
  chanceEarly: 7,
  euston: 8,
  pentonville: 9,
  jail: 10,
  pallMall: 11,
  electric: 12,
  whitehall: 13,
  northumberland: 14,
  marylebone: 15,
  freeParking: 20,
  trafalgar: 24,
  fenchurch: 25,
  waterWorks: 28,
  goToJail: 30,
  liverpool: 35,
  parkLane: 37,
  superTax: 38,
  mayfair: 39,
} as const;

export function makePlayer(id: string, name: string, cash = STARTING_CASH): Player {
  return {
    id,
    name,
    position: 0,
    cash,
    properties: [],
    inJail: false,
    jailTurns: 0,
    heldCards: [],
    bankrupt: false,
  };
}

/** A two-player game in progress with every deed still with the Bank. */
export function makeGame(players: Player[] = [makePlayer('p1', 'Ada'), makePlayer('p2', 'Grace')]): GameState {
  const properties: Record<number, PropertyState> = {};
  for (const position of OWNABLE_POSITIONS) {
    properties[position] = { position, ownerId: null, houses: 0, mortgaged: false };
  }
  return {
    id: 'test-game',
    phase: 'IN_PROGRESS',
    variant: 'STANDARD',
    endsAt: null,
    players,
    currentPlayerIndex: 0,
    properties,
    bank: { houses: HOUSE_SUPPLY, hotels: HOTEL_SUPPLY },
    decks: {
      CHANCE: CHANCE_CARDS.map((c) => c.id),
      COMMUNITY_CHEST: COMMUNITY_CHEST_CARDS.map((c) => c.id),
    },
    doublesCount: 0,
    hasRolled: false,
    pending: null,
    turnCount: 1,
    winnerId: null,
    log: [],
  };
}

/** Give `player` the deed to `position`, optionally built or mortgaged. */
export function give(
  state: GameState,
  player: Player,
  position: number,
  options: { houses?: number; mortgaged?: boolean } = {},
): void {
  const holding = state.properties[position];
  if (!holding) throw new Error(`Position ${position} is not ownable`);
  holding.ownerId = player.id;
  holding.houses = options.houses ?? 0;
  holding.mortgaged = options.mortgaged ?? false;
  player.properties.push(position);
}

/** Houses standing on each of the given positions, in order. */
export function housesOn(state: GameState, positions: number[]): number[] {
  return positions.map((p) => state.properties[p]?.houses ?? 0);
}

/**
 * A DiceRoller that returns a fixed sequence, cycling once exhausted so a
 * long loop never runs dry.
 */
export function scriptedRoller(rolls: Array<[number, number]>): DiceRoller {
  if (rolls.length === 0) throw new Error('scriptedRoller needs at least one roll');
  let index = 0;
  return () => {
    const [die1, die2] = rolls[index % rolls.length]!;
    index += 1;
    return { die1, die2, total: die1 + die2, isDouble: die1 === die2 };
  };
}

/** Hand every ownable tile to one player, so movement tests stay quiet. */
export function ownEverything(state: GameState, player: Player): void {
  for (const position of OWNABLE_POSITIONS) {
    const holding = state.properties[position];
    if (!holding) continue;
    holding.ownerId = player.id;
    player.properties.push(position);
  }
}
