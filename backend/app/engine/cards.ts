import {
  HOTEL_LEVEL,
  getCard,
  getTile,
  nearestTileOfKind,
} from '../models/index.js';
import type { Card, DeckName, GameState, Player } from '../models/index.js';
import { log } from './log.js';
import { advanceTo, goToJail, moveRelative } from './movement.js';
import { charge } from './payments.js';

/**
 * What resolving a card left for the caller to finish.
 *
 * A card that moves the token means the tile it landed on still has to be
 * resolved -- "Advance to Trafalgar Square" collects rent if someone owns
 * it -- and `rentMultiplier` carries the override the two "nearest" cards
 * apply when they do.
 */
export interface CardOutcome {
  card: Card;
  /** True when the token moved and the new tile still needs resolving. */
  moved: boolean;
  /** Rent override for the tile just moved to, if the card set one. */
  rentMultiplier?: number;
}

/** Take the top card of a deck, leaving the pile in a usable state. */
export function drawCard(state: GameState, deck: DeckName): Card {
  const pile = state.decks[deck];
  const id = pile.shift();
  if (!id) throw new Error(`The ${deck} pile is empty`);
  return getCard(id);
}

/** Put a card face down at the bottom of its own pile. */
export function returnCard(state: GameState, card: Card): void {
  state.decks[card.deck].push(card.id);
}

function solventOthers(state: GameState, player: Player): Player[] {
  return state.players.filter((p) => p.id !== player.id && !p.bankrupt);
}

/** Houses and Hotels standing on everything a player owns. */
function buildingsOf(state: GameState, player: Player): { houses: number; hotels: number } {
  let houses = 0;
  let hotels = 0;
  for (const position of player.properties) {
    const built = state.properties[position]?.houses ?? 0;
    if (built === HOTEL_LEVEL) hotels += 1;
    else houses += built;
  }
  return { houses, hotels };
}

/**
 * Draw the top card of a deck and carry out what it says.
 *
 * A "Get Out of Jail Free" card is kept by the player and so does not go
 * back to the pile; everything else returns to the bottom once resolved,
 * exactly as the rulebook describes.
 */
export function drawAndApply(
  state: GameState,
  player: Player,
  deck: DeckName,
  diceTotal: number,
): CardOutcome {
  const card = drawCard(state, deck);
  log(state, `${player.name} drew: ${card.text}`);

  const outcome = applyEffect(state, player, card, diceTotal);
  if (!card.retainable) returnCard(state, card);
  return outcome;
}

function applyEffect(
  state: GameState,
  player: Player,
  card: Card,
  diceTotal: number,
): CardOutcome {
  const effect = card.effect;
  const still: CardOutcome = { card, moved: false };

  switch (effect.type) {
    case 'MOVE_TO':
      advanceTo(state, player, effect.position, effect.collectGoSalary);
      return { card, moved: true };

    case 'MOVE_RELATIVE':
      moveRelative(state, player, effect.offset);
      return { card, moved: true };

    case 'MOVE_TO_NEAREST': {
      const target = nearestTileOfKind(player.position, effect.kind);
      advanceTo(state, player, target.position, effect.collectGoSalary);
      return { card, moved: true, rentMultiplier: effect.rentMultiplier };
    }

    case 'COLLECT':
      player.cash += effect.amount;
      log(state, `${player.name} collected ${effect.amount} from the Bank.`);
      return still;

    case 'PAY':
      charge(state, player.id, effect.amount, null);
      return still;

    case 'COLLECT_FROM_EACH':
      for (const other of solventOthers(state, player)) {
        charge(state, other.id, effect.amount, player.id);
      }
      return still;

    case 'PAY_EACH':
      for (const other of solventOthers(state, player)) {
        charge(state, player.id, effect.amount, other.id);
        if (player.bankrupt) break;
      }
      return still;

    case 'GO_TO_JAIL':
      goToJail(state, player);
      return still;

    case 'GET_OUT_OF_JAIL_FREE':
      player.heldCards.push(card.id);
      log(state, `${player.name} kept the ${card.deck} Get Out of Jail Free card.`);
      return still;

    case 'REPAIRS': {
      const { houses, hotels } = buildingsOf(state, player);
      const owed = houses * effect.perHouse + hotels * effect.perHotel;
      log(state, `${player.name} owes ${owed} for ${houses} Houses and ${hotels} Hotels.`);
      charge(state, player.id, owed, null);
      return still;
    }
  }
}

/**
 * Play a held Get Out of Jail Free card, returning it to the bottom of its
 * pile. Returns false when the player holds none.
 */
export function useJailCard(state: GameState, player: Player): boolean {
  const cardId = player.heldCards.shift();
  if (!cardId) return false;
  const card = getCard(cardId);
  returnCard(state, card);
  player.inJail = false;
  player.jailTurns = 0;
  log(state, `${player.name} used a Get Out of Jail Free card.`);
  return true;
}

/** The deck a Chance or Community Chest tile draws from. */
export function deckForTile(position: number): DeckName | null {
  const kind = getTile(position).kind;
  if (kind === 'CHANCE') return 'CHANCE';
  if (kind === 'COMMUNITY_CHEST') return 'COMMUNITY_CHEST';
  return null;
}
