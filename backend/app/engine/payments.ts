import {
  BUILDING_SELLBACK_RATE,
  GROUP_POSITIONS,
  HOTEL_LEVEL,
  HOUSES_PER_HOTEL,
  MORTGAGE_INTEREST_PERCENT,
  getCard,
  getTile,
  isOwnable,
  mortgageValue,
} from '../models/index.js';
import type { GameState, Player } from '../models/index.js';
import { log } from './log.js';
import { recordPropertyTransfer } from './ownership.js';

export interface ChargeResult {
  /** How much actually reached the creditor. */
  paid: number;
  /** True when the payer could not cover the debt and left the game. */
  bankrupt: boolean;
  /**
   * Deeds the Bank now holds and must put up for auction. Only ever filled
   * when the debt was to the Bank; the caller drives those auctions.
   */
  toAuction: number[];
  /**
   * Mortgaged deeds the creditor just received. The interest is already
   * paid; the caller must raise a MORTGAGED_TRANSFER decision for each so
   * the new owner can clear the mortgage or keep it.
   */
  mortgagedReceived: number[];
}

function playerOf(state: GameState, id: string): Player {
  const player = state.players.find((p) => p.id === id);
  if (!player) throw new Error(`No player ${id} in game ${state.id}`);
  return player;
}

/** The Bank buys buildings back at half what they cost. */
function halfOf(amount: number): number {
  return Math.floor(amount * BUILDING_SELLBACK_RATE);
}

/**
 * Sell one level of building off a Site and return what the Bank pays.
 * A Hotel normally breaks back down into Houses; if the Bank has none left
 * to hand over, the whole Hotel goes at once instead, which is why the
 * rulebook warns you cannot replace it when the supply is out.
 */
function sellBuildingLevel(state: GameState, position: number): number {
  const tile = getTile(position);
  const holding = state.properties[position];
  if (tile.kind !== 'PROPERTY' || !holding || holding.houses <= 0) return 0;

  if (holding.houses === HOTEL_LEVEL) {
    state.bank.hotels += 1;
    if (state.bank.houses >= HOUSES_PER_HOTEL) {
      state.bank.houses -= HOUSES_PER_HOTEL;
      holding.houses = HOUSES_PER_HOTEL;
      log(state, `The Hotel on ${tile.name} was sold back and became Houses.`);
      return halfOf(tile.houseCost);
    }
    holding.houses = 0;
    log(state, `The Hotel on ${tile.name} was sold back whole: no Houses left.`);
    return halfOf(tile.houseCost) * (HOUSES_PER_HOTEL + 1);
  }

  holding.houses -= 1;
  state.bank.houses += 1;
  log(state, `A House on ${tile.name} was sold back to the Bank.`);
  return halfOf(tile.houseCost);
}

/**
 * The Site to take the next building off.
 *
 * Houses must be sold evenly, exactly as they were bought, so this only ever
 * picks a Site already standing at the highest level in its colour group.
 * Taking from the most valuable Site instead would leave the group built
 * unevenly, which the rulebook does not allow.
 */
function nextSiteToSellFrom(state: GameState, player: Player): number | null {
  let best: number | null = null;
  let bestHouses = 0;

  for (const position of player.properties) {
    const tile = getTile(position);
    if (tile.kind !== 'PROPERTY') continue;
    const houses = state.properties[position]?.houses ?? 0;
    if (houses <= 0) continue;

    const groupMax = Math.max(
      ...GROUP_POSITIONS[tile.group].map((p) => state.properties[p]?.houses ?? 0),
    );
    if (houses < groupMax) continue;

    if (best === null || houses > bestHouses) {
      best = position;
      bestHouses = houses;
    }
  }
  return best;
}

/** The next deed that can be mortgaged: buildings must come off first. */
function nextToMortgage(state: GameState, player: Player): number | null {
  for (const position of player.properties) {
    const holding = state.properties[position];
    if (holding && !holding.mortgaged && holding.houses === 0) return position;
  }
  return null;
}

function mortgage(state: GameState, player: Player, position: number): void {
  const tile = getTile(position);
  const holding = state.properties[position];
  if (!holding || !isOwnable(tile)) return;
  holding.mortgaged = true;
  const raised = mortgageValue(tile);
  player.cash += raised;
  log(state, `${player.name} mortgaged ${tile.name} for ${raised}.`);
}

/**
 * Raise cash towards `target`, stopping early once it is covered.
 *
 * The rulebook leaves the order to the player, so this is the engine policy
 * for settling automatically: mortgage whatever carries no buildings first,
 * because a mortgage can be repaid whereas a sold building is gone for half
 * its cost; then sell buildings evenly; then mortgage the Sites that frees.
 * Returns with whatever was raised if the assets run out.
 */
function liquidate(state: GameState, player: Player, target: number): void {
  while (player.cash < target) {
    const toMortgage = nextToMortgage(state, player);
    if (toMortgage !== null) {
      mortgage(state, player, toMortgage);
      continue;
    }
    const site = nextSiteToSellFrom(state, player);
    if (site === null) return;
    player.cash += sellBuildingLevel(state, site);
  }
}

export function declareBankrupt(
  state: GameState,
  debtor: Player,
  creditor: Player | null,
  debt: number,
): ChargeResult {
  const cash = debtor.cash;
  log(state, `${debtor.name} owed ${debt} but could raise only ${cash}, and is bankrupt.`);

  // Buildings always return to the Bank at half cost. Who receives that
  // money depends on who is owed.
  let buildingProceeds = 0;
  for (const position of [...debtor.properties]) {
    for (let got = sellBuildingLevel(state, position); got > 0; ) {
      buildingProceeds += got;
      got = sellBuildingLevel(state, position);
    }
  }

  const toAuction: number[] = [];
  const mortgagedReceived: number[] = [];
  debtor.cash = 0;

  if (creditor) {
    creditor.cash += cash + buildingProceeds;
    for (const position of [...debtor.properties]) {
      const holding = state.properties[position];
      if (!holding) continue;
      holding.ownerId = creditor.id;
      creditor.properties.push(position);
      recordPropertyTransfer(state, {
        position,
        fromPlayerId: debtor.id,
        toPlayerId: creditor.id,
        amount: null,
        method: 'BANKRUPTCY',
      });
      if (!holding.mortgaged) continue;

      const tile = getTile(position);
      if (isOwnable(tile)) {
        // The rulebook has the new owner pay the 10% at once; whether to
        // then clear the mortgage is their decision, raised by the caller.
        const interest = Math.ceil((mortgageValue(tile) * MORTGAGE_INTEREST_PERCENT) / 100);
        creditor.cash -= interest;
        log(state, `${creditor.name} paid ${interest} interest on mortgaged ${tile.name}.`);
      }
      mortgagedReceived.push(position);
    }
    creditor.heldCards.push(...debtor.heldCards);
    log(state, `${creditor.name} took over everything ${debtor.name} owned.`);
  } else {
    for (const position of [...debtor.properties]) {
      const holding = state.properties[position];
      if (!holding) continue;
      holding.ownerId = null;
      holding.mortgaged = false;
      toAuction.push(position);
      recordPropertyTransfer(state, {
        position,
        fromPlayerId: debtor.id,
        toPlayerId: null,
        amount: null,
        method: 'BANKRUPTCY',
      });
    }
    // Held cards go back to the bottom of the pile they came from.
    for (const cardId of debtor.heldCards) {
      state.decks[getCard(cardId).deck].push(cardId);
    }
    log(state, `The Bank took the estate of ${debtor.name} and must auction it.`);
  }

  debtor.properties = [];
  debtor.heldCards = [];
  debtor.bankrupt = true;

  return {
    paid: creditor ? cash + buildingProceeds : cash,
    bankrupt: true,
    toAuction,
    mortgagedReceived,
  };
}

/**
 * Charge a player. Pays from cash if that covers the debt; otherwise raises
 * what it can by mortgaging and selling evenly, and declares bankruptcy if
 * that still falls short.
 *
 * `creditorId` is null when the money is owed to the Bank. Mutates `state`.
 */
export function charge(
  state: GameState,
  payerId: string,
  amount: number,
  creditorId: string | null,
): ChargeResult {
  const settled: ChargeResult = {
    paid: 0,
    bankrupt: false,
    toAuction: [],
    mortgagedReceived: [],
  };
  if (amount <= 0) return settled;

  const payer = playerOf(state, payerId);
  const creditor = creditorId === null ? null : playerOf(state, creditorId);

  if (payer.cash < amount) liquidate(state, payer, amount);
  if (payer.cash < amount) return declareBankrupt(state, payer, creditor, amount);

  payer.cash -= amount;
  if (creditor) creditor.cash += amount;
  log(state, `${payer.name} paid ${amount} to ${creditor ? creditor.name : 'the Bank'}.`);
  return { ...settled, paid: amount };
}
