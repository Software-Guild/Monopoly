import { BOARD, GROUP_POSITIONS } from '../models/index.js';
import type { ColorGroup, GameState, TileKind } from '../models/index.js';

/** Who holds the deed for a tile, or null while the Bank has it. */
export function ownerOf(state: GameState, position: number): string | null {
  return state.properties[position]?.ownerId ?? null;
}

/**
 * How many tiles of a kind a player holds. Mortgaged deeds still count: the
 * rulebook sets Station and Utility rent by the number *owned*, and a
 * mortgage does not transfer ownership. The mortgaged tile itself yields no
 * rent, which rentFor() handles separately.
 */
export function countOwnedOfKind(
  state: GameState,
  ownerId: string,
  kind: TileKind,
): number {
  return BOARD.filter(
    (tile) => tile.kind === kind && ownerOf(state, tile.position) === ownerId,
  ).length;
}

/** True when one player holds every Site in a colour group. */
export function ownsWholeGroup(
  state: GameState,
  ownerId: string,
  group: ColorGroup,
): boolean {
  return GROUP_POSITIONS[group].every((p) => ownerOf(state, p) === ownerId);
}

/**
 * True when any Site in the group is mortgaged. The rulebook voids the
 * double rent on unbuilt Sites when this happens, even for a full group.
 */
export function groupHasMortgage(state: GameState, group: ColorGroup): boolean {
  return GROUP_POSITIONS[group].some((p) => state.properties[p]?.mortgaged === true);
}
