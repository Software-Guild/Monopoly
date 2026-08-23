import { describe, expect, it } from 'vitest';

import {
  buyBuilding,
  createGameState,
  determineInitialOrder,
  executeTrade,
} from '../app/engine/index.js';
import { BOARD, type DiceRoll, type DiceRoller } from '../app/models/index.js';
import { makeGame } from './helpers.js';

const scriptedRoller = (values: Array<[number, number]>): DiceRoller => {
  let index = 0;
  return (): DiceRoll => {
    const [die1, die2] = values[index++]!;
    return { die1, die2, total: die1 + die2, isDouble: die1 === die2 };
  };
};

describe('backend game setup', () => {
  it('determines opening order with backend dice and re-rolls tied leaders', () => {
    const result = determineInitialOrder(
      ['p1', 'p2', 'p3'],
      scriptedRoller([[3, 4], [2, 5], [2, 2], [2, 3], [4, 4]]),
    );

    expect(result.rounds).toHaveLength(2);
    expect(result.rounds[1]!.rolls.map((roll) => roll.playerId)).toEqual(['p1', 'p2']);
    expect(result.orderedPlayerIds).toEqual(['p2', 'p3', 'p1']);
  });

  it('uses the same fixed Indian names as the frontend board', () => {
    expect(BOARD.map((tile) => tile.name)).toEqual([
      'START', 'Panaji', 'Treasure', 'Margao', 'Income Tax',
      'New Delhi Railway Station', 'Jaipur', 'Surprise', 'Jodhpur', 'Udaipur',
      'Jail / Just Visiting', 'Kochi', 'Power Company', 'Kozhikode', 'Thiruvananthapuram',
      'Howrah Junction', 'Kolkata', 'Treasure', 'Darjeeling', 'Siliguri',
      'Vacation', 'Ahmedabad', 'Surprise', 'Surat', 'Vadodara',
      'Chhatrapati Shivaji Maharaj Terminus', 'Mumbai', 'Pune', 'Water Company', 'Nagpur',
      'Go To Jail', 'Bengaluru', 'Mysuru', 'Treasure', 'Mangaluru',
      'Chennai Central', 'Surprise', 'Chennai', 'Luxury Tax', 'Coimbatore',
    ]);
  });

  it('starts without a client-selected dice value', () => {
    const state = createGameState('new-game', [
      { id: 'p1', name: 'One' },
      { id: 'p2', name: 'Two' },
    ]);
    expect(state.lastDice).toBeNull();
    expect(state.propertyTransfers).toEqual([]);
  });
});

describe('backend-owned asset changes', () => {
  it('enforces even building and records trades in the deed ledger', () => {
    const state = makeGame();
    const [first, second] = state.players;
    state.properties[1]!.ownerId = first!.id;
    state.properties[3]!.ownerId = first!.id;
    first!.properties.push(1, 3);

    buyBuilding(state, first!.id, 1);
    expect(() => buyBuilding(state, first!.id, 1)).toThrow(/evenly/i);

    // Buildings must be removed before a developed group can be traded.
    state.properties[1]!.houses = 0;
    state.bank.houses = 32;
    executeTrade(
      state,
      first!.id,
      second!.id,
      { cash: 0, positions: [1], cardIds: [] },
      { cash: 25, positions: [], cardIds: [] },
    );

    expect(state.properties[1]!.ownerId).toBe(second!.id);
    expect(state.propertyTransfers).toMatchObject([
      { position: 1, fromPlayerId: first!.id, toPlayerId: second!.id, method: 'TRADE' },
    ]);
  });
});
