import { PoolClient } from 'pg';
import { RawContractEvent } from './types';
import { fetchEvents, getLatestLedger, StreamerConfig } from './stellar/streamer';
import { dispatchEvent } from './handlers/dispatcher';
import {
  getSyncStatus,
  updateSyncStatus,
  setSyncing,
  detectAndHandleReorg,
  storeRawEvent,
  withTransaction,
} from './sync/syncStatus';

const BATCH_SIZE = 200;

export async function processEvents(events: RawContractEvent[]): Promise<void> {
  if (events.length === 0) return;

  await withTransaction(async (client: PoolClient) => {
    const ledgerGroups = new Map<number, RawContractEvent[]>();
    for (const e of events) {
      const group = ledgerGroups.get(e.ledgerSequence) ?? [];
      group.push(e);
      ledgerGroups.set(e.ledgerSequence, group);
    }

    for (const [ledger, ledgerEvents] of ledgerGroups) {
      const incomingHashes = new Set(ledgerEvents.map(e => e.transactionHash));
      const reorged = await detectAndHandleReorg(client, ledger, incomingHashes);
      if (reorged) {
        console.warn(`[reorg] Detected at ledger ${ledger}, rolled back and re-processing`);
      }

      for (const event of ledgerEvents) {
        await storeRawEvent(client, event);
        await dispatchEvent(client, event);
      }

      const lastEvent = ledgerEvents[ledgerEvents.length - 1];
      await updateSyncStatus(client, ledger, lastEvent.ledgerCloseTime);
    }
  });
}

export async function runIndexer(config: StreamerConfig, pollIntervalMs = 5000): Promise<void> {
  await setSyncing(true);
  console.log('[indexer] Starting...');

  const run = async () => {
    try {
      const { lastLedger } = await getSyncStatus();
      const latestLedger = await getLatestLedger(config.rpcUrl);

      if (lastLedger >= latestLedger) return;

      const fromLedger = lastLedger === 0 ? config.startLedger : lastLedger + 1;
      const toLedger = Math.min(fromLedger + BATCH_SIZE - 1, latestLedger);

      console.log(`[indexer] Fetching ledgers ${fromLedger}–${toLedger}`);
      const events = await fetchEvents(config, fromLedger, toLedger);
      await processEvents(events);

      if (events.length === 0) {
        await withTransaction(async (client: PoolClient) => {
          await updateSyncStatus(client, toLedger, new Date());
        });
      }
    } catch (err) {
      console.error('[indexer] Error:', err);
    }
  };

  await run();
  const interval = setInterval(run, pollIntervalMs);

  process.on('SIGTERM', async () => {
    clearInterval(interval);
    await setSyncing(false);
    process.exit(0);
  });
}
