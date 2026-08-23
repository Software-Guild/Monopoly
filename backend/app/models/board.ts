import type {
  ColorGroup,
  GameVariant,
  OwnableTile,
  Tile,
  VariantRules,
} from './types.js';

/* ------------------------------------------------------------------ *
 * Rule constants
 *
 * Declared before BOARD because the tile entries below reference them.
 * ------------------------------------------------------------------ */

export const BOARD_SIZE = 40;
export const JAIL_POSITION = 10;
export const GO_SALARY = 200;
export const JAIL_FINE = 50;
export const STARTING_CASH = 1500;

/** Buildings the bank starts with. Both supplies are finite by the rules. */
export const HOUSE_SUPPLY = 32;
export const HOTEL_SUPPLY = 12;

/**
 * Houses handed back to the Bank when a Hotel is bought. The short game
 * lowers this to three; the standard game is four.
 */
export const HOUSES_PER_HOTEL = 4;

/** The value PropertyState.houses takes once a Hotel stands on the Site. */
export const HOTEL_LEVEL = 5;

/**
 * Mortgage terms. A Title Deed's mortgage value is half its price, and
 * lifting the mortgage costs that value plus interest.
 */
export const MORTGAGE_RATE = 0.5;
/** Interest to lift a mortgage, as whole percent. Integer to keep the
 * arithmetic exact: a 0.1 rate makes 100 * 1.1 come out as 110.000...1. */
export const MORTGAGE_INTEREST_PERCENT = 10;

/** The Bank buys Houses and Hotels back at half what they cost. */
export const BUILDING_SELLBACK_RATE = 0.5;

/**
 * Note: the Bank holds no cash balance. The rulebook has it issue as much
 * money as needed, so only the building supplies above are finite.
 */

/**
 * What each rulebook game changes. The short game deals deeds, needs one
 * House fewer per Hotel, and ends at the second bankruptcy; the time-limit
 * game deals deeds and ends at an agreed hour.
 */
export const VARIANT_RULES: Record<GameVariant, VariantRules> = {
  STANDARD: { housesPerHotel: HOUSES_PER_HOTEL, dealtDeeds: 0, endsOn: 'LAST_SOLVENT' },
  SHORT: { housesPerHotel: 3, dealtDeeds: 2, endsOn: 'SECOND_BANKRUPTCY' },
  TIME_LIMIT: { housesPerHotel: HOUSES_PER_HOTEL, dealtDeeds: 2, endsOn: 'DEADLINE' },
};

/** Railroad rent by number of railroads the owner holds: [1, 2, 3, 4]. */
/* The London edition calls these Stations; RAILROAD stays as the internal
 * tile kind so the type names match across editions. */
export const RAILROAD_RENT = [25, 50, 100, 200] as const;

/**
 * Utility rent multiplier by number of utilities the owner holds: [1, 2].
 * Rent is `multiplier * diceTotal`, not a flat amount.
 */
export const UTILITY_MULTIPLIERS = [4, 10] as const;

/* ------------------------------------------------------------------ *
 * The board
 *
 * The standard 40-tile board, clockwise from Go at index 0.
 * Property rent tuples are [0 houses, 1, 2, 3, 4, hotel].
 * ------------------------------------------------------------------ */

export const BOARD: readonly Tile[] = [
  { position: 0, name: 'Go', kind: 'CORNER', corner: 'GO' },
  {
    position: 1, name: 'Old Kent Road', kind: 'PROPERTY', group: 'BROWN',
    price: 60, houseCost: 50, rent: [2, 10, 30, 90, 160, 250],
  },
  { position: 2, name: 'Community Chest', kind: 'COMMUNITY_CHEST' },
  {
    position: 3, name: 'Whitechapel Road', kind: 'PROPERTY', group: 'BROWN',
    price: 60, houseCost: 50, rent: [4, 20, 60, 180, 320, 450],
  },
  { position: 4, name: 'Income Tax', kind: 'TAX', amount: 200 },
  {
    position: 5, name: 'Kings Cross Station', kind: 'RAILROAD',
    price: 200, rent: RAILROAD_RENT,
  },
  {
    position: 6, name: 'The Angel Islington', kind: 'PROPERTY', group: 'LIGHT_BLUE',
    price: 100, houseCost: 50, rent: [6, 30, 90, 270, 400, 550],
  },
  { position: 7, name: 'Chance', kind: 'CHANCE' },
  {
    position: 8, name: 'Euston Road', kind: 'PROPERTY', group: 'LIGHT_BLUE',
    price: 100, houseCost: 50, rent: [6, 30, 90, 270, 400, 550],
  },
  {
    position: 9, name: 'Pentonville Road', kind: 'PROPERTY', group: 'LIGHT_BLUE',
    price: 120, houseCost: 50, rent: [8, 40, 100, 300, 450, 600],
  },
  { position: 10, name: 'Jail / Just Visiting', kind: 'CORNER', corner: 'JAIL' },
  {
    position: 11, name: 'Pall Mall', kind: 'PROPERTY', group: 'PINK',
    price: 140, houseCost: 100, rent: [10, 50, 150, 450, 625, 750],
  },
  {
    position: 12, name: 'Electric Company', kind: 'UTILITY',
    price: 150, rentMultiplier: UTILITY_MULTIPLIERS,
  },
  {
    position: 13, name: 'Whitehall', kind: 'PROPERTY', group: 'PINK',
    price: 140, houseCost: 100, rent: [10, 50, 150, 450, 625, 750],
  },
  {
    position: 14, name: 'Northumberland Avenue', kind: 'PROPERTY', group: 'PINK',
    price: 160, houseCost: 100, rent: [12, 60, 180, 500, 700, 900],
  },
  {
    position: 15, name: 'Marylebone Station', kind: 'RAILROAD',
    price: 200, rent: RAILROAD_RENT,
  },
  {
    position: 16, name: 'Bow Street', kind: 'PROPERTY', group: 'ORANGE',
    price: 180, houseCost: 100, rent: [14, 70, 200, 550, 750, 950],
  },
  { position: 17, name: 'Community Chest', kind: 'COMMUNITY_CHEST' },
  {
    position: 18, name: 'Marlborough Street', kind: 'PROPERTY', group: 'ORANGE',
    price: 180, houseCost: 100, rent: [14, 70, 200, 550, 750, 950],
  },
  {
    position: 19, name: 'Vine Street', kind: 'PROPERTY', group: 'ORANGE',
    price: 200, houseCost: 100, rent: [16, 80, 220, 600, 800, 1000],
  },
  { position: 20, name: 'Free Parking', kind: 'CORNER', corner: 'FREE_PARKING' },
  {
    position: 21, name: 'Strand', kind: 'PROPERTY', group: 'RED',
    price: 220, houseCost: 150, rent: [18, 90, 250, 700, 875, 1050],
  },
  { position: 22, name: 'Chance', kind: 'CHANCE' },
  {
    position: 23, name: 'Fleet Street', kind: 'PROPERTY', group: 'RED',
    price: 220, houseCost: 150, rent: [18, 90, 250, 700, 875, 1050],
  },
  {
    position: 24, name: 'Trafalgar Square', kind: 'PROPERTY', group: 'RED',
    price: 240, houseCost: 150, rent: [20, 100, 300, 750, 925, 1100],
  },
  {
    position: 25, name: 'Fenchurch Street Station', kind: 'RAILROAD',
    price: 200, rent: RAILROAD_RENT,
  },
  {
    position: 26, name: 'Leicester Square', kind: 'PROPERTY', group: 'YELLOW',
    price: 260, houseCost: 150, rent: [22, 110, 330, 800, 975, 1150],
  },
  {
    position: 27, name: 'Coventry Street', kind: 'PROPERTY', group: 'YELLOW',
    price: 260, houseCost: 150, rent: [22, 110, 330, 800, 975, 1150],
  },
  {
    position: 28, name: 'Water Works', kind: 'UTILITY',
    price: 150, rentMultiplier: UTILITY_MULTIPLIERS,
  },
  {
    position: 29, name: 'Piccadilly', kind: 'PROPERTY', group: 'YELLOW',
    price: 280, houseCost: 150, rent: [24, 120, 360, 850, 1025, 1200],
  },
  { position: 30, name: 'Go To Jail', kind: 'CORNER', corner: 'GO_TO_JAIL' },
  {
    position: 31, name: 'Regent Street', kind: 'PROPERTY', group: 'GREEN',
    price: 300, houseCost: 200, rent: [26, 130, 390, 900, 1100, 1275],
  },
  {
    position: 32, name: 'Oxford Street', kind: 'PROPERTY', group: 'GREEN',
    price: 300, houseCost: 200, rent: [26, 130, 390, 900, 1100, 1275],
  },
  { position: 33, name: 'Community Chest', kind: 'COMMUNITY_CHEST' },
  {
    position: 34, name: 'Bond Street', kind: 'PROPERTY', group: 'GREEN',
    price: 320, houseCost: 200, rent: [28, 150, 450, 1000, 1200, 1400],
  },
  {
    position: 35, name: 'Liverpool Street Station', kind: 'RAILROAD',
    price: 200, rent: RAILROAD_RENT,
  },
  { position: 36, name: 'Chance', kind: 'CHANCE' },
  {
    position: 37, name: 'Park Lane', kind: 'PROPERTY', group: 'DARK_BLUE',
    price: 350, houseCost: 200, rent: [35, 175, 500, 1100, 1300, 1500],
  },
  { position: 38, name: 'Super Tax', kind: 'TAX', amount: 100 },
  {
    position: 39, name: 'Mayfair', kind: 'PROPERTY', group: 'DARK_BLUE',
    price: 400, houseCost: 200, rent: [50, 200, 600, 1400, 1700, 2000],
  },
];

/* ------------------------------------------------------------------ *
 * Lookups
 * ------------------------------------------------------------------ */

/** Resolve a board position, wrapping in both directions. */
export function getTile(position: number): Tile {
  const tile = BOARD[((position % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE];
  if (!tile) throw new Error(`No tile at position ${position}`);
  return tile;
}

export function isOwnable(tile: Tile): tile is OwnableTile {
  return tile.kind === 'PROPERTY' || tile.kind === 'RAILROAD' || tile.kind === 'UTILITY';
}

/** Every board position that can be bought. */
export const OWNABLE_POSITIONS: readonly number[] = BOARD.filter(isOwnable).map(
  (t) => t.position,
);

/** Positions making up each colour group, used for monopoly checks. */
export const GROUP_POSITIONS: Record<ColorGroup, readonly number[]> = BOARD.reduce(
  (acc, tile) => {
    if (tile.kind === 'PROPERTY') {
      (acc[tile.group] ??= []).push(tile.position);
    }
    return acc;
  },
  {} as Record<ColorGroup, number[]>,
);

/** What the Bank lends against a Title Deed: half the printed price. */
export function mortgageValue(tile: OwnableTile): number {
  return Math.floor(tile.price * MORTGAGE_RATE);
}

/** Cost to lift a mortgage: the sum borrowed plus 10% interest. */
export function unmortgageCost(tile: OwnableTile): number {
  const borrowed = mortgageValue(tile);
  return borrowed + Math.ceil((borrowed * MORTGAGE_INTEREST_PERCENT) / 100);
}

/** Forward distance from `from` to `to`, wrapping past Go. Always 0..39. */
export function forwardDistance(from: number, to: number): number {
  return (((to - from) % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE;
}

/**
 * The next tile of a given kind strictly after `from`, travelling forward.
 * Used by the "advance to the nearest railroad/utility" Chance cards.
 */
export function nearestTileOfKind(from: number, kind: 'RAILROAD' | 'UTILITY'): Tile {
  for (let step = 1; step <= BOARD_SIZE; step += 1) {
    const tile = getTile(from + step);
    if (tile.kind === kind) return tile;
  }
  throw new Error(`No tile of kind ${kind} on the board`);
}
