import { describe, expect, it } from 'vitest';
import { HOTEL_LEVEL, HOUSE_SUPPLY } from '../app/models/index.js';
import { buildHouse, buildableSites, canBuild } from '../app/engine/index.js';
import { TILE, give, housesOn, makeGame, makePlayer } from './helpers.js';

const BROWN = [TILE.oldKent, TILE.whitechapel];
const LIGHT_BLUE = [TILE.angel, TILE.euston, TILE.pentonville];

/** A player holding the whole brown group, unbuilt. */
function withBrownGroup() {
  const owner = makePlayer('p1', 'Ada', 2000);
  const state = makeGame([owner, makePlayer('p2', 'Grace')]);
  BROWN.forEach((p) => give(state, owner, p));
  return { state, owner };
}

describe('a full colour group is required', () => {
  it('refuses a Site whose group is not complete', () => {
    const owner = makePlayer('p1', 'Ada', 2000);
    const state = makeGame([owner, makePlayer('p2', 'Grace')]);
    give(state, owner, TILE.oldKent); // Whitechapel still with the Bank

    expect(canBuild(state, owner.id, TILE.oldKent).refusal).toBe('INCOMPLETE_GROUP');
    expect(buildHouse(state, owner.id, TILE.oldKent).built).toBe(false);
  });

  it('allows it once the group is complete', () => {
    const { state, owner } = withBrownGroup();
    expect(canBuild(state, owner.id, TILE.oldKent)).toMatchObject({ allowed: true, cost: 50 });
    expect(buildHouse(state, owner.id, TILE.oldKent).built).toBe(true);
    expect(state.properties[TILE.oldKent]!.houses).toBe(1);
  });

  it('refuses a Site somebody else owns', () => {
    const { state } = withBrownGroup();
    expect(canBuild(state, 'p2', TILE.oldKent).refusal).toBe('NOT_THE_OWNER');
  });

  it('refuses a Station, which can never be built on', () => {
    const { state, owner } = withBrownGroup();
    give(state, owner, TILE.kingsCross);
    expect(canBuild(state, owner.id, TILE.kingsCross).refusal).toBe('NOT_A_SITE');
  });

  it('refuses while any Site in the group is mortgaged', () => {
    const { state, owner } = withBrownGroup();
    state.properties[TILE.whitechapel]!.mortgaged = true;
    expect(canBuild(state, owner.id, TILE.oldKent).refusal).toBe('GROUP_MORTGAGED');
  });
});

describe('houses go up evenly', () => {
  it('refuses a second House until every Site has its first', () => {
    const { state, owner } = withBrownGroup();
    buildHouse(state, owner.id, TILE.oldKent); // brown now 1, 0

    expect(canBuild(state, owner.id, TILE.oldKent).refusal).toBe('UNEVEN');
    expect(canBuild(state, owner.id, TILE.whitechapel).allowed).toBe(true);
  });

  it('allows the second round once the group is level', () => {
    const { state, owner } = withBrownGroup();
    buildHouse(state, owner.id, TILE.oldKent);
    buildHouse(state, owner.id, TILE.whitechapel); // 1, 1

    expect(canBuild(state, owner.id, TILE.oldKent).allowed).toBe(true);
    buildHouse(state, owner.id, TILE.oldKent);
    expect(housesOn(state, BROWN)).toEqual([2, 1]);
    expect(canBuild(state, owner.id, TILE.oldKent).refusal).toBe('UNEVEN');
  });

  it('keeps a three-Site group even too', () => {
    const owner = makePlayer('p1', 'Ada', 3000);
    const state = makeGame([owner, makePlayer('p2', 'Grace')]);
    LIGHT_BLUE.forEach((p) => give(state, owner, p));

    buildHouse(state, owner.id, TILE.angel);
    buildHouse(state, owner.id, TILE.euston);
    expect(canBuild(state, owner.id, TILE.angel).refusal).toBe('UNEVEN');
    expect(canBuild(state, owner.id, TILE.pentonville).allowed).toBe(true);

    buildHouse(state, owner.id, TILE.pentonville);
    expect(housesOn(state, LIGHT_BLUE)).toEqual([1, 1, 1]);
    expect(buildableSites(state, owner.id).sort()).toEqual([...LIGHT_BLUE].sort());
  });
});

describe('hotels', () => {
  /** Build the brown group evenly up to `level` houses each. */
  function buildTo(state: ReturnType<typeof withBrownGroup>['state'], id: string, level: number) {
    for (let round = 0; round < level; round += 1) {
      for (const position of BROWN) buildHouse(state, id, position);
    }
  }

  it('refuses a Hotel until every Site in the group has four Houses', () => {
    const { state, owner } = withBrownGroup();
    buildTo(state, owner.id, 3); // 3, 3
    buildHouse(state, owner.id, TILE.oldKent); // 4, 3

    expect(canBuild(state, owner.id, TILE.oldKent)).toMatchObject({
      hotel: true,
      refusal: 'GROUP_NOT_READY_FOR_HOTEL',
    });

    buildHouse(state, owner.id, TILE.whitechapel); // 4, 4
    expect(canBuild(state, owner.id, TILE.oldKent).allowed).toBe(true);
  });

  it('hands the four Houses back to the Bank when the Hotel goes up', () => {
    const { state, owner } = withBrownGroup();
    buildTo(state, owner.id, 4);
    expect(state.bank.houses).toBe(HOUSE_SUPPLY - 8);
    const hotels = state.bank.hotels;

    expect(buildHouse(state, owner.id, TILE.oldKent).built).toBe(true);

    expect(state.properties[TILE.oldKent]!.houses).toBe(HOTEL_LEVEL);
    expect(state.bank.hotels).toBe(hotels - 1);
    expect(state.bank.houses).toBe(HOUSE_SUPPLY - 8 + 4);
  });

  it('refuses to build on a Site that already has a Hotel', () => {
    const { state, owner } = withBrownGroup();
    buildTo(state, owner.id, 4);
    buildHouse(state, owner.id, TILE.oldKent);
    expect(canBuild(state, owner.id, TILE.oldKent).refusal).toBe('ALREADY_A_HOTEL');
  });

  it('needs only three Houses per Site in the short game', () => {
    const { state, owner } = withBrownGroup();
    state.variant = 'SHORT';
    buildTo(state, owner.id, 3); // 3, 3

    const check = canBuild(state, owner.id, TILE.oldKent);
    expect(check).toMatchObject({ allowed: true, hotel: true });
    buildHouse(state, owner.id, TILE.oldKent);
    expect(state.properties[TILE.oldKent]!.houses).toBe(HOTEL_LEVEL);
    // Only the three Houses it swallowed come back.
    expect(state.bank.houses).toBe(HOUSE_SUPPLY - 6 + 3);
  });
});

describe('what the Bank and the wallet allow', () => {
  it('refuses when the Bank has no Houses left', () => {
    const { state, owner } = withBrownGroup();
    state.bank.houses = 0;
    expect(canBuild(state, owner.id, TILE.oldKent).refusal).toBe('BANK_HAS_NO_HOUSES');
  });

  it('refuses a Hotel when the Bank has none left', () => {
    const { state, owner } = withBrownGroup();
    for (let round = 0; round < 4; round += 1) {
      for (const position of BROWN) buildHouse(state, owner.id, position);
    }
    state.bank.hotels = 0;
    expect(canBuild(state, owner.id, TILE.oldKent).refusal).toBe('BANK_HAS_NO_HOTELS');
  });

  it('refuses rather than mortgaging to raise the price', () => {
    const owner = makePlayer('p1', 'Ada', 30); // a House costs 50
    const state = makeGame([owner, makePlayer('p2', 'Grace')]);
    BROWN.forEach((p) => give(state, owner, p));

    expect(canBuild(state, owner.id, TILE.oldKent).refusal).toBe('CANNOT_AFFORD');
    expect(buildHouse(state, owner.id, TILE.oldKent).built).toBe(false);
    expect(owner.cash).toBe(30);
    expect(state.properties[TILE.oldKent]!.mortgaged).toBe(false);
  });

  it('charges the printed House price', () => {
    const { state, owner } = withBrownGroup();
    buildHouse(state, owner.id, TILE.oldKent);
    expect(owner.cash).toBe(2000 - 50);
  });
});
