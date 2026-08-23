import type {
  GameState,
  PropertyTransferMethod,
  PropertyTransferRecord,
} from '../models/index.js';

/** Record every deed movement in one backend-authoritative ledger. */
export function recordPropertyTransfer(
  state: GameState,
  transfer: Omit<PropertyTransferRecord, 'id' | 'sequence'>,
): PropertyTransferRecord {
  const sequence = state.propertyTransfers.length + 1;
  const record: PropertyTransferRecord = {
    ...transfer,
    id: `${state.id}-property-${sequence}`,
    sequence,
  };
  state.propertyTransfers.push(record);
  return record;
}

export function recordBankAcquisition(
  state: GameState,
  position: number,
  buyerId: string,
  amount: number,
  method: Extract<PropertyTransferMethod, 'BANK_PURCHASE' | 'AUCTION'>,
): PropertyTransferRecord {
  return recordPropertyTransfer(state, {
    position,
    fromPlayerId: null,
    toPlayerId: buyerId,
    amount,
    method,
  });
}
