import { boardData } from "../data/boardData";
import type { ActivityEntry, AuctionState, Debt, GamePhase, GameState, Player, TradeOffer } from "../types/game";
import { getNextActivePlayerIndex, getPropertyStatusSeed } from "./gameRules";

export type GameAction =
  | { type: "SET_PHASE"; phase: GamePhase }
  | { type: "SET_DICE"; dice: [number, number] }
  | { type: "SET_ROLL_RESULT"; dice: [number, number]; doublesCount: number; rollAgain: boolean }
  | { type: "MOVE_STEP"; playerId: string; position: number; collectStart: boolean }
  | { type: "MOVE_DIRECT"; playerId: string; position: number; collectStart: boolean }
  | { type: "ADD_LOG"; entry: ActivityEntry }
  | { type: "SET_PENDING_SPACE"; spaceId: number | null }
  | { type: "SELECT_SPACE"; spaceId: number | null }
  | { type: "BUY_PROPERTY"; playerId: string; spaceId: number; price: number }
  | { type: "TRANSFER_MONEY"; fromId: string; toId: string | null; amount: number }
  | { type: "ADJUST_MONEY"; playerId: string; amount: number }
  | { type: "SET_DEBT"; debt: Debt | null }
  | { type: "START_AUCTION"; auction: AuctionState }
  | { type: "UPDATE_AUCTION"; auction: AuctionState }
  | { type: "RESOLVE_AUCTION"; winnerId: string | null; spaceId: number; amount: number }
  | { type: "SET_TRADE"; trade: TradeOffer | null }
  | { type: "ACCEPT_TRADE"; trade: TradeOffer }
  | { type: "BUILD_HOUSE"; playerId: string; spaceId: number; cost: number }
  | { type: "BUILD_HOTEL"; playerId: string; spaceId: number; cost: number }
  | { type: "SELL_BUILDING"; playerId: string; spaceId: number; refund: number }
  | { type: "MORTGAGE"; playerId: string; spaceId: number; value: number }
  | { type: "UNMORTGAGE"; playerId: string; spaceId: number; cost: number }
  | { type: "SEND_TO_JAIL"; playerId: string }
  | { type: "RELEASE_FROM_JAIL"; playerId: string; payFine: boolean; useCard: boolean }
  | { type: "FAIL_JAIL_ROLL"; playerId: string }
  | { type: "GRANT_JAIL_CARD"; playerId: string }
  | { type: "END_TURN" }
  | { type: "BANKRUPT"; playerId: string; creditorId: string | null }
  | { type: "TICK_TIMER" }
  | { type: "ADD_TIME" }
  | { type: "RESET_GAME"; players: Player[] };

const updatePlayer = (players: Player[], playerId: string, update: (player: Player) => Player): Player[] =>
  players.map((player) => player.id === playerId ? update(player) : player);

export const createInitialGameState = (players: Player[]): GameState => ({
  players,
  properties: getPropertyStatusSeed(),
  currentPlayerIndex: 0,
  phase: players[0]?.inJail ? "JAIL_DECISION" : "WAITING_FOR_ROLL",
  dice: [1, 1],
  doublesCount: 0,
  rollAgain: false,
  activityLog: [{ id: "welcome", text: `${players[0]?.name ?? "Player"} goes first. Let the journey begin!`, tone: "important" }],
  pendingSpaceId: null,
  selectedSpaceId: null,
  auction: null,
  trade: null,
  debt: null,
  winnerId: null,
  turnSeconds: 120,
});

export const gameReducer = (state: GameState, action: GameAction): GameState => {
  switch (action.type) {
    case "SET_PHASE":
      return { ...state, phase: action.phase };
    case "SET_DICE":
      return { ...state, dice: action.dice };
    case "SET_ROLL_RESULT":
      return { ...state, dice: action.dice, doublesCount: action.doublesCount, rollAgain: action.rollAgain };
    case "MOVE_STEP":
    case "MOVE_DIRECT":
      return {
        ...state,
        players: updatePlayer(state.players, action.playerId, (player) => ({
          ...player,
          position: action.position,
          money: player.money + (action.collectStart ? 200 : 0),
        })),
      };
    case "ADD_LOG":
      return { ...state, activityLog: [action.entry, ...state.activityLog].slice(0, 80) };
    case "SET_PENDING_SPACE":
      return { ...state, pendingSpaceId: action.spaceId };
    case "SELECT_SPACE":
      return { ...state, selectedSpaceId: action.spaceId };
    case "BUY_PROPERTY":
      return {
        ...state,
        players: updatePlayer(state.players, action.playerId, (player) => ({ ...player, money: player.money - action.price })),
        properties: { ...state.properties, [action.spaceId]: { ...state.properties[action.spaceId], ownerId: action.playerId } },
        pendingSpaceId: null,
      };
    case "TRANSFER_MONEY":
      return {
        ...state,
        players: state.players.map((player) => {
          if (player.id === action.fromId) return { ...player, money: Math.max(0, player.money - action.amount) };
          if (action.toId && player.id === action.toId) return { ...player, money: player.money + action.amount };
          return player;
        }),
      };
    case "ADJUST_MONEY":
      return { ...state, players: updatePlayer(state.players, action.playerId, (player) => ({ ...player, money: player.money + action.amount })) };
    case "SET_DEBT":
      return { ...state, debt: action.debt, phase: action.debt ? "DEBT" : state.phase };
    case "START_AUCTION":
      return { ...state, auction: action.auction, phase: "AUCTION", pendingSpaceId: null };
    case "UPDATE_AUCTION":
      return { ...state, auction: action.auction };
    case "RESOLVE_AUCTION": {
      if (!action.winnerId) return { ...state, auction: null };
      return {
        ...state,
        auction: null,
        players: updatePlayer(state.players, action.winnerId, (player) => ({ ...player, money: player.money - action.amount })),
        properties: { ...state.properties, [action.spaceId]: { ...state.properties[action.spaceId], ownerId: action.winnerId } },
      };
    }
    case "SET_TRADE":
      return { ...state, trade: action.trade, phase: action.trade ? "TRADING" : state.phase };
    case "ACCEPT_TRADE": {
      const trade = action.trade;
      const offered = new Set(trade.offeredPropertyIds);
      const requested = new Set(trade.requestedPropertyIds);
      const properties = Object.fromEntries(Object.entries(state.properties).map(([id, status]) => {
        const numericId = Number(id);
        if (offered.has(numericId)) return [numericId, { ...status, ownerId: trade.recipientId }];
        if (requested.has(numericId)) return [numericId, { ...status, ownerId: trade.proposerId }];
        return [numericId, status];
      }));
      return {
        ...state,
        trade: null,
        properties,
        players: state.players.map((player) => {
          if (player.id === trade.proposerId) return {
            ...player,
            money: player.money - trade.offeredCash + trade.requestedCash,
            getOutOfJailCards: player.getOutOfJailCards - trade.offeredCards + trade.requestedCards,
          };
          if (player.id === trade.recipientId) return {
            ...player,
            money: player.money + trade.offeredCash - trade.requestedCash,
            getOutOfJailCards: player.getOutOfJailCards + trade.offeredCards - trade.requestedCards,
          };
          return player;
        }),
      };
    }
    case "BUILD_HOUSE":
      return {
        ...state,
        players: updatePlayer(state.players, action.playerId, (player) => ({ ...player, money: player.money - action.cost })),
        properties: { ...state.properties, [action.spaceId]: { ...state.properties[action.spaceId], houses: state.properties[action.spaceId].houses + 1 } },
      };
    case "BUILD_HOTEL":
      return {
        ...state,
        players: updatePlayer(state.players, action.playerId, (player) => ({ ...player, money: player.money - action.cost })),
        properties: { ...state.properties, [action.spaceId]: { ...state.properties[action.spaceId], houses: 0, hotel: true } },
      };
    case "SELL_BUILDING": {
      const status = state.properties[action.spaceId];
      return {
        ...state,
        players: updatePlayer(state.players, action.playerId, (player) => ({ ...player, money: player.money + action.refund })),
        properties: {
          ...state.properties,
          [action.spaceId]: status.hotel ? { ...status, hotel: false, houses: 4 } : { ...status, houses: Math.max(0, status.houses - 1) },
        },
      };
    }
    case "MORTGAGE":
      return {
        ...state,
        players: updatePlayer(state.players, action.playerId, (player) => ({ ...player, money: player.money + action.value })),
        properties: { ...state.properties, [action.spaceId]: { ...state.properties[action.spaceId], mortgaged: true } },
      };
    case "UNMORTGAGE":
      return {
        ...state,
        players: updatePlayer(state.players, action.playerId, (player) => ({ ...player, money: player.money - action.cost })),
        properties: { ...state.properties, [action.spaceId]: { ...state.properties[action.spaceId], mortgaged: false } },
      };
    case "SEND_TO_JAIL":
      return {
        ...state,
        players: updatePlayer(state.players, action.playerId, (player) => ({ ...player, position: 10, inJail: true, jailTurns: 0 })),
        doublesCount: 0,
        rollAgain: false,
        pendingSpaceId: null,
        phase: "WAITING_FOR_END_TURN",
      };
    case "RELEASE_FROM_JAIL":
      return {
        ...state,
        players: updatePlayer(state.players, action.playerId, (player) => ({
          ...player,
          inJail: false,
          jailTurns: 0,
          money: player.money - (action.payFine ? 50 : 0),
          getOutOfJailCards: player.getOutOfJailCards - (action.useCard ? 1 : 0),
        })),
        phase: "WAITING_FOR_ROLL",
      };
    case "FAIL_JAIL_ROLL":
      return {
        ...state,
        players: updatePlayer(state.players, action.playerId, (player) => ({ ...player, jailTurns: player.jailTurns + 1 })),
        phase: "WAITING_FOR_END_TURN",
      };
    case "GRANT_JAIL_CARD":
      return { ...state, players: updatePlayer(state.players, action.playerId, (player) => ({ ...player, getOutOfJailCards: player.getOutOfJailCards + 1 })) };
    case "END_TURN": {
      const nextIndex = getNextActivePlayerIndex(state.players, state.currentPlayerIndex);
      return {
        ...state,
        currentPlayerIndex: nextIndex,
        phase: state.players[nextIndex].inJail ? "JAIL_DECISION" : "WAITING_FOR_ROLL",
        doublesCount: 0,
        rollAgain: false,
        pendingSpaceId: null,
        selectedSpaceId: null,
        debt: null,
        turnSeconds: 120,
      };
    }
    case "BANKRUPT": {
      const bankruptPlayer = state.players.find((player) => player.id === action.playerId);
      const buildingRefund = Object.entries(state.properties).reduce((sum, [id, status]) => {
        if (status.ownerId !== action.playerId) return sum;
        const space = boardData[Number(id)];
        if (space.type !== "property") return sum;
        return sum + (status.houses + (status.hotel ? 5 : 0)) * (space.houseCost ?? 0) * 0.5;
      }, 0);
      const transferredCash = (bankruptPlayer?.money ?? 0) + buildingRefund;
      const players = state.players.map((player) => {
        if (player.id === action.playerId) return { ...player, money: 0, bankrupt: true, getOutOfJailCards: 0 };
        if (action.creditorId && player.id === action.creditorId) return {
          ...player,
          money: player.money + transferredCash,
          getOutOfJailCards: player.getOutOfJailCards + (bankruptPlayer?.getOutOfJailCards ?? 0),
        };
        return player;
      });
      const properties = Object.fromEntries(Object.entries(state.properties).map(([id, status]) => [Number(id), status.ownerId === action.playerId ? {
        ...status,
        ownerId: action.creditorId,
        houses: 0,
        hotel: false,
      } : status]));
      const activePlayers = players.filter((player) => !player.bankrupt);
      const gameOver = activePlayers.length === 1;
      return {
        ...state,
        players,
        properties,
        debt: null,
        selectedSpaceId: null,
        winnerId: gameOver ? activePlayers[0].id : null,
        phase: gameOver ? "GAME_OVER" : "WAITING_FOR_END_TURN",
      };
    }
    case "TICK_TIMER":
      return { ...state, turnSeconds: Math.max(0, state.turnSeconds - 1) };
    case "ADD_TIME":
      return { ...state, turnSeconds: state.turnSeconds + 60 };
    case "RESET_GAME":
      return createInitialGameState(action.players);
    default:
      return state;
  }
};
