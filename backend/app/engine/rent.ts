import { getTile, isOwnable } from '../models/index.js';
import type { GameState } from '../models/index.js';
import { countOwnedOfKind, groupHasMortgage, ownsWholeGroup } from './holdings.js';

/**
 * Rent owed by a player who stops on `position`. Zero when the tile cannot
 * be owned, is still the Bank's, or is mortgaged -- the rulebook is explicit
 * that no rent is payable on a mortgaged Property.
 *
 * `cardMultiplier` is the override carried by the two "advance to the
 * nearest ..." Chance cards. It means what each card says, which differs by
 * tile kind: on a Station it doubles the rent otherwise owed, and on a
 * Utility it replaces the 4x/10x table with ten times the throw.
 */
export function rentFor(
  state: GameState,
  position: number,
  diceTotal: number,
  cardMultiplier?: number,
): number {
  const tile = getTile(position);
  if (!isOwnable(tile)) return 0;

  const holding = state.properties[position];
  const ownerId = holding?.ownerId;
  if (!holding || !ownerId || holding.mortgaged) return 0;

  switch (tile.kind) {
    case 'PROPERTY': {
      if (holding.houses > 0) return tile.rent[holding.houses] ?? 0;
      // An unbuilt Site rents double for a full colour group, but only while
      // no Site in that group is mortgaged.
      const doubled =
        ownsWholeGroup(state, ownerId, tile.group) && !groupHasMortgage(state, tile.group);
      return tile.rent[0] * (doubled ? 2 : 1);
    }
    case 'RAILROAD': {
      const owned = countOwnedOfKind(state, ownerId, 'RAILROAD');
      return (tile.rent[owned - 1] ?? 0) * (cardMultiplier ?? 1);
    }
    case 'UTILITY': {
      const owned = countOwnedOfKind(state, ownerId, 'UTILITY');
      return (cardMultiplier ?? tile.rentMultiplier[owned - 1] ?? 0) * diceTotal;
    }
  }
}
