export type PropertyKind = "site" | "station" | "utility";

export type RentTable = {
  base: number;
  monopoly: number;
  house1: number;
  house2: number;
  house3: number;
  house4: number;
  hotel: number;
};

type BaseSpace = {
  id: number;
  name: string;
  shortName?: string;
  icon?: string;
};

export type PropertySpace = BaseSpace & {
  type: "property";
  propertyKind: PropertyKind;
  state?: string;
  group?: string;
  groupColor: string;
  price: number;
  mortgageValue: number;
  houseCost?: number;
  rent?: RentTable;
};

export type ActionSpace = BaseSpace & {
  type: "start" | "treasure" | "surprise" | "tax" | "jail" | "vacation" | "goToJail";
  amount?: number;
};

export type BoardSpace = PropertySpace | ActionSpace;

export type PropertyStatus = {
  readonly ownerId: string | null;
  houses: number;
  hotel: boolean;
  mortgaged: boolean;
};

export type Player = {
  id: string;
  name: string;
  color: string;
  money: number;
  position: number;
  inJail: boolean;
  jailTurns: number;
  getOutOfJailCards: number;
  bankrupt: boolean;
};

export type ActivityTone = "normal" | "money" | "important" | "danger" | "trade";

export type ActivityEntry = {
  id: string;
  playerId?: string;
  text: string;
  tone: ActivityTone;
};

export type GamePhase =
  | "WAITING_FOR_ROLL"
  | "ROLLING"
  | "MOVING"
  | "RESOLVING_SPACE"
  | "PROPERTY_DECISION"
  | "AUCTION"
  | "TRADING"
  | "JAIL_DECISION"
  | "DEBT"
  | "WAITING_FOR_END_TURN"
  | "GAME_OVER";

export type Debt = {
  amount: number;
  creditorId: string | null;
  reason: string;
};

export type AuctionState = {
  spaceId: number;
  activeBidderId: string;
  passedIds: string[];
  currentBid: number;
  highestBidderId: string | null;
};

export type TradeOffer = {
  id: string;
  proposerId: string;
  recipientId: string;
  offeredCash: number;
  requestedCash: number;
  offeredPropertyIds: number[];
  requestedPropertyIds: number[];
  offeredCards: number;
  requestedCards: number;
  status: "editing" | "pending";
};

export type PropertyTransferRecord = {
  id: string;
  sequence: number;
  spaceId: number;
  fromPlayerId: string | null;
  toPlayerId: string | null;
  amount: number | null;
  method: "bank-purchase" | "auction" | "trade" | "bankruptcy";
};

export type GameState = {
  players: Player[];
  properties: Record<number, PropertyStatus>;
  currentPlayerIndex: number;
  phase: GamePhase;
  dice: [number, number];
  doublesCount: number;
  rollAgain: boolean;
  activityLog: ActivityEntry[];
  propertyLedger: PropertyTransferRecord[];
  pendingSpaceId: number | null;
  selectedSpaceId: number | null;
  auction: AuctionState | null;
  trade: TradeOffer | null;
  debt: Debt | null;
  winnerId: string | null;
  turnSeconds: number;
};

export type InitializationRoll = {
  playerId: string;
  dice: [number, number];
  total: number;
};

export type GameCard =
  | { id: string; deck: "treasure" | "surprise"; type: "money"; title: string; text: string; amount: number }
  | { id: string; deck: "treasure" | "surprise"; type: "move"; title: string; text: string; target: number }
  | { id: string; deck: "treasure" | "surprise"; type: "jail"; title: string; text: string }
  | { id: string; deck: "treasure" | "surprise"; type: "getOutOfJail"; title: string; text: string };
