import { describe, expect, it } from 'vitest';
import { HOTEL_LEVEL, getCard } from '../app/models/index.js';
import { charge } from '../app/engine/index.js';
import { TILE, give, housesOn, makeGame, makePlayer } from './helpers.js';

const LIGHT_BLUE = [TILE.angel, TILE.euston, TILE.pentonville];

describe('charge: paying from cash', () => {
  it('moves money between two players', () => {
    const state = makeGame();
    const [payer, creditor] = [state.players[0]!, state.players[1]!];

    const result = charge(state, payer.id, 200, creditor.id);

    expect(result).toMatchObject({ paid: 200, bankrupt: false });
    expect(payer.cash).toBe(1300);
    expect(creditor.cash).toBe(1700);
  });

  it('pays the Bank without crediting anyone', () => {
    const state = makeGame();
    const payer = state.players[0]!;

    const result = charge(state, payer.id, 100, null);

    expect(result.paid).toBe(100);
    expect(payer.cash).toBe(1400);
    expect(state.players[1]!.cash).toBe(1500);
  });

  it('ignores a charge of nothing', () => {
    const state = makeGame();
    expect(charge(state, 'p1', 0, null)).toMatchObject({ paid: 0, bankrupt: false });
    expect(state.players[0]!.cash).toBe(1500);
  });
});

describe('charge: raising funds', () => {
  it('mortgages an unbuilt deed before touching any buildings', () => {
    const payer = makePlayer('p1', 'Ada', 0);
    const creditor = makePlayer('p2', 'Grace');
    const state = makeGame([payer, creditor]);
    give(state, payer, TILE.oldKent); // unbuilt, mortgages for 30
    LIGHT_BLUE.forEach((p) => give(state, payer, p, { houses: 2 }));

    const result = charge(state, payer.id, 30, creditor.id);

    expect(result.bankrupt).toBe(false);
    expect(state.properties[TILE.oldKent]!.mortgaged).toBe(true);
    expect(housesOn(state, LIGHT_BLUE)).toEqual([2, 2, 2]);
  });

  it('sells from the highest-built Site in the group, not the most valuable one', () => {
    const payer = makePlayer('p1', 'Ada', 0);
    const state = makeGame([payer, makePlayer('p2', 'Grace')]);
    // Pentonville is the dearest of the group but stands one House lower,
    // so an even sale must come off The Angel.
    give(state, payer, TILE.angel, { houses: 3 });
    give(state, payer, TILE.euston, { houses: 2 });
    give(state, payer, TILE.pentonville, { houses: 2 });
    const bankHouses = state.bank.houses;

    const result = charge(state, payer.id, 25, null); // one House sells for 25

    expect(result.bankrupt).toBe(false);
    expect(housesOn(state, LIGHT_BLUE)).toEqual([2, 2, 2]);
    expect(state.bank.houses).toBe(bankHouses + 1);
    expect(payer.cash).toBe(0);
  });

  it('keeps selling evenly across the group as the debt grows', () => {
    const payer = makePlayer('p1', 'Ada', 0);
    const state = makeGame([payer, makePlayer('p2', 'Grace')]);
    LIGHT_BLUE.forEach((p) => give(state, payer, p, { houses: 2 }));

    charge(state, payer.id, 75, null); // three Houses at 25 each

    // Every Site drops by one rather than one Site being stripped.
    expect(housesOn(state, LIGHT_BLUE)).toEqual([1, 1, 1]);
  });

  it('breaks a Hotel back into Houses when the Bank has them', () => {
    const payer = makePlayer('p1', 'Ada', 0);
    const state = makeGame([payer, makePlayer('p2', 'Grace')]);
    give(state, payer, TILE.mayfair, { houses: HOTEL_LEVEL });
    give(state, payer, TILE.parkLane, { houses: HOTEL_LEVEL });
    const bankHouses = state.bank.houses;
    const bankHotels = state.bank.hotels;

    charge(state, payer.id, 100, null); // half of Mayfair houseCost 200

    expect(state.properties[TILE.mayfair]!.houses).toBe(4);
    expect(state.bank.hotels).toBe(bankHotels + 1);
    expect(state.bank.houses).toBe(bankHouses - 4);
  });

  it('sells a Hotel whole when the Bank has no Houses to replace it', () => {
    const payer = makePlayer('p1', 'Ada', 0);
    const state = makeGame([payer, makePlayer('p2', 'Grace')]);
    give(state, payer, TILE.mayfair, { houses: HOTEL_LEVEL });
    state.bank.houses = 0;

    charge(state, payer.id, 500, null);

    // Hotel plus the four Houses it swallowed, all at half price: 100 x 5.
    expect(state.properties[TILE.mayfair]!.houses).toBe(0);
    expect(payer.cash).toBe(0);
  });
});

describe('charge: bankruptcy to another player', () => {
  it('hands over cash, deeds and cards, and charges interest on mortgages', () => {
    const debtor = makePlayer('p1', 'Ada', 10);
    const creditor = makePlayer('p2', 'Grace', 1000);
    const state = makeGame([debtor, creditor]);
    give(state, debtor, TILE.oldKent, { mortgaged: true }); // mortgage value 30
    debtor.heldCards.push('chance-get-out-of-jail-free');

    const result = charge(state, debtor.id, 500, creditor.id);

    expect(result.bankrupt).toBe(true);
    expect(result.paid).toBe(10);
    expect(result.mortgagedReceived).toEqual([TILE.oldKent]);

    expect(debtor.bankrupt).toBe(true);
    expect(debtor.cash).toBe(0);
    expect(debtor.properties).toEqual([]);
    expect(debtor.heldCards).toEqual([]);

    // 1000 + 10 taken over, less the 10% interest of 3 on the mortgage.
    expect(creditor.cash).toBe(1007);
    expect(creditor.properties).toContain(TILE.oldKent);
    expect(creditor.heldCards).toEqual(['chance-get-out-of-jail-free']);
    expect(state.properties[TILE.oldKent]!.ownerId).toBe(creditor.id);
    expect(state.properties[TILE.oldKent]!.mortgaged).toBe(true);
  });

  it('sells the buildings to the Bank and passes the money to the creditor', () => {
    const debtor = makePlayer('p1', 'Ada', 0);
    const creditor = makePlayer('p2', 'Grace', 0);
    const state = makeGame([debtor, creditor]);
    give(state, debtor, TILE.mayfair, { houses: 2 });
    state.bank.houses = 0; // nothing to mortgage against, buildings must go

    const result = charge(state, debtor.id, 5000, creditor.id);

    expect(result.bankrupt).toBe(true);
    expect(state.properties[TILE.mayfair]!.houses).toBe(0);
    expect(creditor.properties).toContain(TILE.mayfair);
    // Two Houses at half of 200 and the 200 the mortgage raised make 400,
    // less the 20 interest the creditor owes on inheriting it mortgaged.
    expect(creditor.cash).toBe(380);
    expect(result.mortgagedReceived).toEqual([TILE.mayfair]);
  });
});

describe('charge: bankruptcy to the Bank', () => {
  it('returns the deeds for auction and the cards to the bottom of the pile', () => {
    const debtor = makePlayer('p1', 'Ada', 5);
    const state = makeGame([debtor, makePlayer('p2', 'Grace')]);
    give(state, debtor, TILE.oldKent, { mortgaged: true });
    const cardId = 'chest-get-out-of-jail-free';
    debtor.heldCards.push(cardId);
    state.decks.COMMUNITY_CHEST = state.decks.COMMUNITY_CHEST.filter((id) => id !== cardId);

    const result = charge(state, debtor.id, 900, null);

    expect(result).toMatchObject({ bankrupt: true, paid: 5 });
    expect(result.toAuction).toEqual([TILE.oldKent]);

    const holding = state.properties[TILE.oldKent]!;
    expect(holding.ownerId).toBeNull();
    expect(holding.mortgaged).toBe(false);
    expect(getCard(cardId).deck).toBe('COMMUNITY_CHEST');
    expect(state.decks.COMMUNITY_CHEST.at(-1)).toBe(cardId);
    expect(debtor.bankrupt).toBe(true);
  });
});
