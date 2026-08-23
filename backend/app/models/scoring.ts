import { HOTEL_LEVEL, getTile, isOwnable, mortgageValue } from './board.js';
import type { GameState, VariantRules } from './types.js';

/**
 * A player's worth by the valuation the rulebook prints for the short and
 * time-limit games, where the richest player wins rather than the last one
 * standing. In order, it counts:
 *
 *   1. cash in hand;
 *   2. Sites, Utilities and Stations at the price printed on the board;
 *   3. any mortgaged property at half that printed price;
 *   4. Houses at their purchase price;
 *   5. Hotels at purchase price including the Houses handed back for them.
 *
 * A Hotel costs one House price plus the Houses it consumed, so its worth
 * depends on the variant: four Houses in the standard game, three in the
 * short one.
 */
export function netWorth(
  state: GameState,
  playerId: string,
  rules: VariantRules,
): number {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) throw new Error(`No player ${playerId} in game ${state.id}`);

  let total = player.cash;

  for (const position of player.properties) {
    const tile = getTile(position);
    if (!isOwnable(tile)) {
      throw new Error(`Player ${playerId} holds unownable tile ${position}`);
    }
    const holding = state.properties[position];

    // A mortgaged deed is worth what the Bank lent on it; anything else the
    // full printed price.
    total += holding?.mortgaged ? mortgageValue(tile) : tile.price;

    if (tile.kind !== 'PROPERTY' || !holding) continue;
    total +=
      holding.houses === HOTEL_LEVEL
        ? tile.houseCost * (rules.housesPerHotel + 1)
        : tile.houseCost * holding.houses;
  }

  return total;
}

/**
 * Ids of the players tied for richest, by netWorth. The short and time-limit
 * games end on this rather than on a last player standing.
 */
export function richestPlayerIds(state: GameState, rules: VariantRules): string[] {
  const scored = state.players
    .filter((p) => !p.bankrupt)
    .map((p) => ({ id: p.id, worth: netWorth(state, p.id, rules) }));
  const best = Math.max(...scored.map((s) => s.worth));
  return scored.filter((s) => s.worth === best).map((s) => s.id);
}
