import { describe, expect, it } from 'vitest';
import { GO_SALARY, JAIL_POSITION } from '../app/models/index.js';
import { advance, advanceTo, goToJail, moveRelative } from '../app/engine/index.js';
import { TILE, makeGame } from './helpers.js';

describe('advance', () => {
  it('pays the salary for passing Go', () => {
    const state = makeGame();
    const player = state.players[0]!;
    player.position = 38;
    const before = player.cash;

    advance(state, player, 5);

    expect(player.position).toBe(3);
    expect(player.cash).toBe(before + GO_SALARY);
  });

  it('pays the salary for landing exactly on Go', () => {
    const state = makeGame();
    const player = state.players[0]!;
    player.position = 38;
    const before = player.cash;

    advance(state, player, 2);

    expect(player.position).toBe(TILE.go);
    expect(player.cash).toBe(before + GO_SALARY);
  });

  it('pays nothing for a move that does not reach Go', () => {
    const state = makeGame();
    const player = state.players[0]!;
    player.position = 10;
    const before = player.cash;

    advance(state, player, 7);

    expect(player.position).toBe(17);
    expect(player.cash).toBe(before);
  });
});

describe('advanceTo', () => {
  it('pays when a card sends the token forward past Go', () => {
    const state = makeGame();
    const player = state.players[0]!;
    player.position = TILE.liverpool; // 35, so Advance to Go wraps
    const before = player.cash;

    advanceTo(state, player, TILE.go, true);

    expect(player.position).toBe(TILE.go);
    expect(player.cash).toBe(before + GO_SALARY);
  });

  it('pays nothing when the destination is still ahead on this lap', () => {
    const state = makeGame();
    const player = state.players[0]!;
    player.position = TILE.chanceEarly; // 7, Pall Mall at 11 is ahead
    const before = player.cash;

    advanceTo(state, player, TILE.pallMall, true);

    expect(player.position).toBe(TILE.pallMall);
    expect(player.cash).toBe(before);
  });

  it('pays nothing when the card does not offer the salary', () => {
    const state = makeGame();
    const player = state.players[0]!;
    player.position = TILE.liverpool;
    const before = player.cash;

    advanceTo(state, player, TILE.oldKent, false);

    expect(player.position).toBe(TILE.oldKent);
    expect(player.cash).toBe(before);
  });
});

describe('moveRelative', () => {
  it('never pays the salary when a card sends the token backward', () => {
    const state = makeGame();
    const player = state.players[0]!;
    player.position = TILE.chanceEarly;
    const before = player.cash;

    moveRelative(state, player, -3);

    expect(player.position).toBe(TILE.incomeTax);
    expect(player.cash).toBe(before);
  });

  it('pays nothing for a backward move that crosses Go', () => {
    const state = makeGame();
    const player = state.players[0]!;
    player.position = TILE.oldKent;
    const before = player.cash;

    moveRelative(state, player, -3);

    expect(player.position).toBe(38);
    expect(player.cash).toBe(before);
  });
});

describe('goToJail', () => {
  it('takes the token to Jail without a salary, however far it travels', () => {
    const state = makeGame();
    const player = state.players[0]!;
    player.position = TILE.goToJail;
    state.doublesCount = 2;
    const before = player.cash;

    goToJail(state, player);

    expect(player.position).toBe(JAIL_POSITION);
    expect(player.inJail).toBe(true);
    expect(player.jailTurns).toBe(0);
    expect(player.cash).toBe(before);
    expect(state.doublesCount).toBe(0);
  });
});
