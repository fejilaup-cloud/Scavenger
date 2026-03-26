export enum Role {
  Recycler = 'Recycler',
  Collector = 'Collector',
  Manufacturer = 'Manufacturer'
}

export enum WasteType {
  Paper = 0,
  PetPlastic = 1,
  Plastic = 2,
  Metal = 3,
  Glass = 4
}

export interface Participant {
  address: string
  role: Role
  name: string
  latitude: number
  longitude: number
  registered_at: number
}

export interface Incentive {
  id: number
  rewarder: string
  waste_type: WasteType
  reward_points: number
  total_budget: number
  remaining_budget: number
  active: boolean
  created_at: number
}

export interface Material {
  id: number
  waste_type: WasteType
  weight: number
  submitter: string
  current_owner: string
  submitted_at: number
  verified: boolean
  is_active: boolean
  is_confirmed: boolean
  confirmer: string
}

export interface Waste {
  waste_id: bigint
  waste_type: WasteType
  weight: bigint
  current_owner: string
  latitude: bigint
  longitude: bigint
  recycled_timestamp: number
  is_active: boolean
  is_confirmed: boolean
  confirmer: string
}

export interface WasteTransfer {
  waste_id: number
  from: string
  to: string
  transferred_at: number
}

export interface ParticipantStats {
  address: string
  total_earned: bigint
  materials_submitted: number
  transfers_count: number
}

export interface GlobalMetrics {
  total_wastes_count: number
  total_tokens_earned: bigint
}

export class ContractError extends Error {
  constructor(
    message: string,
    public code?: number
  ) {
    super(message)
    this.name = 'ContractError'
  }
}
