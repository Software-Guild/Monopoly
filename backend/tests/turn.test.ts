import { describe, expect, it } from 'vitest';
import { JAIL_POSITION, STARTING_CASH } from '../app/models/index.js';
import type { GameState, Pending } from '../app/models/index.js';
import {
  AiAgent,
  HumanAgent,
  advanceToNextPlayer,
  auction,
  runGame,
  takeTurn,
} from '../app/engine/index.js';
import type { AgentsByPlayer, Decision, PlayerAgent } from '../app/engine/index.js';
import { TILE, give, makeGame, makePlayer, ownEverything, scriptedRoller } from './helpers.js';

/** Rolls when asked, but never buys and never bids: keeps movement tests quiet. */
function quietAgent(playerId: string): PlayerAgent {
  return {
    playerId,
    decide(_state: GameState, pending: Pending): Promise<Decision> {
      switch (pending.type) {
        case 'ROLL':
          return Promise.resolve({ type: 'ROLL' });
        case 'BUY_PROPERTY':
          return Promise.resolve({ type: 'BUY_PROPERTY', buy: false });
        case 'AUCTION_BID':
          return Promise.resolve({ type: 'AUCTION_BID', bid: null });
        case 'JAIL_DECISION':
          return Promise.resolve({ type: 'JAIL_DECISION', action: 'ROLL' });
        default:
          throw new Error(`quietAgent cannot answer ${pending.type}`);
      }
    },
  };
}

const agentsFor = (...agents: PlayerAgent[]): AgentsByPlayer =>
  new Map(agents.map((a) => [a.playerId, a]));

/** Let pending promises settle without resolving the human's decision. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('doubles', () => {
  it('rolls again after a double and stops after a plain roll', async () => {
    const state = makeGame();
    const [ada, grace] = [state.players[0]!, state.players[1]!];
    ownEverything(state, grace); // nothing to buy, no auctions

    await takeTurn(state, agentsFor(quietAgent(ada.id), quietAgent(grace.id)), {
      roll: scriptedRoller([
        [5, 5], // double: 0 -> 10, go again
        [2, 4], // plain: 10 -> 16, turn ends
        [6, 6], // must not be used
      ]),
    });

    expect(ada.position).toBe(16);
    expect(state.doublesCount).toBe(1);
    expect(ada.inJail).toBe(false);
  });

  it('sends a player to Jail on the third double, before they move', async () => {
    const state = makeGame();
    const [ada, grace] = [state.players[0]!, state.players[1]!];
    ownEverything(state, grace);

    await takeTurn(state, agentsFor(quietAgent(ada.id), quietAgent(grace.id)), {
      roll: scriptedRoller([
        [5, 5], // 0 -> 10
        [2, 2], // 10 -> 14
        [1, 1], // third double: straight to Jail
      ]),
    });

    expect(ada.position).toBe(JAIL_POSITION);
    expect(ada.inJail).toBe(true);
    expect(state.doublesCount).toBe(0); // reset on the way to Jail
  });
});

describe('resolving the tile landed on', () => {
  it('charges rent to the owner', async () => {
    const state = makeGame();
    const [ada, grace] = [state.players[0]!, state.players[1]!];
    ada.position = 33;
    give(state, grace, TILE.mayfair);

    await takeTurn(state, agentsFor(quietAgent(ada.id), quietAgent(grace.id)), {
      roll: scriptedRoller([[2, 4]]), // 33 -> 39, Mayfair
    });

    expect(ada.position).toBe(TILE.mayfair);
    expect(ada.cash).toBe(STARTING_CASH - 50);
    expect(grace.cash).toBe(STARTING_CASH + 50);
  });

  it('lets an AI buy an unowned tile it can afford', async () => {
    const state = makeGame();
    const [ada, grace] = [state.players[0]!, state.players[1]!];

    await takeTurn(state, agentsFor(new AiAgent(ada.id), new AiAgent(grace.id)), {
      roll: scriptedRoller([[1, 2]]), // 0 -> 3, Whitechapel Road at 60
    });

    expect(state.properties[TILE.whitechapel]!.ownerId).toBe(ada.id);
    expect(ada.properties).toContain(TILE.whitechapel);
    expect(ada.cash).toBe(STARTING_CASH - 60);
  });

  it('sends a declined tile to auction, and the bidder gets it', async () => {
    const state = makeGame();
    const [ada, grace] = [state.players[0]!, state.players[1]!];

    await takeTurn(state, agentsFor(quietAgent(ada.id), new AiAgent(grace.id)), {
      roll: scriptedRoller([[1, 2]]), // Ada lands on Whitechapel and declines
    });

    expect(state.properties[TILE.whitechapel]!.ownerId).toBe(grace.id);
    expect(grace.cash).toBeLessThan(STARTING_CASH);
    expect(ada.cash).toBe(STARTING_CASH);
  });

  it('leaves a tile with the Bank when nobody bids', async () => {
    const state = makeGame();
    const [ada, grace] = [state.players[0]!, state.players[1]!];

    await auction(state, TILE.mayfair, agentsFor(quietAgent(ada.id), quietAgent(grace.id)));

    expect(state.properties[TILE.mayfair]!.ownerId).toBeNull();
  });
});

describe('a human turn', () => {
  it('pauses until the player clicks, then carries on', async () => {
    const state = makeGame();
    const [ada, grace] = [state.players[0]!, state.players[1]!];
    ownEverything(state, grace);
    const human = new HumanAgent(ada.id);

    let finished = false;
    const turn = takeTurn(state, agentsFor(human, quietAgent(grace.id)), {
      roll: scriptedRoller([[2, 3]]),
    }).then(() => {
      finished = true;
    });

    await flush();
    // Nothing has happened: the loop is sitting on the await.
    expect(finished).toBe(false);
    expect(human.awaiting?.type).toBe('ROLL');
    expect(ada.position).toBe(0);
    expect(state.pending?.type).toBe('ROLL');

    human.submit({ type: 'ROLL' });
    await turn;

    expect(finished).toBe(true);
    expect(ada.position).toBe(5);
    expect(human.awaiting).toBeNull();
  });

  it('refuses an answer to a question that was not asked', () => {
    const human = new HumanAgent('p1');
    expect(() => human.submit({ type: 'ROLL' })).toThrow(/was not asked/);
  });

  it('refuses an answer of the wrong kind', async () => {
    const state = makeGame();
    const human = new HumanAgent('p1');
    const pending: Pending = { type: 'ROLL', playerId: 'p1', doublesSoFar: 0 };
    void human.decide(state, pending);

    expect(() => human.submit({ type: 'BUY_PROPERTY', buy: true })).toThrow(/answered/);
  });
});

describe('Jail', () => {
  it('spends a held card to get out and then moves', async () => {
    const state = makeGame();
    const [ada, grace] = [state.players[0]!, state.players[1]!];
    ownEverything(state, grace);
    ada.inJail = true;
    ada.position = JAIL_POSITION;
    ada.heldCards.push('chance-get-out-of-jail-free');
    state.decks.CHANCE = state.decks.CHANCE.filter((id) => id !== 'chance-get-out-of-jail-free');

    await takeTurn(state, agentsFor(new AiAgent(ada.id), quietAgent(grace.id)), {
      roll: scriptedRoller([[2, 3]]),
    });

    expect(ada.inJail).toBe(false);
    expect(ada.heldCards).toEqual([]);
    expect(ada.position).toBe(15);
    // The card goes back to the bottom of its own pile.
    expect(state.decks.CHANCE.at(-1)).toBe('chance-get-out-of-jail-free');
  });

  it('stays in Jail after a failed roll', async () => {
    const state = makeGame();
    const [ada, grace] = [state.players[0]!, state.players[1]!];
    ada.inJail = true;
    ada.position = JAIL_POSITION;

    await takeTurn(state, agentsFor(quietAgent(ada.id), quietAgent(grace.id)), {
      roll: scriptedRoller([[2, 3]]),
    });

    expect(ada.inJail).toBe(true);
    expect(ada.jailTurns).toBe(1);
    expect(ada.position).toBe(JAIL_POSITION);
    expect(ada.cash).toBe(STARTING_CASH);
  });

  it('leaves Jail immediately on a double, without an extra turn', async () => {
    const state = makeGame();
    const [ada, grace] = [state.players[0]!, state.players[1]!];
    ownEverything(state, grace);
    ada.inJail = true;
    ada.position = JAIL_POSITION;

    await takeTurn(state, agentsFor(quietAgent(ada.id), quietAgent(grace.id)), {
      roll: scriptedRoller([
        [3, 3], // the double that frees them: 10 -> 16
        [6, 6], // must not be used
      ]),
    });

    expect(ada.inJail).toBe(false);
    expect(ada.position).toBe(16);
  });

  it('pays the fine after the third failed attempt and still moves', async () => {
    const state = makeGame();
    const [ada, grace] = [state.players[0]!, state.players[1]!];
    ownEverything(state, grace);
    ada.inJail = true;
    ada.position = JAIL_POSITION;
    ada.jailTurns = 2; // two attempts already failed

    await takeTurn(state, agentsFor(quietAgent(ada.id), quietAgent(grace.id)), {
      roll: scriptedRoller([[6, 4]]), // 10 -> 20, Free Parking, so only the fine shows
    });

    expect(ada.inJail).toBe(false);
    expect(ada.jailTurns).toBe(0);
    expect(ada.cash).toBe(STARTING_CASH - 50);
    expect(ada.position).toBe(TILE.freeParking);
  });
});

describe('the loop', () => {
  it('hands play to the next solvent player', () => {
    const state = makeGame([
      makePlayer('p1', 'Ada'),
      makePlayer('p2', 'Grace'),
      makePlayer('p3', 'Alan'),
    ]);
    state.players[1]!.bankrupt = true;

    advanceToNextPlayer(state);

    expect(state.currentPlayerIndex).toBe(2); // Grace is skipped
    expect(state.turnCount).toBe(2);
  });

  it('runs an all-AI game without pausing, and stops itself', async () => {
    const state = makeGame();

    await runGame(state, agentsFor(new AiAgent('p1'), new AiAgent('p2')), {
      roll: scriptedRoller([
        [3, 4],
        [2, 5],
        [1, 3],
        [6, 2],
        [4, 1],
        [5, 3],
      ]),
      maxTurns: 40,
    });

    expect(state.turnCount).toBeGreaterThan(1);
    expect(state.pending).toBeNull();
    // Somebody bought something: the AI is actually playing, not just moving.
    const owned = Object.values(state.properties).filter((p) => p.ownerId !== null);
    expect(owned.length).toBeGreaterThan(0);
  });

  it('finishes when only one player is left standing', async () => {
    const state = makeGame();
    state.players[1]!.bankrupt = true;

    await runGame(state, agentsFor(new AiAgent('p1'), new AiAgent('p2')), {
      roll: scriptedRoller([[3, 4]]),
      maxTurns: 5,
    });

    expect(state.phase).toBe('FINISHED');
    expect(state.winnerId).toBe('p1');
  });
});
