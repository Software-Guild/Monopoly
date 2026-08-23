/**
 * Domain types for the Monopoly rules engine.
 *
 * Everything under `app/models` is pure data and type declarations: no
 * database, no HTTP, no behaviour. Game logic reads these tables and decides
 * what to do, so no card or tile has its behaviour hardcoded at its call site.
 */

/* ------------------------------------------------------------------ *
 * Board
 * ------------------------------------------------------------------ */

export type ColorGroup =
  | 'BROWN'
  | 'LIGHT_BLUE'
  | 'PINK'
  | 'ORANGE'
  | 'RED'
  | 'YELLOW'
  | 'GREEN'
  | 'DARK_BLUE';

export type TileKind =
  | 'PROPERTY'
  | 'RAILROAD'
  | 'UTILITY'
  | 'TAX'
  | 'CHANCE'
  | 'COMMUNITY_CHEST'
  | 'CORNER';

/** Which of the four corners a CORNER tile is. */
export type CornerKind = 'GO' | 'JAIL' | 'FREE_PARKING' | 'GO_TO_JAIL';

interface BaseTile {
  /** Board index, 0..39. GO is 0 and the board runs clockwise. */
  position: number;
  name: string;
  kind: TileKind;
}

export interface PropertyTile extends BaseTile {
  kind: 'PROPERTY';
  group: ColorGroup;
  price: number;
  /** Cost of one house; a hotel costs the same as the 5th house. */
  houseCost: number;
  /** Rent by development level: [0 houses, 1, 2, 3, 4, hotel]. */
  rent: readonly [number, number, number, number, number, number];
}

export interface RailroadTile extends BaseTile {
  kind: 'RAILROAD';
  price: number;
  /** Rent by number of railroads the owner holds: [1, 2, 3, 4]. */
  rent: readonly [number, number, number, number];
}

export interface UtilityTile extends BaseTile {
  kind: 'UTILITY';
  price: number;
  /**
   * Dice-total multiplier by number of utilities the owner holds: [1, 2].
   * Rent is `multiplier * diceTotal`, not a flat amount.
   */
  rentMultiplier: readonly [number, number];
}

export interface TaxTile extends BaseTile {
  kind: 'TAX';
  amount: number;
}

export interface ChanceTile extends BaseTile {
  kind: 'CHANCE';
}

export interface CommunityChestTile extends BaseTile {
  kind: 'COMMUNITY_CHEST';
}

export interface CornerTile extends BaseTile {
  kind: 'CORNER';
  corner: CornerKind;
}

/** Tiles a player can own. */
export type OwnableTile = PropertyTile | RailroadTile | UtilityTile;

export type Tile =
  | PropertyTile
  | RailroadTile
  | UtilityTile
  | TaxTile
  | ChanceTile
  | CommunityChestTile
  | CornerTile;

/* ------------------------------------------------------------------ *
 * Cards
 * ------------------------------------------------------------------ */

export type DeckName = 'CHANCE' | 'COMMUNITY_CHEST';

/** Advance to a fixed board position. */
export interface MoveToEffect {
  type: 'MOVE_TO';
  position: number;
  /** Collect the GO salary if the move wraps past GO. */
  collectGoSalary: boolean;
}

/** Move a number of tiles relative to the current position (may be negative). */
export interface MoveRelativeEffect {
  type: 'MOVE_RELATIVE';
  offset: number;
}

/**
 * Advance to the next tile of a kind, travelling forward only.
 * If owned, rent is charged at `rentMultiplier` times the normal rate
 * (Chance railroad cards charge double; utility cards charge 10x the roll).
 */
export interface MoveToNearestEffect {
  type: 'MOVE_TO_NEAREST';
  kind: 'RAILROAD' | 'UTILITY';
  collectGoSalary: boolean;
  rentMultiplier: number;
}

/** Receive money from the bank. */
export interface CollectEffect {
  type: 'COLLECT';
  amount: number;
}

/** Pay money to the bank. */
export interface PayEffect {
  type: 'PAY';
  amount: number;
}

/** Receive `amount` from every other solvent player. */
export interface CollectFromEachEffect {
  type: 'COLLECT_FROM_EACH';
  amount: number;
}

/** Pay `amount` to every other solvent player. */
export interface PayEachEffect {
  type: 'PAY_EACH';
  amount: number;
}

/** Go directly to jail without passing GO. */
export interface GoToJailEffect {
  type: 'GO_TO_JAIL';
}

/** Keep until used; leaves the deck until returned. */
export interface GetOutOfJailEffect {
  type: 'GET_OUT_OF_JAIL_FREE';
}

/** Pay per building owned across the whole board. */
export interface RepairsEffect {
  type: 'REPAIRS';
  perHouse: number;
  perHotel: number;
}

export type CardEffect =
  | MoveToEffect
  | MoveRelativeEffect
  | MoveToNearestEffect
  | CollectEffect
  | PayEffect
  | CollectFromEachEffect
  | PayEachEffect
  | GoToJailEffect
  | GetOutOfJailEffect
  | RepairsEffect;

export type CardEffectType = CardEffect['type'];

export interface Card {
  /** Stable identifier, unique within the deck. Safe to persist. */
  id: string;
  deck: DeckName;
  /** Text as printed on the card, shown to players verbatim. */
  text: string;
  effect: CardEffect;
  /**
   * True for cards a player holds rather than resolves immediately.
   * Held cards are removed from the deck until played or traded away.
   */
  retainable?: boolean;
}

/* ------------------------------------------------------------------ *
 * Runtime state
 * ------------------------------------------------------------------ */

export interface Player {
  id: string;
  name: string;
  position: number;
  cash: number;
  /** Board positions of the tiles this player owns. */
  properties: number[];
  inJail: boolean;
  /** How many turns the player has already spent in jail (0..3). */
  jailTurns: number;
  /**
   * Ids of retainable cards this player holds (Get Out of Jail Free).
   * Ids rather than a count: a held card is out of its deck until played or
   * traded away, and the id says which deck it must be returned to.
   */
  heldCards: string[];
  bankrupt: boolean;
}

export interface PropertyState {
  position: number;
  ownerId: string | null;
  /** Houses built, or HOTEL_LEVEL for a hotel. Always 0 for stations/utilities. */
  houses: number;
  mortgaged: boolean;
}

/**
 * The bank's building supply. Both pools are finite: when houses run out,
 * no more can be built until someone sells, and a player may not skip the
 * shortage by buying a hotel outright.
 */
export interface BankState {
  /** Houses left to sell, 0..HOUSE_SUPPLY. */
  houses: number;
  /** Hotels left to sell, 0..HOTEL_SUPPLY. */
  hotels: number;
}

/* ------------------------------------------------------------------ *
 * Pending decisions
 *
 * At most one decision blocks the game at a time. Any input that is not
 * the pending decision's answer is rejected, so the engine never has to
 * guess what an incoming action refers to.
 * ------------------------------------------------------------------ */

interface BasePending {
  /** Who must answer. Not always the player whose turn it is. */
  playerId: string;
}

/** Landed on an unowned ownable tile: buy at list price, or decline. */
export interface BuyPropertyPending extends BasePending {
  type: 'BUY_PROPERTY';
  position: number;
  price: number;
}

/** In jail at the start of a turn: pay the fine, play a card, or roll. */
export interface JailPending extends BasePending {
  type: 'JAIL_DECISION';
  fine: number;
  /** Set on the third turn in jail, when rolling is no longer an option. */
  mustPay: boolean;
}

/**
 * Owes more than the player holds: mortgage, sell buildings, or go bankrupt.
 * Held while the debt stands, so a player is never silently pushed negative.
 * When the creditor is a player, the debtor may instead propose a
 * SETTLEMENT_OFFER of part cash and part property.
 */
export interface RaiseFundsPending extends BasePending {
  type: 'RAISE_FUNDS';
  amount: number;
  /** Player owed the money, or null when the creditor is the bank. */
  creditorId: string | null;
}

/**
 * A declined purchase goes under the hammer. The rulebook makes this
 * mandatory, not optional, and lets the player who declined bid anyway.
 * Also used for the building shortage: when the Bank has fewer Houses
 * than players want, the Banker auctions those instead of a tile.
 */
export interface AuctionPending extends BasePending {
  type: 'AUCTION_BID';
  /** Tile under the hammer. */
  position: number;
  /** Highest bid so far; 0 before anyone has bid. */
  highestBid: number;
  /** Current leader, or null while the lot is unbid. */
  highestBidderId: string | null;
  /** Players still in, in bidding order. The lot sells at one remaining. */
  activeBidderIds: string[];
}

/** One direction of a private sale: what passes from a player. */
export interface TradeSide {
  cash: number;
  /** Board positions offered. A Site must be free of buildings to move. */
  positions: number[];
  /** Ids of Get Out of Jail Free cards offered. */
  cardIds: string[];
}

/**
 * A private sale between two players at any mutually agreed price. Only
 * players trade; the Bank never buys back property, and money may not be
 * lent between players, so both sides move at once or not at all.
 */
export interface TradeOfferPending extends BasePending {
  type: 'TRADE_OFFER';
  /** Who proposed it. `playerId` is whoever must accept or decline. */
  proposerId: string;
  /** Passes from the proposer to `playerId`. */
  offered: TradeSide;
  /** Passes from `playerId` back to the proposer. */
  requested: TradeSide;
}

/**
 * Mortgaged property has just changed hands. The new owner pays the 10%
 * fee on receipt and then chooses per tile: clear the mortgage in full
 * now, or keep it and pay the further 10% when it is finally lifted.
 */
/**
 * A debtor short of cash may offer the creditor part cash and part property
 * (empty Sites only). The creditor fixes the worth of that property by
 * accepting or declining, which is why this waits on them, not the debtor.
 * Only a player creditor can accept; a debt to the Bank is settled by
 * mortgaging, selling buildings, or bankruptcy.
 */
export interface SettlementOfferPending extends BasePending {
  type: 'SETTLEMENT_OFFER';
  /** Who owes. playerId is the creditor deciding. */
  debtorId: string;
  /** The debt this would discharge in full. */
  amount: number;
  /** Cash and property put up against it. */
  offered: TradeSide;
}

export interface MortgagedTransferPending extends BasePending {
  type: 'MORTGAGED_TRANSFER';
  /** Positions received still mortgaged, awaiting that choice. */
  positions: number[];
}

export type Pending =
  | BuyPropertyPending
  | AuctionPending
  | JailPending
  | RaiseFundsPending
  | TradeOfferPending
  | SettlementOfferPending
  | MortgagedTransferPending;

/**
 * The three games the rulebook describes. Not an extension point: these are
 * the only variants printed, and each differs in the fields below.
 */
export type GameVariant = 'STANDARD' | 'SHORT' | 'TIME_LIMIT';

export interface VariantRules {
  /** Houses needed on every Site of a group before a Hotel may be bought. */
  housesPerHotel: number;
  /** Title Deeds dealt at setup, each paid for at its printed price. */
  dealtDeeds: number;
  /**
   * How play stops.
   * LAST_SOLVENT: play until one player is left, who wins outright.
   * SECOND_BANKRUPTCY: stop at the second bankruptcy; richest wins.
   * DEADLINE: stop at an agreed time; richest wins.
   * The latter two are scored with netWorth().
   */
  endsOn: 'LAST_SOLVENT' | 'SECOND_BANKRUPTCY' | 'DEADLINE';
}

export type GamePhase = 'LOBBY' | 'IN_PROGRESS' | 'FINISHED';

export interface GameState {
  id: string;
  phase: GamePhase;
  /** Which rulebook game this is. Look its rules up in VARIANT_RULES. */
  variant: GameVariant;
  /** Epoch ms at which a DEADLINE game stops. Null for the other two. */
  endsAt: number | null;
  players: Player[];
  /** Index into `players` of whoever must act next. */
  currentPlayerIndex: number;
  /** Keyed by board position. Only ownable tiles appear here. */
  properties: Record<number, PropertyState>;
  /** Buildings the bank still has left to sell. */
  bank: BankState;
  /**
   * Draw order per deck: card ids, front of the array is top of the pile.
   * A resolved card returns to the back. A retainable card leaves the pile
   * entirely while held, and returns to the back when played or given up.
   */
  decks: Record<DeckName, string[]>;
  /** Consecutive doubles rolled by the current player this turn. */
  doublesCount: number;
  /** Set once the player has rolled; blocks a second roll in one turn. */
  hasRolled: boolean;
  /**
   * The decision play is blocked on, or null when the current player is
   * free to take a normal turn action.
   */
  pending: Pending | null;
  turnCount: number;
  winnerId: string | null;
  log: string[];
}

/** A dice roll. `isDouble` is derived but stored so the log can replay it. */
export interface DiceRoll {
  die1: number;
  die2: number;
  total: number;
  isDouble: boolean;
}

/** Injected so tests can supply deterministic rolls. */
export type DiceRoller = () => DiceRoll;
