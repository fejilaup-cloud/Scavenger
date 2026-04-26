import { rpc, xdr } from '@stellar/stellar-sdk';
import { RawContractEvent } from '../types';

export interface StreamerConfig {
  rpcUrl: string;
  contractId: string;
  startLedger: number;
}

function decodeScVal(val: xdr.ScVal): unknown {
  try {
    switch (val.switch()) {
      case xdr.ScValType.scvU32(): return val.u32();
      case xdr.ScValType.scvI32(): return val.i32();
      case xdr.ScValType.scvU64(): return val.u64().toString();
      case xdr.ScValType.scvI64(): return val.i64().toString();
      case xdr.ScValType.scvU128(): {
        const parts = val.u128();
        return (BigInt(parts.hi().toString()) * BigInt(2 ** 64) + BigInt(parts.lo().toString())).toString();
      }
      case xdr.ScValType.scvI128(): {
        const parts = val.i128();
        return (BigInt(parts.hi().toString()) * BigInt(2 ** 64) + BigInt(parts.lo().toString())).toString();
      }
      case xdr.ScValType.scvBool(): return val.b();
      case xdr.ScValType.scvSymbol(): return val.sym().toString();
      case xdr.ScValType.scvString(): return val.str().toString();
      case xdr.ScValType.scvAddress(): return val.address().toString();
      case xdr.ScValType.scvVec(): return val.vec()?.map(decodeScVal) ?? [];
      case xdr.ScValType.scvVoid(): return null;
      default: return val.toXDR('base64');
    }
  } catch {
    return null;
  }
}

export async function fetchEvents(
  config: StreamerConfig,
  fromLedger: number,
  _toLedger: number
): Promise<RawContractEvent[]> {
  const server = new rpc.Server(config.rpcUrl);
  const events: RawContractEvent[] = [];

  const response = await server.getEvents({
    startLedger: fromLedger,
    filters: [{ type: 'contract', contractIds: [config.contractId] }],
  });

  for (const event of response.events) {
    // In SDK v13, topic is xdr.ScVal[] and value is xdr.ScVal (already parsed)
    const topic = (event.topic as xdr.ScVal[]).map((t: xdr.ScVal) => String(decodeScVal(t) ?? ''));
    const eventType = topic[0] ?? 'unknown';
    const value = decodeScVal(event.value as xdr.ScVal);

    events.push({
      ledgerSequence: event.ledger,
      ledgerCloseTime: new Date(event.ledgerClosedAt),
      transactionHash: event.txHash,
      contractId: config.contractId,
      eventType,
      topic,
      value,
    });
  }

  return events;
}

export async function getLatestLedger(rpcUrl: string): Promise<number> {
  const server = new rpc.Server(rpcUrl);
  const info = await server.getLatestLedger();
  return info.sequence;
}
