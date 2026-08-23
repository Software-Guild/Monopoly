import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { boardData, getSpace } from "../data/boardData";
import { drawCard } from "../data/cardData";
import { createInitialGameState, gameReducer } from "../game/gameReducer";
import {
  calculateRent,
  canBuild,
  canBuildHotel,
  canMortgage,
  canSellBuilding,
  canTradeProperty,
  formatMoney,
} from "../game/gameRules";
import type { ActivityTone, GameCard, Player, PropertySpace, TradeOffer } from "../types/game";

const wait = (duration: number): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, duration));
const rollDie = (): number => Math.floor(Math.random() * 6) + 1;

export const useGameState = (initialPlayers: Player[]) => {
  const [state, dispatch] = useReducer(gameReducer, initialPlayers, createInitialGameState);
  const [drawnCard, setDrawnCard] = useState<GameCard | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const currentPlayer = state.players[state.currentPlayerIndex];

  const log = useCallback((text: string, playerId?: string, tone: ActivityTone = "normal") => {
    dispatch({ type: "ADD_LOG", entry: { id: `${Date.now()}-${Math.random()}`, text, playerId, tone } });
  }, []);

  const finishResolution = useCallback(() => {
    const latest = stateRef.current;
    dispatch({ type: "SET_PHASE", phase: latest.rollAgain ? "WAITING_FOR_ROLL" : "WAITING_FOR_END_TURN" });
  }, []);

  const createDebtOrPay = useCallback((playerId: string, amount: number, creditorId: string | null, reason: string) => {
    const latest = stateRef.current;
    const payer = latest.players.find((player) => player.id === playerId);
    if (!payer) return false;
    if (payer.money >= amount) {
      dispatch({ type: "TRANSFER_MONEY", fromId: playerId, toId: creditorId, amount });
      return true;
    }
    dispatch({ type: "SET_DEBT", debt: { amount, creditorId, reason } });
    return false;
  }, []);

  const resolveSpace = useCallback(async (spaceId: number, diceTotal: number) => {
    dispatch({ type: "SET_PHASE", phase: "RESOLVING_SPACE" });
    dispatch({ type: "SET_PENDING_SPACE", spaceId });
    const latest = stateRef.current;
    const player = latest.players[latest.currentPlayerIndex];
    const space = getSpace(spaceId);
    log(`${player.name} landed on ${space.name}.`, player.id);

    if (space.type === "property") {
      const status = latest.properties[space.id];
      if (!status.ownerId) {
        dispatch({ type: "SET_PHASE", phase: "PROPERTY_DECISION" });
        return;
      }
      if (status.ownerId === player.id || status.mortgaged) {
        if (status.mortgaged) log(`${space.name} is mortgaged. No rent is due.`, player.id);
        finishResolution();
        return;
      }
      const rent = calculateRent(latest, space, diceTotal);
      const owner = latest.players.find((candidate) => candidate.id === status.ownerId);
      if (createDebtOrPay(player.id, rent, status.ownerId, `rent for ${space.name}`)) {
        log(`${player.name} paid ${formatMoney(rent)} rent to ${owner?.name ?? "the owner"} for ${space.name}.`, player.id, "money");
        finishResolution();
      }
      return;
    }

    if (space.type === "tax") {
      const amount = space.amount ?? 0;
      if (createDebtOrPay(player.id, amount, null, space.name)) {
        log(`${player.name} paid ${formatMoney(amount)} ${space.name}.`, player.id, "money");
        finishResolution();
      }
      return;
    }

    if (space.type === "surprise" || space.type === "treasure") {
      setDrawnCard(drawCard(space.type));
      return;
    }

    if (space.type === "goToJail") {
      dispatch({ type: "SEND_TO_JAIL", playerId: player.id });
      log(`${player.name} was sent directly to Jail.`, player.id, "danger");
      return;
    }

    if (space.type === "vacation") log(`${player.name} is taking a quiet Vacation. No reward, no penalty.`, player.id);
    if (space.type === "jail") log(`${player.name} is Just Visiting Jail.`, player.id);
    finishResolution();
  }, [createDebtOrPay, finishResolution, log]);

  const moveBy = useCallback(async (playerId: string, steps: number, diceTotal: number) => {
    dispatch({ type: "SET_PHASE", phase: "MOVING" });
    for (let step = 0; step < steps; step += 1) {
      const player = stateRef.current.players.find((candidate) => candidate.id === playerId);
      if (!player) return;
      const position = (player.position + 1) % 40;
      const collectStart = position === 0;
      dispatch({ type: "MOVE_STEP", playerId, position, collectStart });
      if (collectStart) log(`${player.name} passed START and received ₹200.`, player.id, "money");
      await wait(115);
    }
    const player = stateRef.current.players.find((candidate) => candidate.id === playerId);
    if (player) await resolveSpace(player.position, diceTotal);
  }, [log, resolveSpace]);

  const rollDice = useCallback(async () => {
    const latest = stateRef.current;
    if (latest.phase !== "WAITING_FOR_ROLL") return;
    const player = latest.players[latest.currentPlayerIndex];
    dispatch({ type: "SET_PHASE", phase: "ROLLING" });
    for (let frame = 0; frame < 7; frame += 1) {
      dispatch({ type: "SET_DICE", dice: [rollDie(), rollDie()] });
      await wait(95 + frame * 15);
    }
    const dice: [number, number] = [rollDie(), rollDie()];
    const isDouble = dice[0] === dice[1];
    const doublesCount = isDouble ? latest.doublesCount + 1 : 0;
    dispatch({ type: "SET_ROLL_RESULT", dice, doublesCount, rollAgain: isDouble });
    log(`${player.name} rolled ${dice[0] + dice[1]}${isDouble ? " — doubles!" : "."}`, player.id, isDouble ? "important" : "normal");
    await wait(250);
    if (doublesCount === 3) {
      dispatch({ type: "SEND_TO_JAIL", playerId: player.id });
      log(`${player.name} rolled three consecutive doubles and went to Jail.`, player.id, "danger");
      return;
    }
    await moveBy(player.id, dice[0] + dice[1], dice[0] + dice[1]);
  }, [log, moveBy]);

  const buyPendingProperty = useCallback(() => {
    const latest = stateRef.current;
    const player = latest.players[latest.currentPlayerIndex];
    const space = latest.pendingSpaceId === null ? null : getSpace(latest.pendingSpaceId);
    if (!space || space.type !== "property" || player.money < space.price || latest.properties[space.id].ownerId) return;
    dispatch({ type: "BUY_PROPERTY", playerId: player.id, spaceId: space.id, price: space.price });
    log(`${player.name} bought ${space.name} for ${formatMoney(space.price)}.`, player.id, "money");
    finishResolution();
  }, [finishResolution, log]);

  const startAuction = useCallback(() => {
    const latest = stateRef.current;
    if (latest.pendingSpaceId === null) return;
    const activePlayers = latest.players.filter((player) => !player.bankrupt);
    if (activePlayers.length === 0) return;
    dispatch({
      type: "START_AUCTION",
      auction: { spaceId: latest.pendingSpaceId, activeBidderId: activePlayers[0].id, passedIds: [], currentBid: 0, highestBidderId: null },
    });
    log(`${getSpace(latest.pendingSpaceId).name} entered a Bank auction.`, undefined, "important");
  }, [log]);

  const nextAuctionBidder = useCallback((passedIds: string[], currentId: string) => {
    const latest = stateRef.current;
    const eligible = latest.players.filter((player) => !player.bankrupt && !passedIds.includes(player.id));
    if (eligible.length === 0) return null;
    const currentIndex = eligible.findIndex((player) => player.id === currentId);
    return eligible[(currentIndex + 1 + eligible.length) % eligible.length];
  }, []);

  const auctionBid = useCallback((increment: number) => {
    const latest = stateRef.current;
    const auction = latest.auction;
    if (!auction) return;
    const bidder = latest.players.find((player) => player.id === auction.activeBidderId);
    const bid = auction.currentBid + increment;
    if (!bidder || bid > bidder.money || increment <= 0) return;
    const next = nextAuctionBidder(auction.passedIds, bidder.id);
    const updated = { ...auction, currentBid: bid, highestBidderId: bidder.id, activeBidderId: next?.id ?? bidder.id };
    dispatch({ type: "UPDATE_AUCTION", auction: updated });
    log(`${bidder.name} bid ${formatMoney(bid)}.`, bidder.id, "money");
  }, [log, nextAuctionBidder]);

  const auctionPass = useCallback(() => {
    const latest = stateRef.current;
    const auction = latest.auction;
    if (!auction) return;
    const bidder = latest.players.find((player) => player.id === auction.activeBidderId);
    if (!bidder) return;
    const passedIds = [...auction.passedIds, bidder.id];
    const remaining = latest.players.filter((player) => !player.bankrupt && !passedIds.includes(player.id));
    log(`${bidder.name} passed in the auction.`, bidder.id);

    if ((auction.highestBidderId && remaining.length === 1 && remaining[0].id === auction.highestBidderId) || remaining.length === 0) {
      const winner = latest.players.find((player) => player.id === auction.highestBidderId);
      dispatch({ type: "RESOLVE_AUCTION", winnerId: auction.highestBidderId, spaceId: auction.spaceId, amount: auction.currentBid });
      if (winner) log(`${winner.name} won ${getSpace(auction.spaceId).name} for ${formatMoney(auction.currentBid)}.`, winner.id, "important");
      else log(`${getSpace(auction.spaceId).name} received no bids and remains with the Bank.`);
      finishResolution();
      return;
    }
    const next = nextAuctionBidder(passedIds, bidder.id);
    if (next) dispatch({ type: "UPDATE_AUCTION", auction: { ...auction, passedIds, activeBidderId: next.id } });
  }, [finishResolution, log, nextAuctionBidder]);

  const endTurn = useCallback(() => {
    const latest = stateRef.current;
    if (latest.phase !== "WAITING_FOR_END_TURN") return;
    const endingPlayer = latest.players[latest.currentPlayerIndex];
    dispatch({ type: "END_TURN" });
    const nextIndex = (() => {
      for (let offset = 1; offset <= latest.players.length; offset += 1) {
        const index = (latest.currentPlayerIndex + offset) % latest.players.length;
        if (!latest.players[index].bankrupt) return index;
      }
      return latest.currentPlayerIndex;
    })();
    log(`${endingPlayer.name} ended their turn. ${latest.players[nextIndex].name} is up next.`, latest.players[nextIndex].id);
  }, [log]);

  const handleCard = useCallback(async () => {
    const card = drawnCard;
    if (!card) return;
    setDrawnCard(null);
    const latest = stateRef.current;
    const player = latest.players[latest.currentPlayerIndex];
    log(`${player.name} drew “${card.title}”.`, player.id, "important");
    if (card.type === "money") {
      if (card.amount < 0 && player.money < Math.abs(card.amount)) {
        dispatch({ type: "SET_DEBT", debt: { amount: Math.abs(card.amount), creditorId: null, reason: card.title } });
        return;
      }
      dispatch({ type: "ADJUST_MONEY", playerId: player.id, amount: card.amount });
      finishResolution();
      return;
    }
    if (card.type === "getOutOfJail") {
      dispatch({ type: "GRANT_JAIL_CARD", playerId: player.id });
      finishResolution();
      return;
    }
    if (card.type === "jail") {
      dispatch({ type: "SEND_TO_JAIL", playerId: player.id });
      log(`${player.name} went directly to Jail.`, player.id, "danger");
      return;
    }
    const collectStart = card.target <= player.position;
    dispatch({ type: "MOVE_DIRECT", playerId: player.id, position: card.target, collectStart });
    if (collectStart) log(`${player.name} passed START and received ₹200.`, player.id, "money");
    await wait(300);
    await resolveSpace(card.target, stateRef.current.dice[0] + stateRef.current.dice[1]);
  }, [drawnCard, finishResolution, log, resolveSpace]);

  const jailPay = useCallback(() => {
    const latest = stateRef.current;
    const player = latest.players[latest.currentPlayerIndex];
    if (!player.inJail || player.money < 50) return;
    dispatch({ type: "RELEASE_FROM_JAIL", playerId: player.id, payFine: true, useCard: false });
    log(`${player.name} paid ₹50 and left Jail.`, player.id, "money");
  }, [log]);

  const jailUseCard = useCallback(() => {
    const latest = stateRef.current;
    const player = latest.players[latest.currentPlayerIndex];
    if (!player.inJail || player.getOutOfJailCards < 1) return;
    dispatch({ type: "RELEASE_FROM_JAIL", playerId: player.id, payFine: false, useCard: true });
    log(`${player.name} used a Get Out of Jail Free card.`, player.id, "important");
  }, [log]);

  const jailRoll = useCallback(async () => {
    const latest = stateRef.current;
    if (latest.phase !== "JAIL_DECISION") return;
    const player = latest.players[latest.currentPlayerIndex];
    dispatch({ type: "SET_PHASE", phase: "ROLLING" });
    for (let frame = 0; frame < 6; frame += 1) {
      dispatch({ type: "SET_DICE", dice: [rollDie(), rollDie()] });
      await wait(110);
    }
    const dice: [number, number] = [rollDie(), rollDie()];
    dispatch({ type: "SET_DICE", dice });
    const total = dice[0] + dice[1];
    if (dice[0] === dice[1]) {
      dispatch({ type: "RELEASE_FROM_JAIL", playerId: player.id, payFine: false, useCard: false });
      log(`${player.name} rolled doubles and left Jail.`, player.id, "important");
      await moveBy(player.id, total, total);
      return;
    }
    if (player.jailTurns >= 2) {
      if (player.money >= 50) {
        dispatch({ type: "RELEASE_FROM_JAIL", playerId: player.id, payFine: true, useCard: false });
        log(`${player.name} completed three Jail turns, paid ₹50, and moved.`, player.id, "money");
        await moveBy(player.id, total, total);
      } else {
        dispatch({ type: "SET_DEBT", debt: { amount: 50, creditorId: null, reason: "Jail fine" } });
      }
      return;
    }
    dispatch({ type: "FAIL_JAIL_ROLL", playerId: player.id });
    log(`${player.name} did not roll doubles and remains in Jail.`, player.id);
  }, [log, moveBy]);

  const openTrade = useCallback((existing?: TradeOffer) => {
    const latest = stateRef.current;
    const proposer = latest.players[latest.currentPlayerIndex];
    const recipient = latest.players.find((player) => !player.bankrupt && player.id !== proposer.id);
    if (!recipient) return;
    dispatch({ type: "SET_TRADE", trade: existing ?? {
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
    } });
  }, []);

  const updateTrade = useCallback((trade: TradeOffer) => dispatch({ type: "SET_TRADE", trade }), []);

  const sendTrade = useCallback(() => {
    const trade = stateRef.current.trade;
    if (!trade) return;
    dispatch({ type: "SET_TRADE", trade: { ...trade, status: "pending" } });
    const proposer = stateRef.current.players.find((player) => player.id === trade.proposerId);
    const recipient = stateRef.current.players.find((player) => player.id === trade.recipientId);
    log(`${proposer?.name} created a trade with ${recipient?.name}.`, proposer?.id, "trade");
  }, [log]);

  const acceptTrade = useCallback(() => {
    const latest = stateRef.current;
    const trade = latest.trade;
    if (!trade) return;
    const proposer = latest.players.find((player) => player.id === trade.proposerId);
    const recipient = latest.players.find((player) => player.id === trade.recipientId);
    const ownershipValid = trade.offeredPropertyIds.every((id) => latest.properties[id]?.ownerId === trade.proposerId) &&
      trade.requestedPropertyIds.every((id) => latest.properties[id]?.ownerId === trade.recipientId);
    const assetsValid = ownershipValid && !!proposer && !!recipient && proposer.money >= trade.offeredCash && recipient.money >= trade.requestedCash &&
      proposer.getOutOfJailCards >= trade.offeredCards && recipient.getOutOfJailCards >= trade.requestedCards;
    if (!assetsValid) {
      log("The trade became invalid because the available assets changed.", undefined, "danger");
      dispatch({ type: "SET_TRADE", trade: null });
      finishResolution();
      return;
    }
    dispatch({ type: "ACCEPT_TRADE", trade });
    log(`${recipient.name} accepted a trade from ${proposer.name}.`, recipient.id, "trade");
    finishResolution();
  }, [finishResolution, log]);

  const declineTrade = useCallback(() => {
    const trade = stateRef.current.trade;
    if (trade) {
      const recipient = stateRef.current.players.find((player) => player.id === trade.recipientId);
      log(`${recipient?.name} declined the trade.`, recipient?.id, "trade");
    }
    dispatch({ type: "SET_TRADE", trade: null });
    finishResolution();
  }, [finishResolution, log]);

  const negotiateTrade = useCallback(() => {
    const trade = stateRef.current.trade;
    if (!trade) return;
    const counter: TradeOffer = {
      ...trade,
      id: `${Date.now()}`,
      proposerId: trade.recipientId,
      recipientId: trade.proposerId,
      offeredCash: trade.requestedCash,
      requestedCash: trade.offeredCash,
      offeredPropertyIds: trade.requestedPropertyIds,
      requestedPropertyIds: trade.offeredPropertyIds,
      offeredCards: trade.requestedCards,
      requestedCards: trade.offeredCards,
      status: "editing",
    };
    dispatch({ type: "SET_TRADE", trade: counter });
    log("A counter-offer is being prepared.", counter.proposerId, "trade");
  }, [log]);

  const propertyAction = useCallback((action: "build" | "sell" | "mortgage" | "unmortgage", space: PropertySpace) => {
    const latest = stateRef.current;
    const player = latest.players[latest.currentPlayerIndex];
    const status = latest.properties[space.id];
    if (status.ownerId !== player.id) return;
    if (action === "build") {
      if (canBuildHotel(latest, player.id, space)) {
        dispatch({ type: "BUILD_HOTEL", playerId: player.id, spaceId: space.id, cost: space.houseCost ?? 0 });
        log(`${player.name} built a hotel on ${space.name}.`, player.id, "important");
      } else if (canBuild(latest, player.id, space)) {
        dispatch({ type: "BUILD_HOUSE", playerId: player.id, spaceId: space.id, cost: space.houseCost ?? 0 });
        log(`${player.name} built a house on ${space.name}.`, player.id, "money");
      }
      return;
    }
    if (action === "sell" && canSellBuilding(latest, player.id, space)) {
      dispatch({ type: "SELL_BUILDING", playerId: player.id, spaceId: space.id, refund: (space.houseCost ?? 0) / 2 });
      log(`${player.name} sold a building on ${space.name} for ${formatMoney((space.houseCost ?? 0) / 2)}.`, player.id, "money");
      return;
    }
    if (action === "mortgage" && canMortgage(latest, player.id, space)) {
      dispatch({ type: "MORTGAGE", playerId: player.id, spaceId: space.id, value: space.mortgageValue });
      log(`${player.name} mortgaged ${space.name} for ${formatMoney(space.mortgageValue)}.`, player.id, "money");
      return;
    }
    const repayment = Math.ceil(space.mortgageValue * 1.1);
    if (action === "unmortgage" && status.mortgaged && player.money >= repayment) {
      dispatch({ type: "UNMORTGAGE", playerId: player.id, spaceId: space.id, cost: repayment });
      log(`${player.name} repaid ${formatMoney(repayment)} to unmortgage ${space.name}.`, player.id, "money");
    }
  }, [log]);

  const settleDebt = useCallback(() => {
    const latest = stateRef.current;
    const debt = latest.debt;
    const player = latest.players[latest.currentPlayerIndex];
    if (!debt || player.money < debt.amount) return;
    dispatch({ type: "TRANSFER_MONEY", fromId: player.id, toId: debt.creditorId, amount: debt.amount });
    dispatch({ type: "SET_DEBT", debt: null });
    log(`${player.name} settled ${formatMoney(debt.amount)} owed for ${debt.reason}.`, player.id, "money");
    finishResolution();
  }, [finishResolution, log]);

  const bankrupt = useCallback(() => {
    const latest = stateRef.current;
    const player = latest.players[latest.currentPlayerIndex];
    dispatch({ type: "BANKRUPT", playerId: player.id, creditorId: latest.debt?.creditorId ?? null });
    log(`${player.name} filed for bankruptcy and left the game.`, player.id, "danger");
  }, [log]);

  useEffect(() => {
    const timer = window.setInterval(() => dispatch({ type: "TICK_TIMER" }), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("india-tycoon-game", JSON.stringify(state));
  }, [state]);

  const tradeableProperties = useMemo(() => boardData.filter((space): space is PropertySpace =>
    space.type === "property" && canTradeProperty(state, space)), [state]);

  return {
    state,
    currentPlayer,
    drawnCard,
    rollDice,
    buyPendingProperty,
    startAuction,
    auctionBid,
    auctionPass,
    endTurn,
    handleCard,
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
    settleDebt,
    bankrupt,
    selectSpace: (spaceId: number | null) => dispatch({ type: "SELECT_SPACE", spaceId }),
    closeTrade: () => { dispatch({ type: "SET_TRADE", trade: null }); finishResolution(); },
    addTime: () => dispatch({ type: "ADD_TIME" }),
    tradeableProperties,
  };
};
