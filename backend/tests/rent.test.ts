import { describe, expect, it } from 'vitest';
import { rentFor } from '../app/engine/index.js';
import { TILE, give, makeGame } from './helpers.js';

describe('rentFor', () => {
  it('is nothing while the Bank still holds the deed', () => {
    const state = makeGame();
    expect(rentFor(state, TILE.oldKent, 7)).toBe(0);
  });

  it('is nothing on a mortgaged Property', () => {
    const state = makeGame();
    give(state, state.players[0]!, TILE.oldKent, { mortgaged: true });
    expect(rentFor(state, TILE.oldKent, 7)).toBe(0);
  });

  it('is the printed rent for a lone unbuilt Site', () => {
    const state = makeGame();
    give(state, state.players[0]!, TILE.oldKent);
    expect(rentFor(state, TILE.oldKent, 7)).toBe(2);
  });

  it('doubles on an unbuilt Site when one player holds the whole group', () => {
    const state = makeGame();
    const owner = state.players[0]!;
    give(state, owner, TILE.oldKent);
    give(state, owner, TILE.whitechapel);
    expect(rentFor(state, TILE.oldKent, 7)).toBe(4);
  });

  it('does not double when any Site in the group is mortgaged', () => {
    const state = makeGame();
    const owner = state.players[0]!;
    give(state, owner, TILE.oldKent);
    give(state, owner, TILE.whitechapel, { mortgaged: true });
    expect(rentFor(state, TILE.oldKent, 7)).toBe(2);
  });

  it('uses the built rent, which is never doubled for the group', () => {
    const state = makeGame();
    const owner = state.players[0]!;
    give(state, owner, TILE.oldKent, { houses: 3 });
    give(state, owner, TILE.whitechapel, { houses: 3 });
    expect(rentFor(state, TILE.oldKent, 7)).toBe(90);
  });

  it('charges hotel rent at the top of the table', () => {
    const state = makeGame();
    give(state, state.players[0]!, TILE.mayfair, { houses: 5 });
    expect(rentFor(state, TILE.mayfair, 7)).toBe(2000);
  });
});

describe('rentFor: Stations', () => {
  const stations = [TILE.kingsCross, TILE.marylebone, TILE.fenchurch, TILE.liverpool];

  it.each([
    [1, 25],
    [2, 50],
    [3, 100],
    [4, 200],
  ])('charges %i stations at %i', (owned, expected) => {
    const state = makeGame();
    const owner = state.players[0]!;
    stations.slice(0, owned).forEach((p) => give(state, owner, p));
    expect(rentFor(state, TILE.kingsCross, 7)).toBe(expected);
  });

  it('counts a mortgaged Station towards the tally for the others', () => {
    const state = makeGame();
    const owner = state.players[0]!;
    give(state, owner, TILE.kingsCross);
    give(state, owner, TILE.marylebone, { mortgaged: true });
    // Two owned, so the unmortgaged one charges the two-station rate.
    expect(rentFor(state, TILE.kingsCross, 7)).toBe(50);
    expect(rentFor(state, TILE.marylebone, 7)).toBe(0);
  });

  it('doubles the rent when a Chance card sent the player here', () => {
    const state = makeGame();
    give(state, state.players[0]!, TILE.kingsCross);
    expect(rentFor(state, TILE.kingsCross, 7, 2)).toBe(50);
  });
});

describe('rentFor: Utilities', () => {
  it('charges four times the throw for one Utility', () => {
    const state = makeGame();
    give(state, state.players[0]!, TILE.electric);
    expect(rentFor(state, TILE.electric, 9)).toBe(36);
  });

  it('charges ten times the throw for both', () => {
    const state = makeGame();
    const owner = state.players[0]!;
    give(state, owner, TILE.electric);
    give(state, owner, TILE.waterWorks);
    expect(rentFor(state, TILE.electric, 9)).toBe(90);
  });

  it('charges ten times the throw on the Chance card even with one Utility', () => {
    const state = makeGame();
    give(state, state.players[0]!, TILE.electric);
    expect(rentFor(state, TILE.electric, 9, 10)).toBe(90);
  });
});
