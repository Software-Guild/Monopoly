import { describe, expect, it } from 'vitest';
import { getCard } from '../app/models/index.js';
import { AiAgent, charge, drainAuctions, takeTurn } from '../app/engine/index.js';
import type { AgentsByPlayer, PlayerAgent } from '../app/engine/index.js';
import { TILE, give, makeGame, makePlayer, ownEverything, scriptedRoller } from './helpers.js';

const agentsFor = (...agents: PlayerAgent[]): AgentsByPlayer =>
  new Map(agents.map((a) => [a.playerId, a]));

describe('bankrupt to the Bank', () => {
  it('queues every deed for auction and sells them off one at a time', async () => {
    const debtor = makePlayer('p1', 'Ada', 0);
    const bidder = makePlayer('p2', 'Grace', 1500);
    const state = makeGame([debtor, bidder]);
    give(state, debtor, TILE.oldKent);
    give(state, debtor, TILE.whitechapel);

    const result = charge(state, debtor.id, 5000, null);

    expect(result.bankrupt).toBe(true);
    expect(debtor.bankrupt).toBe(true);
    // Both deeds are owed an auction, individually.
    expect(state.pendingAuctions).toEqual([TILE.oldKent, TILE.whitechapel]);
    expect(state.properties[TILE.oldKent]!.ownerId).toBeNull();

    await drainAuctions(state, agentsFor(new AiAgent('p1'), new AiAgent('p2')));

    expect(state.pendingAuctions).toEqual([]);
    expect(state.properties[TILE.oldKent]!.ownerId).toBe(bidder.id);
    expect(state.properties[TILE.whitechapel]!.ownerId).toBe(bidder.id);
    expect(bidder.properties).toContain(TILE.oldKent);
  });

  it('returns Get Out of Jail Free cards to the bottom of their own deck', () => {
    const debtor = makePlayer('p1', 'Ada', 0);
    const state = makeGame([debtor, makePlayer('p2', 'Grace')]);
    const chance = 'chance-get-out-of-jail-free';
    const chest = 'chest-get-out-of-jail-free';
    debtor.heldCards.push(chance, chest);
    state.decks.CHANCE = state.decks.CHANCE.filter((id) => id !== chance);
    state.decks.COMMUNITY_CHEST = state.decks.COMMUNITY_CHEST.filter((id) => id !== chest);

    charge(state, debtor.id, 100, null);

    expect(debtor.heldCards).toEqual([]);
    expect(getCard(chance).deck).toBe('CHANCE');
    expect(state.decks.CHANCE.at(-1)).toBe(chance);
    expect(state.decks.COMMUNITY_CHEST.at(-1)).toBe(chest);
  });

  it('drains the queue as part of a turn, not just on demand', async () => {
    const state = makeGame();
    const [ada, grace] = [state.players[0]!, state.players[1]!];
    ownEverything(state, grace);
    // A deed the Bank already owes an auction on.
    const holding = state.properties[TILE.mayfair]!;
    holding.ownerId = null;
    grace.properties = grace.properties.filter((p) => p !== TILE.mayfair);
    state.pendingAuctions.push(TILE.mayfair);

    await takeTurn(state, agentsFor(new AiAgent(ada.id), new AiAgent(grace.id)), {
      roll: scriptedRoller([[2, 3]]),
    });

    expect(state.pendingAuctions).toEqual([]);
    expect(state.properties[TILE.mayfair]!.ownerId).not.toBeNull();
  });
});

describe('bankrupt to another player', () => {
  it('hands everything straight over, with no auction', () => {
    const debtor = makePlayer('p1', 'Ada', 20);
    const creditor = makePlayer('p2', 'Grace', 500);
    const state = makeGame([debtor, creditor]);
    give(state, debtor, TILE.oldKent);
    give(state, debtor, TILE.whitechapel);
    debtor.heldCards.push('chance-get-out-of-jail-free');
    state.decks.CHANCE = state.decks.CHANCE.filter(
      (id) => id !== 'chance-get-out-of-jail-free',
    );

    const result = charge(state, debtor.id, 5000, creditor.id);

    expect(result.bankrupt).toBe(true);
    // The Bank auctions nothing: the creditor takes it all.
    expect(state.pendingAuctions).toEqual([]);
    expect(result.toAuction).toEqual([]);

    expect(creditor.properties).toEqual(
      expect.arrayContaining([TILE.oldKent, TILE.whitechapel]),
    );
    expect(state.properties[TILE.oldKent]!.ownerId).toBe(creditor.id);
    expect(creditor.heldCards).toEqual(['chance-get-out-of-jail-free']);
    // The card went to the creditor, not back to the deck.
    expect(state.decks.CHANCE).not.toContain('chance-get-out-of-jail-free');
    expect(debtor.properties).toEqual([]);
    expect(debtor.cash).toBe(0);
  });
});
