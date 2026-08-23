import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gameApi } from "../api/gameApi";
import { boardData, purchasableSpaces } from "../data/boardData";
import { canTradeProperty } from "../game/gameRules";
import type {
  BackendCard,
  BackendGameState,
  BackendPending,
  BackendTradeSide,
} from "../types/backend";
import type {
  ActivityTone,
  GameCard,
  GamePhase,
  GameState,
  Player,
  PropertySpace,
  TradeOffer,
} from "../types/game";

const wait = (duration: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, duration));

const initialProperties = (): GameState["properties"] => Object.fromEntries(
  purchasableSpaces.map((space) => [space.id, {
    ownerId: null,
    houses: 0,
    hotel: false,
    mortgaged: false,
  }]),
);

const createInitialState = (players: Player[]): GameState => ({
  players,
  properties: initialProperties(),
  currentPlayerIndex: 0,
  phase: "RESOLVING_SPACE",
  dice: null,
  doublesCount: 0,
  rollAgain: false,
  activityLog: [{ id: "connecting", text: "Connecting to the backend game engine…", tone: "normal" }],
  propertyLedger: [],
  cardLedger: [],
  pendingSpaceId: null,
  selectedSpaceId: null,
  auction: null,
  trade: null,
  debt: null,
  winnerId: null,
  turnSeconds: 120,
});

const phaseFor = (
  backend: BackendGameState,
  localTrade: TradeOffer | null,
): GamePhase => {
  if (backend.phase === "FINISHED") return "GAME_OVER";
  if (localTrade) return "TRADING";
  switch (backend.pending?.type) {
    case "ROLL": return "WAITING_FOR_ROLL";
    case "BUY_PROPERTY": return "PROPERTY_DECISION";
    case "AUCTION_BID": return "AUCTION";
    case "JAIL_DECISION": return "JAIL_DECISION";
    case "RAISE_FUNDS": return "DEBT";
    case "TRADE_OFFER": return "TRADING";
    case "SETTLEMENT_OFFER":
    case "MORTGAGED_TRANSFER": return "DEBT";
    default: return backend.awaitingEndTurn ? "WAITING_FOR_END_TURN" : "RESOLVING_SPACE";
  }
};

const toneFor = (text: string): ActivityTone => {
  if (/bankrupt|Jail|owed/i.test(text)) return "danger";
  if (/trade|offer/i.test(text)) return "trade";
  if (/paid|bought|mortgag|built|sold|received|took/i.test(text)) return "money";
  if (/double|auction|card|wins|standing/i.test(text)) return "important";
  return "normal";
};

const pendingTrade = (pending: BackendPending | null): TradeOffer | null => {
  if (!pending || pending.type !== "TRADE_OFFER") return null;
  return {
    id: `backend-${pending.proposerId}-${pending.playerId}`,
    proposerId: pending.proposerId,
    recipientId: pending.playerId,
    offeredCash: pending.offered.cash,
    requestedCash: pending.requested.cash,
    offeredPropertyIds: pending.offered.positions,
    requestedPropertyIds: pending.requested.positions,
    offeredCards: pending.offered.cardIds.length,
    requestedCards: pending.requested.cardIds.length,
    status: "pending",
  };
};

const adaptBackendState = (
  backend: BackendGameState,
  colors: ReadonlyMap<string, string>,
  previous: GameState,
  localTrade: TradeOffer | null,
): GameState => {
  const properties: GameState["properties"] = {};
  for (const [position, holding] of Object.entries(backend.properties)) {
    properties[Number(position)] = {
      ownerId: holding.ownerId,
      houses: holding.houses === 5 ? 0 : holding.houses,
      hotel: holding.houses === 5,
      mortgaged: holding.mortgaged,
    };
  }
  const players: Player[] = backend.players.map((player) => ({
    id: player.id,
    name: player.name,
    color: colors.get(player.id) ?? "#7C4DFF",
    money: player.cash,
    position: player.position,
    inJail: player.inJail,
    jailTurns: player.jailTurns,
    getOutOfJailCards: player.heldCards.length,
    bankrupt: player.bankrupt,
  }));
  const currentId = players[backend.currentPlayerIndex]?.id;
  const previousCurrentId = previous.players[previous.currentPlayerIndex]?.id;
  const pending = backend.pending;
  const auction = pending?.type === "AUCTION_BID" ? {
    spaceId: pending.position,
    activeBidderId: pending.playerId,
    passedIds: players.filter((player) => !pending.activeBidderIds.includes(player.id)).map((player) => player.id),
    currentBid: pending.highestBid,
    highestBidderId: pending.highestBidderId,
  } : null;
  const trade = localTrade ?? pendingTrade(pending);

  return {
    players,
    properties,
    currentPlayerIndex: backend.currentPlayerIndex,
    phase: phaseFor(backend, localTrade),
    dice: backend.lastDice ? [backend.lastDice.die1, backend.lastDice.die2] : null,
    doublesCount: backend.doublesCount,
    rollAgain: pending?.type === "ROLL" && pending.doublesSoFar > 0,
    activityLog: [...backend.log].reverse().map((text, reverseIndex) => {
      const originalIndex = backend.log.length - reverseIndex - 1;
      const player = players.find((candidate) => text.includes(candidate.name));
      return { id: `backend-log-${originalIndex}`, text, playerId: player?.id, tone: toneFor(text) };
    }),
    propertyLedger: backend.propertyTransfers.map((record) => ({
      id: record.id,
      sequence: record.sequence,
      spaceId: record.position,
      fromPlayerId: record.fromPlayerId,
      toPlayerId: record.toPlayerId,
      amount: record.amount,
      method: record.method.toLowerCase().replace("_", "-") as GameState["propertyLedger"][number]["method"],
    })),
    cardLedger: backend.cardTransactions.map((record) => ({
      id: record.id,
      sequence: record.sequence,
      cardId: record.cardId,
      deck: record.deck === "CHANCE" ? "surprise" : "treasure",
      title: record.title,
      text: record.text,
      effectType: record.effectType,
      playerId: record.playerId,
      positionBefore: record.positionBefore,
      positionAfter: record.positionAfter,
      inJailBefore: record.inJailBefore,
      inJailAfter: record.inJailAfter,
      retainedByPlayer: record.retainedByPlayer,
      cashChanges: record.cashChanges,
      propertyTransferIds: record.propertyTransferIds,
      completed: record.completed,
    })),
    pendingSpaceId: pending?.type === "BUY_PROPERTY" ? pending.position : null,
    selectedSpaceId: previous.selectedSpaceId,
    auction,
    trade,
    debt: pending?.type === "RAISE_FUNDS" ? {
      amount: pending.amount,
      creditorId: pending.creditorId,
      reason: "outstanding backend debt",
    } : null,
    winnerId: backend.winnerId,
    turnSeconds: currentId === previousCurrentId ? previous.turnSeconds : 120,
  };
};

const cardForUi = (card: BackendCard): GameCard => {
  const base = {
    id: card.id,
    deck: card.deck === "CHANCE" ? "surprise" as const : "treasure" as const,
    title: card.title,
    text: card.text,
  };
  if (card.effect.type === "GO_TO_JAIL") return { ...base, type: "jail" };
  if (card.effect.type === "GET_OUT_OF_JAIL_FREE") return { ...base, type: "getOutOfJail" };
  if (card.effect.type.startsWith("MOVE")) {
    return { ...base, type: "move", target: card.effect.position ?? 0 };
  }
  const sign = card.effect.type.startsWith("PAY") ? -1 : 1;
  return { ...base, type: "money", amount: sign * (card.effect.amount ?? 0) };
};

export const useGameState = (initialPlayers: Player[]) => {
  const [state, setState] = useState<GameState>(() => createInitialState(initialPlayers));
  const [drawnCard, setDrawnCard] = useState<GameCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const backendRef = useRef<BackendGameState | null>(null);
  const localTradeRef = useRef<TradeOffer | null>(null);
  const observedCardRef = useRef<string | null>(null);
  const createRequestRef = useRef<Promise<{ state: BackendGameState }> | null>(null);
  const colors = useMemo(
    () => new Map(initialPlayers.map((player) => [player.id, player.color])),
    [initialPlayers],
  );

  const applyBackend = useCallback((backend: BackendGameState) => {
    backendRef.current = backend;
    setState((previous) => adaptBackendState(backend, colors, previous, localTradeRef.current));
    if (!backend.lastCard) {
      observedCardRef.current = null;
    } else if (observedCardRef.current !== backend.lastCard.id) {
      observedCardRef.current = backend.lastCard.id;
      setDrawnCard(cardForUi(backend.lastCard));
    }
  }, [colors]);

  useEffect(() => {
    let active = true;
    createRequestRef.current ??= gameApi.create(initialPlayers.map(({ id, name }) => ({ id, name })));
    void createRequestRef.current.then((snapshot) => {
      if (active) applyBackend(snapshot.state);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "Could not create the backend game");
    });
    return () => { active = false; };
  }, [applyBackend, initialPlayers]);

  const request = useCallback(async (
    operation: (backend: BackendGameState) => Promise<{ state: BackendGameState }>,
    animateDice = false,
  ) => {
    const backend = backendRef.current;
    if (!backend) {
      setError("The backend game is still initializing.");
      return;
    }
    setError(null);
    try {
      if (animateDice) setState((previous) => ({ ...previous, phase: "ROLLING" }));
      const snapshot = await operation(backend);
      backendRef.current = snapshot.state;
      if (animateDice) {
        const dice = snapshot.state.lastDice;
        setState((previous) => ({
          ...previous,
          dice: dice ? [dice.die1, dice.die2] : previous.dice,
          phase: "ROLLING",
        }));
        await wait(1120);
      }
      applyBackend(snapshot.state);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The backend rejected that action");
      if (backendRef.current) applyBackend(backendRef.current);
    }
  }, [applyBackend]);

  const submitDecision = useCallback((decision: object, animateDice = false) => {
    void request((backend) => {
      const playerId = backend.pending?.playerId;
      if (!playerId) return Promise.reject(new Error("The backend is not waiting for a decision"));
      return gameApi.decision(backend.id, playerId, decision);
    }, animateDice);
  }, [request]);

  const rollDice = useCallback(() => submitDecision({ type: "ROLL" }, true), [submitDecision]);
  const buyPendingProperty = useCallback(() => submitDecision({ type: "BUY_PROPERTY", buy: true }), [submitDecision]);
  const startAuction = useCallback(() => submitDecision({ type: "BUY_PROPERTY", buy: false }), [submitDecision]);
  const auctionBid = useCallback((increment: number) => {
    const pending = backendRef.current?.pending;
    if (pending?.type !== "AUCTION_BID") return;
    submitDecision({ type: "AUCTION_BID", bid: pending.highestBid + increment });
  }, [submitDecision]);
  const auctionPass = useCallback(() => submitDecision({ type: "AUCTION_BID", bid: null }), [submitDecision]);

  const endTurn = useCallback(() => {
    void request((backend) => {
      const player = backend.players[backend.currentPlayerIndex];
      if (!player) return Promise.reject(new Error("The backend has no current player"));
      return gameApi.endTurn(backend.id, player.id);
    });
  }, [request]);

  const jailPay = useCallback(() => submitDecision({ type: "JAIL_DECISION", action: "PAY" }, true), [submitDecision]);
  const jailUseCard = useCallback(() => submitDecision({ type: "JAIL_DECISION", action: "CARD" }, true), [submitDecision]);
  const jailRoll = useCallback(() => submitDecision({ type: "JAIL_DECISION", action: "ROLL" }, true), [submitDecision]);

  const openTrade = useCallback((existing?: TradeOffer) => {
    const backend = backendRef.current;
    if (!backend) return;
    const proposer = backend.players[backend.currentPlayerIndex];
    const recipient = backend.players.find((player) => !player.bankrupt && player.id !== proposer?.id);
    if (!proposer || !recipient) return;
    localTradeRef.current = existing ?? {
      id: `${Date.now()}`,
      proposerId: proposer.id,
      recipientId: recipient.id,
      offeredCash: 0,
      requestedCash: 0,
      offeredPropertyIds: [],
      requestedPropertyIds: [],
      offeredCards: 0,
      requestedCards: 0,
      status: "editing",
    };
    applyBackend(backend);
  }, [applyBackend]);

  const updateTrade = useCallback((trade: TradeOffer) => {
    localTradeRef.current = trade;
    const backend = backendRef.current;
    if (backend) applyBackend(backend);
  }, [applyBackend]);

  const sideFor = useCallback((playerId: string, cash: number, positions: number[], cardCount: number): BackendTradeSide => {
    const player = backendRef.current?.players.find((candidate) => candidate.id === playerId);
    return { cash, positions, cardIds: player?.heldCards.slice(0, cardCount) ?? [] };
  }, []);

  const sendTrade = useCallback(() => {
    const trade = localTradeRef.current;
    if (!trade) return;
    localTradeRef.current = null;
    void request((backend) => gameApi.action(backend.id, { type: "PROPOSE_TRADE", playerId: trade.proposerId, recipientId: trade.recipientId, offered: sideFor(trade.proposerId, trade.offeredCash, trade.offeredPropertyIds, trade.offeredCards), requested: sideFor(trade.recipientId, trade.requestedCash, trade.requestedPropertyIds, trade.requestedCards) }));
  }, [request, sideFor]);

  const acceptTrade = useCallback(() => {
    const pending = backendRef.current?.pending;
    if (pending?.type !== "TRADE_OFFER") return;
    void request((backend) => gameApi.action(backend.id, { type: "ACCEPT_TRADE", playerId: pending.playerId }));
  }, [request]);

  const declineTrade = useCallback(() => {
    const pending = backendRef.current?.pending;
    if (pending?.type !== "TRADE_OFFER") return;
    void request((backend) => gameApi.action(backend.id, { type: "DECLINE_TRADE", playerId: pending.playerId }));
  }, [request]);

  const negotiateTrade = useCallback(() => {
    const pending = backendRef.current?.pending;
    if (pending?.type !== "TRADE_OFFER") return;
    const counter: TradeOffer = {
      id: "counter",
      proposerId: pending.playerId,
      recipientId: pending.proposerId,
      offeredCash: pending.requested.cash,
      requestedCash: pending.offered.cash,
      offeredPropertyIds: pending.requested.positions,
      requestedPropertyIds: pending.offered.positions,
      offeredCards: pending.requested.cardIds.length,
      requestedCards: pending.offered.cardIds.length,
      status: "editing",
    };
    void request(async (backend) => {
      const snapshot = await gameApi.action(backend.id, { type: "DECLINE_TRADE", playerId: pending.playerId });
      localTradeRef.current = counter;
      return snapshot;
    });
  }, [request]);

  const propertyAction = useCallback((action: "build" | "sell" | "mortgage" | "unmortgage", space: PropertySpace) => {
    const backend = backendRef.current;
    const player = backend?.players[backend.currentPlayerIndex];
    if (!backend || !player) return;
    const type = ({ build: "BUILD", sell: "SELL_BUILDING", mortgage: "MORTGAGE", unmortgage: "UNMORTGAGE" } as const)[action];
    void request((current) => gameApi.action(current.id, { type, playerId: player.id, position: space.id }));
  }, [request]);

  const bankrupt = useCallback(() => {
    const backend = backendRef.current;
    const player = backend?.players[backend.currentPlayerIndex];
    if (!backend || !player) return;
    if (backend.pending?.type === "RAISE_FUNDS" && backend.pending.playerId === player.id) {
      submitDecision({ type: "RAISE_FUNDS", action: "BANKRUPT" });
      return;
    }
    void request((current) => gameApi.action(current.id, { type: "BANKRUPT", playerId: player.id }));
  }, [request, submitDecision]);

  const closeTrade = useCallback(() => {
    if (localTradeRef.current) {
      localTradeRef.current = null;
      const backend = backendRef.current;
      if (backend) applyBackend(backend);
      return;
    }
    declineTrade();
  }, [applyBackend, declineTrade]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setState((previous) => ({ ...previous, turnSeconds: Math.max(0, previous.turnSeconds - 1) }));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const tradeableProperties = useMemo(() => boardData.filter((space): space is PropertySpace =>
    space.type === "property" && canTradeProperty(state, space)), [state]);
  const currentPlayer = state.players[state.currentPlayerIndex] ?? state.players[0]!;

  return {
    state,
    currentPlayer,
    drawnCard,
    error,
    rollDice,
    buyPendingProperty,
    startAuction,
    auctionBid,
    auctionPass,
    endTurn,
    handleCard: () => setDrawnCard(null),
    jailPay,
    jailUseCard,
    jailRoll,
    openTrade,
    updateTrade,
    sendTrade,
    acceptTrade,
    declineTrade,
    negotiateTrade,
    propertyAction,
    settleDebt: () => setError("Debt resolution is controlled by the backend engine."),
    bankrupt,
    selectSpace: (spaceId: number | null) => setState((previous) => ({ ...previous, selectedSpaceId: spaceId })),
    closeTrade,
    addTime: () => setState((previous) => ({ ...previous, turnSeconds: previous.turnSeconds + 60 })),
    tradeableProperties,
  };
};
