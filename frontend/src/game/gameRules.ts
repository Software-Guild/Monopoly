import { boardData, purchasableSpaces } from "../data/boardData";
import type { GameState, PropertySpace } from "../types/game";

// Presentation selectors only. The backend engine validates and performs
// every game mutation; these helpers merely enable/disable matching UI controls.

export const formatMoney = (amount: number): string => `₹${Math.max(0, Math.round(amount)).toLocaleString("en-IN")}`;

export const getOwnedPropertyIds = (state: GameState, playerId: string): number[] =>
  Object.entries(state.properties)
    .filter(([, status]) => status.ownerId === playerId)
    .map(([id]) => Number(id));

export const ownsCompleteGroup = (state: GameState, playerId: string, group: string): boolean => {
  const groupSpaces = purchasableSpaces.filter((space) => space.propertyKind === "site" && space.group === group);
  return groupSpaces.length > 0 && groupSpaces.every((space) => state.properties[space.id]?.ownerId === playerId);
};

export const groupHasMortgage = (state: GameState, group: string): boolean =>
  purchasableSpaces
    .filter((space) => space.group === group)
    .some((space) => state.properties[space.id]?.mortgaged);

export const groupHasBuildings = (state: GameState, group: string): boolean =>
  purchasableSpaces
    .filter((space) => space.group === group)
    .some((space) => state.properties[space.id]?.houses > 0 || state.properties[space.id]?.hotel);

export const canBuild = (state: GameState, playerId: string, space: PropertySpace): boolean => {
  if (space.propertyKind !== "site" || !space.group || !space.houseCost) return false;
  const status = state.properties[space.id];
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!status || status.ownerId !== playerId || status.hotel || status.houses >= 4 || !player || player.money < space.houseCost) return false;
  if (!ownsCompleteGroup(state, playerId, space.group) || groupHasMortgage(state, space.group)) return false;
  const groupStatuses = purchasableSpaces.filter((candidate) => candidate.group === space.group).map((candidate) => state.properties[candidate.id]);
  const minimumHouses = Math.min(...groupStatuses.map((candidate) => candidate.houses));
  return status.houses === minimumHouses;
};

export const canBuildHotel = (state: GameState, playerId: string, space: PropertySpace): boolean => {
  if (space.propertyKind !== "site" || !space.group || !space.houseCost) return false;
  const status = state.properties[space.id];
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!status || status.ownerId !== playerId || status.hotel || status.houses !== 4 || !player || player.money < space.houseCost) return false;
  return purchasableSpaces
    .filter((candidate) => candidate.group === space.group)
    .every((candidate) => state.properties[candidate.id].houses === 4 && !state.properties[candidate.id].mortgaged);
};

export const canSellBuilding = (state: GameState, playerId: string, space: PropertySpace): boolean => {
  if (space.propertyKind !== "site" || !space.group) return false;
  const status = state.properties[space.id];
  if (!status || status.ownerId !== playerId || (!status.hotel && status.houses === 0)) return false;
  if (status.hotel) return true;
  const groupStatuses = purchasableSpaces.filter((candidate) => candidate.group === space.group).map((candidate) => state.properties[candidate.id]);
  const maximumHouses = Math.max(...groupStatuses.map((candidate) => candidate.hotel ? 5 : candidate.houses));
  return status.houses === maximumHouses;
};

export const canMortgage = (state: GameState, playerId: string, space: PropertySpace): boolean => {
  const status = state.properties[space.id];
  if (!status || status.ownerId !== playerId || status.mortgaged) return false;
  return !space.group || !groupHasBuildings(state, space.group);
};

export const canTradeProperty = (state: GameState, space: PropertySpace): boolean =>
  !space.group || !groupHasBuildings(state, space.group);

export const getPlayerNetWorth = (state: GameState, playerId: string): number => {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) return 0;
  return getOwnedPropertyIds(state, playerId).reduce((total, id) => {
    const space = boardData[id];
    if (space.type !== "property") return total;
    const status = state.properties[id];
    const buildingValue = (status.houses + (status.hotel ? 5 : 0)) * (space.houseCost ?? 0) * 0.5;
    return total + (status.mortgaged ? space.mortgageValue : space.price) + buildingValue;
  }, player.money);
};
