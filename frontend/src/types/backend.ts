export type BackendDice = {
  die1: number;
  die2: number;
  total: number;
  isDouble: boolean;
};

export type BackendPlayer = {
  id: string;
  name: string;
  position: number;
  cash: number;
  properties: number[];
  inJail: boolean;
  jailTurns: number;
  heldCards: string[];
  bankrupt: boolean;
};

export type BackendTradeSide = {
  cash: number;
  positions: number[];
  cardIds: string[];
};

export type BackendPending =
  | { type: "ROLL"; playerId: string; doublesSoFar: number }
  | { type: "BUY_PROPERTY"; playerId: string; position: number; price: number }
  | { type: "JAIL_DECISION"; playerId: string; fine: number; mustPay: boolean }
  | { type: "RAISE_FUNDS"; playerId: string; amount: number; creditorId: string | null }
  | {
      type: "AUCTION_BID";
      playerId: string;
      position: number;
      highestBid: number;
      highestBidderId: string | null;
      activeBidderIds: string[];
    }
  | {
      type: "TRADE_OFFER";
      playerId: string;
      proposerId: string;
      offered: BackendTradeSide;
      requested: BackendTradeSide;
    }
  | { type: "SETTLEMENT_OFFER"; playerId: string; debtorId: string; amount: number; offered: BackendTradeSide }
  | { type: "MORTGAGED_TRANSFER"; playerId: string; positions: number[] };

export type BackendCard = {
  id: string;
  deck: "CHANCE" | "COMMUNITY_CHEST";
  title: string;
  text: string;
  effect: {
    type: string;
    amount?: number;
    position?: number;
    offset?: number;
  };
};

export type BackendCardTransaction = {
  id: string;
  sequence: number;
  cardId: string;
  deck: "CHANCE" | "COMMUNITY_CHEST";
  title: string;
  text: string;
  effectType: string;
  playerId: string;
  positionBefore: number;
  positionAfter: number;
  inJailBefore: boolean;
  inJailAfter: boolean;
  retainedByPlayer: boolean;
  cashChanges: Array<{ playerId: string; before: number; after: number; delta: number }>;
  propertyTransferSequenceStart: number;
  propertyTransferIds: string[];
  completed: boolean;
};

export type BackendGameState = {
  id: string;
  phase: "LOBBY" | "IN_PROGRESS" | "FINISHED";
  players: BackendPlayer[];
  currentPlayerIndex: number;
  properties: Record<string, { position: number; ownerId: string | null; houses: number; mortgaged: boolean }>;
  doublesCount: number;
  pending: BackendPending | null;
  lastDice: BackendDice | null;
  lastCard: BackendCard | null;
  awaitingEndTurn: boolean;
  propertyTransfers: Array<{
    id: string;
    sequence: number;
    position: number;
    fromPlayerId: string | null;
    toPlayerId: string | null;
    amount: number | null;
    method: "BANK_PURCHASE" | "AUCTION" | "TRADE" | "BANKRUPTCY";
  }>;
  cardTransactions: BackendCardTransaction[];
  winnerId: string | null;
  log: string[];
};

export type BackendSnapshot = { state: BackendGameState };

export type BackendOrderResult = {
  orderedPlayerIds: string[];
  rounds: Array<{
    round: number;
    rolls: Array<{ playerId: string; dice: BackendDice }>;
  }>;
};
