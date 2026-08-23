import type { Card, DeckName } from './types.js';

/**
 * The Chance and Community Chest decks as data.
 *
 * Each card pairs its printed `text` (shown to players verbatim) with a
 * structured `effect` the engine switches on. Nothing here knows *how* an
 * effect is applied — that belongs to the rules engine — so no card's
 * behaviour is hardcoded at the point it is drawn.
 *
 * Decks are listed in canonical order and are NOT shuffled. Shuffling is the
 * engine's job, since it owns the RNG and the per-game discard pile.
 */

/* ------------------------------------------------------------------ *
 * Chance — 16 cards
 * ------------------------------------------------------------------ */

export const CHANCE_CARDS: readonly Card[] = [
  {
    id: 'chance-advance-to-go',
    deck: 'CHANCE',
    title: 'Advance to START',
    text: 'Advance to START. Collect ₹200.',
    effect: { type: 'MOVE_TO', position: 0, collectGoSalary: true },
  },
  {
    id: 'chance-advance-trafalgar-square',
    deck: 'CHANCE',
    title: 'Western Express',
    text: 'Advance to Vadodara. If you pass START, collect ₹200.',
    effect: { type: 'MOVE_TO', position: 24, collectGoSalary: true },
  },
  {
    id: 'chance-advance-pall-mall',
    deck: 'CHANCE',
    title: 'Coastal Visit',
    text: 'Advance to Kochi. If you pass START, collect ₹200.',
    effect: { type: 'MOVE_TO', position: 11, collectGoSalary: true },
  },
  {
    id: 'chance-advance-nearest-utility',
    deck: 'CHANCE',
    title: 'Utility Rush',
    text:
      'Advance to the nearest Utility. If unowned, you may buy it from the Bank. ' +
      'If owned, throw dice and pay the owner ten times the amount thrown.',
    effect: {
      type: 'MOVE_TO_NEAREST',
      kind: 'UTILITY',
      collectGoSalary: true,
      // Overrides the usual 4x/10x table: always 10x the roll.
      rentMultiplier: 10,
    },
  },
  {
    // Two identical "nearest Station" cards exist in the real deck. They get
    // distinct ids so a persisted draw is unambiguous.
    id: 'chance-advance-nearest-station-1',
    deck: 'CHANCE',
    title: 'Station Express',
    text:
      'Advance to the nearest Station. If unowned, you may buy it from the Bank. ' +
      'If owned, pay the owner twice the rental to which they are otherwise entitled.',
    effect: {
      type: 'MOVE_TO_NEAREST',
      kind: 'RAILROAD',
      collectGoSalary: true,
      rentMultiplier: 2,
    },
  },
  {
    id: 'chance-advance-nearest-station-2',
    deck: 'CHANCE',
    title: 'Station Express',
    text:
      'Advance to the nearest Station. If unowned, you may buy it from the Bank. ' +
      'If owned, pay the owner twice the rental to which they are otherwise entitled.',
    effect: {
      type: 'MOVE_TO_NEAREST',
      kind: 'RAILROAD',
      collectGoSalary: true,
      rentMultiplier: 2,
    },
  },
  {
    id: 'chance-bank-dividend',
    deck: 'CHANCE',
    title: 'Bank Dividend',
    text: 'Bank pays you a dividend of ₹50.',
    effect: { type: 'COLLECT', amount: 50 },
  },
  {
    id: 'chance-get-out-of-jail-free',
    deck: 'CHANCE',
    title: 'Official Pardon',
    text: 'Get Out of Jail Free. This card may be kept until needed or traded.',
    effect: { type: 'GET_OUT_OF_JAIL_FREE' },
    retainable: true,
  },
  {
    id: 'chance-go-back-three',
    deck: 'CHANCE',
    title: 'Three Steps Back',
    text: 'Go back three spaces.',
    effect: { type: 'MOVE_RELATIVE', offset: -3 },
  },
  {
    id: 'chance-go-to-jail',
    deck: 'CHANCE',
    title: 'Go Directly to Jail',
    text:
      'Go to Jail. Go directly to Jail. Do not pass START, do not collect ₹200.',
    effect: { type: 'GO_TO_JAIL' },
  },
  {
    id: 'chance-general-repairs',
    deck: 'CHANCE',
    title: 'General Repairs',
    text:
      'Make general repairs on all your property. ' +
      'For each house pay ₹25, for each hotel pay ₹100.',
    effect: { type: 'REPAIRS', perHouse: 25, perHotel: 100 },
  },
  {
    id: 'chance-speeding-fine',
    deck: 'CHANCE',
    title: 'Traffic Fine',
    text: 'Pay a traffic fine of ₹25.',
    effect: { type: 'PAY', amount: 25 },
  },
  {
    id: 'chance-trip-to-kings-cross',
    deck: 'CHANCE',
    title: 'Capital Calling',
    text: 'Take a trip to New Delhi Railway Station. If you pass START, collect ₹200.',
    effect: { type: 'MOVE_TO', position: 5, collectGoSalary: true },
  },
  {
    id: 'chance-walk-mayfair',
    deck: 'CHANCE',
    title: 'Southern Express',
    text: 'Advance to Chennai.',
    effect: { type: 'MOVE_TO', position: 37, collectGoSalary: false },
  },
  {
    id: 'chance-chairman-of-the-board',
    deck: 'CHANCE',
    title: 'Board Chairperson',
    text: 'You have been elected Chairperson of the Board. Pay each player ₹50.',
    effect: { type: 'PAY_EACH', amount: 50 },
  },
  {
    id: 'chance-building-loan-matures',
    deck: 'CHANCE',
    title: 'Startup Dividend',
    text: 'Your building loan matures. Collect ₹150.',
    effect: { type: 'COLLECT', amount: 150 },
  },
];

/* ------------------------------------------------------------------ *
 * Community Chest — 16 cards
 * ------------------------------------------------------------------ */

export const COMMUNITY_CHEST_CARDS: readonly Card[] = [
  {
    id: 'chest-advance-to-go',
    deck: 'COMMUNITY_CHEST',
    title: 'Homeward Bound',
    text: 'Advance to START. Collect ₹200.',
    effect: { type: 'MOVE_TO', position: 0, collectGoSalary: true },
  },
  {
    id: 'chest-bank-error',
    deck: 'COMMUNITY_CHEST',
    title: 'Bank Error',
    text: 'Bank error in your favour. Collect ₹200.',
    effect: { type: 'COLLECT', amount: 200 },
  },
  {
    id: 'chest-doctors-fee',
    deck: 'COMMUNITY_CHEST',
    title: "Doctor's Fee",
    text: "Doctor's fee. Pay ₹50.",
    effect: { type: 'PAY', amount: 50 },
  },
  {
    id: 'chest-sale-of-stock',
    deck: 'COMMUNITY_CHEST',
    title: 'Tax Refund',
    text: 'Collect a ₹50 tax refund from the Bank.',
    effect: { type: 'COLLECT', amount: 50 },
  },
  {
    id: 'chest-get-out-of-jail-free',
    deck: 'COMMUNITY_CHEST',
    title: 'Official Pardon',
    text: 'Get Out of Jail Free. This card may be kept until needed or traded.',
    effect: { type: 'GET_OUT_OF_JAIL_FREE' },
    retainable: true,
  },
  {
    id: 'chest-go-to-jail',
    deck: 'COMMUNITY_CHEST',
    title: 'Court Summons',
    text:
      'Go to Jail. Go directly to Jail. Do not pass START, do not collect ₹200.',
    effect: { type: 'GO_TO_JAIL' },
  },
  {
    id: 'chest-holiday-fund',
    deck: 'COMMUNITY_CHEST',
    title: 'Festival Bonus',
    text: 'Holiday fund matures. Receive ₹100.',
    effect: { type: 'COLLECT', amount: 100 },
  },
  {
    id: 'chest-income-tax-refund',
    deck: 'COMMUNITY_CHEST',
    title: 'Income Tax Rebate',
    text: 'Income tax refund. Collect ₹20.',
    effect: { type: 'COLLECT', amount: 20 },
  },
  {
    id: 'chest-birthday',
    deck: 'COMMUNITY_CHEST',
    title: 'Birthday Collection',
    text: 'It is your birthday. Collect ₹10 from every player.',
    effect: { type: 'COLLECT_FROM_EACH', amount: 10 },
  },
  {
    id: 'chest-life-insurance',
    deck: 'COMMUNITY_CHEST',
    title: 'Life Insurance',
    text: 'Life insurance matures. Collect ₹100.',
    effect: { type: 'COLLECT', amount: 100 },
  },
  {
    id: 'chest-hospital-fees',
    deck: 'COMMUNITY_CHEST',
    title: 'Hospital Fees',
    text: 'Pay hospital fees of ₹100.',
    effect: { type: 'PAY', amount: 100 },
  },
  {
    id: 'chest-school-fees',
    deck: 'COMMUNITY_CHEST',
    title: 'School Fees',
    text: 'Pay school fees of ₹50.',
    effect: { type: 'PAY', amount: 50 },
  },
  {
    id: 'chest-consultancy-fee',
    deck: 'COMMUNITY_CHEST',
    title: 'Consultancy Fee',
    text: 'Receive ₹25 consultancy fee.',
    effect: { type: 'COLLECT', amount: 25 },
  },
  {
    id: 'chest-street-repairs',
    deck: 'COMMUNITY_CHEST',
    title: 'Street Repairs',
    text:
      'You are assessed for street repairs. ' +
      '₹40 per house, ₹115 per hotel.',
    effect: { type: 'REPAIRS', perHouse: 40, perHotel: 115 },
  },
  {
    id: 'chest-beauty-contest',
    deck: 'COMMUNITY_CHEST',
    title: 'Beauty Contest',
    text: 'You have won second prize in a beauty contest. Collect ₹10.',
    effect: { type: 'COLLECT', amount: 10 },
  },
  {
    id: 'chest-inheritance',
    deck: 'COMMUNITY_CHEST',
    title: 'Inheritance',
    text: 'You inherit ₹100.',
    effect: { type: 'COLLECT', amount: 100 },
  },
];

/* ------------------------------------------------------------------ *
 * Lookups
 * ------------------------------------------------------------------ */

/** Both decks, keyed by name, so the engine can resolve a deck without a branch. */
export const CARDS_BY_DECK: Record<DeckName, readonly Card[]> = {
  CHANCE: CHANCE_CARDS,
  COMMUNITY_CHEST: COMMUNITY_CHEST_CARDS,
};

/** Every card in both decks. Ids are unique across the whole set. */
export const ALL_CARDS: readonly Card[] = [
  ...CHANCE_CARDS,
  ...COMMUNITY_CHEST_CARDS,
];

const CARDS_BY_ID = new Map(ALL_CARDS.map((card) => [card.id, card]));

/** Look a card up by its persisted id. Throws on an unknown id. */
export function getCard(id: string): Card {
  const card = CARDS_BY_ID.get(id);
  if (!card) throw new Error(`Unknown card id: ${id}`);
  return card;
}
