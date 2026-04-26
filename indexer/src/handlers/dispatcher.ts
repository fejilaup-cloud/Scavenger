import { PoolClient } from 'pg';
import { RawContractEvent } from '../types';
import {
  handleWasteRegistered,
  handleParticipantRegistered,
  handleWasteTransferred,
  handleWasteConfirmed,
  handleTokensRewarded,
  handleWasteDeactivated,
  handleWasteGraded,
  handleProcessingStatusChanged,
  handleWasteContaminated,
  handleAuctionCreated,
  handleAuctionEnded,
  handleCarbonCreditsEarned,
} from './eventHandlers';

const HANDLERS: Record<string, (client: PoolClient, event: RawContractEvent) => Promise<void>> = {
  recycled: handleWasteRegistered,
  reg: handleParticipantRegistered,
  transfer: handleWasteTransferred,
  confirmed: handleWasteConfirmed,
  rewarded: handleTokensRewarded,
  deactive: handleWasteDeactivated,
  graded: handleWasteGraded,
  proc_upd: handleProcessingStatusChanged,
  contam: handleWasteContaminated,
  auc_cre: handleAuctionCreated,
  auc_end: handleAuctionEnded,
  carbon: handleCarbonCreditsEarned,
};

export async function dispatchEvent(client: PoolClient, event: RawContractEvent): Promise<void> {
  const handler = HANDLERS[event.eventType];
  if (handler) {
    await handler(client, event);
  }
}
