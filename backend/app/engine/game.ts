import {
  CARDS_BY_DECK,
  HOTEL_SUPPLY,
  HOUSE_SUPPLY,
  OWNABLE_POSITIONS,
  STARTING_CASH,
} from '../models/index.js';
import type {
  DiceRoller,
  GameState,
  InitialOrderResult,
  Player,
  PropertyState,
} from '../models/index.js';
import { randomRoller } from './dice.js';

export interface NewPlayerInput {
  id: string;
  name: string;
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target]!, result[index]!];
  }
  return result;
}

/** Create state; this random source shuffles decks only. Dice always use dice.ts. */
export function createGameState(
  id: string,
  playerInputs: NewPlayerInput[],
  deckRandom: () => number = Math.random,
): GameState {
  if (playerInputs.length < 2 || playerInputs.length > 4) {
    throw new Error('A game requires between 2 and 4 players');
  }
  if (new Set(playerInputs.map((player) => player.id)).size !== playerInputs.length) {
    throw new Error('Player ids must be unique');
  }

  const players: Player[] = playerInputs.map((player) => ({
    ...player,
    position: 0,
    cash: STARTING_CASH,
    properties: [],
    inJail: false,
    jailTurns: 0,
    heldCards: [],
    bankrupt: false,
  }));
  const properties: Record<number, PropertyState> = {};
  for (const position of OWNABLE_POSITIONS) {
    properties[position] = { position, ownerId: null, houses: 0, mortgaged: false };
  }

  return {
    id,
    phase: 'IN_PROGRESS',
    variant: 'STANDARD',
    endsAt: null,
    players,
    currentPlayerIndex: 0,
    properties,
    bank: { houses: HOUSE_SUPPLY, hotels: HOTEL_SUPPLY },
    decks: {
      CHANCE: shuffled(CARDS_BY_DECK.CHANCE.map((card) => card.id), deckRandom),
      COMMUNITY_CHEST: shuffled(CARDS_BY_DECK.COMMUNITY_CHEST.map((card) => card.id), deckRandom),
    },
    doublesCount: 0,
    hasRolled: false,
    pending: null,
    lastDice: null,
    lastCard: null,
    awaitingEndTurn: false,
    propertyTransfers: [],
    cardTransactions: [],
    turnCount: 1,
    winnerId: null,
    log: [`Game ${id} started. ${players[0]!.name} goes first.`],
  };
}

/** Roll every player on the backend and re-roll only tied leaders. */
export function determineInitialOrder(
  playerIds: string[],
  roller: DiceRoller = randomRoller,
): InitialOrderResult {
  if (playerIds.length < 2 || playerIds.length > 4) {
    throw new Error('Initial order requires between 2 and 4 players');
  }
  if (new Set(playerIds).size !== playerIds.length) {
    throw new Error('Player ids must be unique');
  }

  const rounds: InitialOrderResult['rounds'] = [];
  let contenders = [...playerIds];
  let round = 1;

  while (contenders.length > 1) {
    const rolls = contenders.map((playerId) => ({ playerId, dice: roller() }));
    rounds.push({ round, rolls });
    const highest = Math.max(...rolls.map((result) => result.dice.total));
    contenders = rolls.filter((result) => result.dice.total === highest).map((result) => result.playerId);
    round += 1;
  }

  const winnerId = contenders[0]!;
  const winnerIndex = playerIds.indexOf(winnerId);
  return {
    rounds,
    orderedPlayerIds: [...playerIds.slice(winnerIndex), ...playerIds.slice(0, winnerIndex)],
  };
}
