export type WasteType = 'Paper' | 'PetPlastic' | 'Plastic' | 'Metal' | 'Glass' | 'Organic' | 'Electronic';
export type ParticipantRole = 'Recycler' | 'Collector' | 'Manufacturer';
export type CertificationLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';

export const WASTE_TYPE_MAP: Record<number, WasteType> = {
  0: 'Paper', 1: 'PetPlastic', 2: 'Plastic', 3: 'Metal', 4: 'Glass', 5: 'Organic', 6: 'Electronic',
};

export const ROLE_MAP: Record<number, ParticipantRole> = {
  0: 'Recycler', 1: 'Collector', 2: 'Manufacturer',
};

export const CERT_MAP: Record<number, CertificationLevel> = {
  0: 'Beginner', 1: 'Intermediate', 2: 'Advanced', 3: 'Expert',
};

export interface RawContractEvent {
  ledgerSequence: number;
  ledgerCloseTime: Date;
  transactionHash: string;
  contractId: string;
  eventType: string;
  topic: string[];
  value: unknown;
}
