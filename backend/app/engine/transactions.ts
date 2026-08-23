import {
  BUILDING_SELLBACK_RATE,
  GROUP_POSITIONS,
  HOTEL_LEVEL,
  MORTGAGE_INTEREST_PERCENT,
  VARIANT_RULES,
  getTile,
  isOwnable,
  mortgageValue,
  unmortgageCost,
} from '../models/index.js';
import type { GameState, Player, TradeSide } from '../models/index.js';
import { ownsWholeGroup } from './holdings.js';
import { log } from './log.js';
import { recordPropertyTransfer } from './ownership.js';
import { declareBankrupt } from './payments.js';
import type { ChargeResult } from './payments.js';

function playerOf(state: GameState, playerId: string): Player {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) throw new Error(`No player ${playerId} in game ${state.id}`);
  if (player.bankrupt) throw new Error(`${player.name} is bankrupt`);
  return player;
}

function assertOwner(state: GameState, playerId: string, position: number) {
  const tile = getTile(position);
  const holding = state.properties[position];
  if (!isOwnable(tile) || !holding) throw new Error('That position is not ownable');
  if (holding.ownerId !== playerId) throw new Error('The player does not own that property');
  return { tile, holding };
}

function groupHasBuildings(state: GameState, position: number): boolean {
  const tile = getTile(position);
  if (tile.kind !== 'PROPERTY') return false;
  return GROUP_POSITIONS[tile.group].some((site) => (state.properties[site]?.houses ?? 0) > 0);
}

export function buyBuilding(state: GameState, playerId: string, position: number): void {
  const player = playerOf(state, playerId);
  const { tile, holding } = assertOwner(state, playerId, position);
  if (tile.kind !== 'PROPERTY') throw new Error('Buildings can only be placed on Sites');
  if (!ownsWholeGroup(state, playerId, tile.group)) throw new Error('The complete state group is required');

  const group = GROUP_POSITIONS[tile.group];
  const levels = group.map((site) => state.properties[site]?.houses ?? 0);
  if (group.some((site) => state.properties[site]?.mortgaged)) throw new Error('A mortgaged group cannot be developed');
  if (player.cash < tile.houseCost) throw new Error('Not enough cash for this building');

  const housesPerHotel = VARIANT_RULES[state.variant].housesPerHotel;
  if (holding.houses === housesPerHotel) {
    if (!levels.every((level) => level >= housesPerHotel)) throw new Error('Every Site needs the required Houses first');
    if (state.bank.hotels < 1) throw new Error('The Bank has no Hotels left');
    player.cash -= tile.houseCost;
    holding.houses = HOTEL_LEVEL;
    state.bank.hotels -= 1;
    state.bank.houses += housesPerHotel;
    log(state, `${player.name} built a Hotel on ${tile.name} for ${tile.houseCost}.`);
    return;
  }

  if (holding.houses >= housesPerHotel) throw new Error('This Site cannot be developed further');
  const minimum = Math.min(...levels);
  if (holding.houses !== minimum) throw new Error('Houses must be built evenly across the group');
  if (state.bank.houses < 1) throw new Error('The Bank has no Houses left');
  player.cash -= tile.houseCost;
  holding.houses += 1;
  state.bank.houses -= 1;
  log(state, `${player.name} built a House on ${tile.name} for ${tile.houseCost}.`);
}

export function sellBuilding(state: GameState, playerId: string, position: number): void {
  const player = playerOf(state, playerId);
  const { tile, holding } = assertOwner(state, playerId, position);
  if (tile.kind !== 'PROPERTY' || holding.houses <= 0) throw new Error('There is no building to sell');

  const refund = Math.floor(tile.houseCost * BUILDING_SELLBACK_RATE);
  const housesPerHotel = VARIANT_RULES[state.variant].housesPerHotel;
  if (holding.houses === HOTEL_LEVEL) {
    if (state.bank.houses < housesPerHotel) throw new Error('The Bank has too few Houses to break down this Hotel');
    holding.houses = housesPerHotel;
    state.bank.hotels += 1;
    state.bank.houses -= housesPerHotel;
    player.cash += refund;
    log(state, `${player.name} sold the Hotel on ${tile.name} back for ${refund}.`);
    return;
  }

  const groupMaximum = Math.max(...GROUP_POSITIONS[tile.group].map((site) => state.properties[site]?.houses ?? 0));
  if (holding.houses !== groupMaximum) throw new Error('Buildings must be sold evenly across the group');
  holding.houses -= 1;
  state.bank.houses += 1;
  player.cash += refund;
  log(state, `${player.name} sold a House on ${tile.name} back for ${refund}.`);
}

export function mortgageProperty(state: GameState, playerId: string, position: number): void {
  const player = playerOf(state, playerId);
  const { tile, holding } = assertOwner(state, playerId, position);
  if (holding.mortgaged) throw new Error('That property is already mortgaged');
  if (groupHasBuildings(state, position)) throw new Error('All buildings in the group must be sold first');
  const value = mortgageValue(tile);
  holding.mortgaged = true;
  player.cash += value;
  log(state, `${player.name} mortgaged ${tile.name} for ${value}.`);
}

export function unmortgageProperty(state: GameState, playerId: string, position: number): void {
  const player = playerOf(state, playerId);
  const { tile, holding } = assertOwner(state, playerId, position);
  if (!holding.mortgaged) throw new Error('That property is not mortgaged');
  const cost = unmortgageCost(tile);
  if (player.cash < cost) throw new Error('Not enough cash to remove the mortgage');
  player.cash -= cost;
  holding.mortgaged = false;
  log(state, `${player.name} removed the mortgage on ${tile.name} for ${cost}.`);
}

function validateTradeSide(state: GameState, owner: Player, side: TradeSide): void {
  if (!Number.isInteger(side.cash) || side.cash < 0 || side.cash > owner.cash) throw new Error('Invalid trade cash');
  if (new Set(side.positions).size !== side.positions.length) throw new Error('A property appears twice in the trade');
  if (new Set(side.cardIds).size !== side.cardIds.length) throw new Error('A card appears twice in the trade');
  for (const position of side.positions) {
    assertOwner(state, owner.id, position);
    if (groupHasBuildings(state, position)) throw new Error('Developed property cannot be traded');
  }
  for (const cardId of side.cardIds) {
    if (!owner.heldCards.includes(cardId)) throw new Error('The player does not hold that card');
  }
}

function transferFee(state: GameState, positions: number[]): number {
  return positions.reduce((total, position) => {
    const tile = getTile(position);
    const holding = state.properties[position];
    if (!isOwnable(tile) || !holding?.mortgaged) return total;
    return total + Math.ceil((mortgageValue(tile) * MORTGAGE_INTEREST_PERCENT) / 100);
  }, 0);
}

export function executeTrade(
  state: GameState,
  proposerId: string,
  recipientId: string,
  offered: TradeSide,
  requested: TradeSide,
): void {
  if (proposerId === recipientId) throw new Error('A player cannot trade with themselves');
  const proposer = playerOf(state, proposerId);
  const recipient = playerOf(state, recipientId);
  validateTradeSide(state, proposer, offered);
  validateTradeSide(state, recipient, requested);

  const proposerFee = transferFee(state, requested.positions);
  const recipientFee = transferFee(state, offered.positions);
  if (proposer.cash - offered.cash + requested.cash < proposerFee) throw new Error('Proposer cannot pay transferred mortgage interest');
  if (recipient.cash - requested.cash + offered.cash < recipientFee) throw new Error('Recipient cannot pay transferred mortgage interest');

  proposer.cash = proposer.cash - offered.cash + requested.cash - proposerFee;
  recipient.cash = recipient.cash - requested.cash + offered.cash - recipientFee;

  const movePositions = (from: Player, to: Player, positions: number[]) => {
    for (const position of positions) {
      state.properties[position]!.ownerId = to.id;
      from.properties = from.properties.filter((owned) => owned !== position);
      to.properties.push(position);
      recordPropertyTransfer(state, {
        position,
        fromPlayerId: from.id,
        toPlayerId: to.id,
        amount: null,
        method: 'TRADE',
      });
    }
  };
  const moveCards = (from: Player, to: Player, cardIds: string[]) => {
    from.heldCards = from.heldCards.filter((cardId) => !cardIds.includes(cardId));
    to.heldCards.push(...cardIds);
  };

  movePositions(proposer, recipient, offered.positions);
  movePositions(recipient, proposer, requested.positions);
  moveCards(proposer, recipient, offered.cardIds);
  moveCards(recipient, proposer, requested.cardIds);
  log(state, `${proposer.name} and ${recipient.name} completed a private trade.`);
}

export function proposeTrade(
  state: GameState,
  proposerId: string,
  recipientId: string,
  offered: TradeSide,
  requested: TradeSide,
): void {
  const proposer = playerOf(state, proposerId);
  const recipient = playerOf(state, recipientId);
  validateTradeSide(state, proposer, offered);
  validateTradeSide(state, recipient, requested);
  state.pending = { type: 'TRADE_OFFER', playerId: recipientId, proposerId, offered, requested };
  log(state, `${proposer.name} proposed a trade to ${recipient.name}.`);
}

export function acceptPendingTrade(state: GameState, recipientId: string): void {
  const pending = state.pending;
  if (!pending || pending.type !== 'TRADE_OFFER' || pending.playerId !== recipientId) throw new Error('There is no trade for this player');
  executeTrade(state, pending.proposerId, recipientId, pending.offered, pending.requested);
  state.pending = null;
}

export function declinePendingTrade(state: GameState, recipientId: string): void {
  const pending = state.pending;
  if (!pending || pending.type !== 'TRADE_OFFER' || pending.playerId !== recipientId) throw new Error('There is no trade for this player');
  const recipient = playerOf(state, recipientId);
  state.pending = null;
  log(state, `${recipient.name} declined the trade.`);
}

export function declareVoluntaryBankruptcy(
  state: GameState,
  playerId: string,
  creditorId: string | null = null,
): ChargeResult {
  const player = playerOf(state, playerId);
  const creditor = creditorId ? playerOf(state, creditorId) : null;
  return declareBankrupt(state, player, creditor, Number.MAX_SAFE_INTEGER);
}
