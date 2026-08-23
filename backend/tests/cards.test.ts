import { describe, expect, it } from 'vitest';

import {
  ALL_CARDS,
  STARTING_CASH,
} from '../app/models/index.js';
import type { GameState, Pending } from '../app/models/index.js';
import {
  drawAndApply,
  rollDice,
  takeTurn,
} from '../app/engine/index.js';
import type { AgentsByPlayer, Decision, PlayerAgent } from '../app/engine/index.js';
import { TILE, give, makeGame, scriptedRoller } from './helpers.js';

const quietAgent = (playerId: string): PlayerAgent => ({
  playerId,
  decide(_state: GameState, pending: Pending): Promise<Decision> {
    if (pending.type === 'ROLL') return Promise.resolve({ type: 'ROLL' });
    if (pending.type === 'BUY_PROPERTY') return Promise.resolve({ type: 'BUY_PROPERTY', buy: false });
    if (pending.type === 'AUCTION_BID') return Promise.resolve({ type: 'AUCTION_BID', bid: null });
    if (pending.type === 'JAIL_DECISION') return Promise.resolve({ type: 'JAIL_DECISION', action: 'ROLL' });
    throw new Error(`Unexpected ${pending.type} decision`);
  },
});

const agentsFor = (...agents: PlayerAgent[]): AgentsByPlayer =>
  new Map(agents.map((agent) => [agent.playerId, agent]));

describe('backend card data and transactions', () => {
  it('provides a title and structured effect for every backend card', () => {
    expect(ALL_CARDS).toHaveLength(32);
    expect(ALL_CARDS.every((card) => card.title.length > 0 && card.text.length > 0)).toBe(true);
    expect(ALL_CARDS.find((card) => card.title === 'Traffic Fine')?.effect).toEqual({ type: 'PAY', amount: 25 });
    expect(ALL_CARDS.find((card) => card.title === 'Southern Express')?.effect).toEqual({
      type: 'MOVE_TO',
      position: 37,
      collectGoSalary: false,
    });
  });

  it('records direct card cash transactions from their backend effect', () => {
    const state = makeGame();
    const player = state.players[0]!;
    state.decks.COMMUNITY_CHEST = ['chest-holiday-fund'];

    drawAndApply(state, player, 'COMMUNITY_CHEST', 7);

    expect(player.cash).toBe(STARTING_CASH + 100);
    expect(state.cardTransactions).toMatchObject([{
      title: 'Festival Bonus',
      effectType: 'COLLECT',
      playerId: player.id,
      completed: true,
      cashChanges: [
        { playerId: player.id, before: STARTING_CASH, after: STARTING_CASH + 100, delta: 100 },
        { playerId: state.players[1]!.id, delta: 0 },
      ],
    }]);
  });

  it('keeps a movement-card transaction open through destination rent', async () => {
    const state = makeGame();
    const [traveller, owner] = [state.players[0]!, state.players[1]!];
    state.decks.CHANCE = ['chance-trip-to-kings-cross'];
    give(state, owner, TILE.kingsCross);

    await takeTurn(
      state,
      agentsFor(quietAgent(traveller.id), quietAgent(owner.id)),
      { roll: scriptedRoller([[3, 4]]) },
    );

    const transaction = state.cardTransactions[0]!;
    expect(transaction.title).toBe('Capital Calling');
    expect(transaction.positionBefore).toBe(TILE.chanceEarly);
    expect(transaction.positionAfter).toBe(TILE.kingsCross);
    expect(transaction.completed).toBe(true);
    expect(transaction.cashChanges.find((change) => change.playerId === traveller.id)?.delta).toBe(175);
    expect(transaction.cashChanges.find((change) => change.playerId === owner.id)?.delta).toBe(25);
  });

  it('records retained pardon cards as held by the drawing player', () => {
    const state = makeGame();
    const player = state.players[0]!;
    state.decks.CHANCE = ['chance-get-out-of-jail-free'];

    drawAndApply(state, player, 'CHANCE', 6);

    expect(player.heldCards).toContain('chance-get-out-of-jail-free');
    expect(state.cardTransactions[0]).toMatchObject({
      title: 'Official Pardon',
      effectType: 'GET_OUT_OF_JAIL_FREE',
      retainedByPlayer: true,
      completed: true,
    });
  });
});

describe('the central backend dice roller', () => {
  it('is the single source that maps randomness to legal dice values', () => {
    expect(rollDice(() => 0)).toEqual({ die1: 1, die2: 1, total: 2, isDouble: true });
    expect(rollDice(() => 0.999999)).toEqual({ die1: 6, die2: 6, total: 12, isDouble: true });
  });
});
