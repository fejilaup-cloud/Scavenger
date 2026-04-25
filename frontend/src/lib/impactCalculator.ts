import { WasteType } from '@/api/types'

// ── CO2 saved per kg of material recycled (kg CO2e / kg) ─────────────────────
// Sources: EPA, WRAP, European Environment Agency
const CO2_PER_KG: Record<WasteType, number> = {
  [WasteType.Paper]: 0.9,       // 0.9 kg CO2e saved per kg paper recycled
  [WasteType.PetPlastic]: 1.5,  // 1.5 kg CO2e saved per kg PET plastic
  [WasteType.Plastic]: 1.2,     // 1.2 kg CO2e saved per kg mixed plastic
  [WasteType.Metal]: 4.0,       // 4.0 kg CO2e saved per kg metal (aluminium-weighted)
  [WasteType.Glass]: 0.3,       // 0.3 kg CO2e saved per kg glass
}

// ── Energy saved per kg (kWh / kg) ───────────────────────────────────────────
const ENERGY_PER_KG: Record<WasteType, number> = {
  [WasteType.Paper]: 4.0,
  [WasteType.PetPlastic]: 5.8,
  [WasteType.Plastic]: 4.5,
  [WasteType.Metal]: 14.0,
  [WasteType.Glass]: 0.7,
}

// ── Water saved per kg (litres / kg) ─────────────────────────────────────────
const WATER_PER_KG: Record<WasteType, number> = {
  [WasteType.Paper]: 26.0,
  [WasteType.PetPlastic]: 17.0,
  [WasteType.Plastic]: 13.0,
  [WasteType.Metal]: 40.0,
  [WasteType.Glass]: 1.5,
}

// ── Trees saved per kg (1 tree absorbs ~21 kg CO2/year) ──────────────────────
const KG_CO2_PER_TREE_YEAR = 21

export interface WasteInput {
  waste_type: WasteType
  /** weight in grams */
  weight: bigint | number
}

export interface ImpactResult {
  co2Kg: number       // kg CO2 saved
  energyKwh: number   // kWh energy saved
  waterLitres: number // litres water saved
  treesEquivalent: number // tree-years equivalent
}

export function calculateImpact(wastes: WasteInput[]): ImpactResult {
  let co2Kg = 0
  let energyKwh = 0
  let waterLitres = 0

  for (const w of wastes) {
    const kg = Number(w.weight) / 1000
    co2Kg += kg * (CO2_PER_KG[w.waste_type] ?? 0)
    energyKwh += kg * (ENERGY_PER_KG[w.waste_type] ?? 0)
    waterLitres += kg * (WATER_PER_KG[w.waste_type] ?? 0)
  }

  return {
    co2Kg: round2(co2Kg),
    energyKwh: round2(energyKwh),
    waterLitres: round2(waterLitres),
    treesEquivalent: round2(co2Kg / KG_CO2_PER_TREE_YEAR),
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ── Everyday equivalents ──────────────────────────────────────────────────────

export interface Equivalents {
  carKm: number          // km not driven (0.21 kg CO2/km)
  smartphoneCharges: number // charges (0.005 kWh each)
  showerMinutes: number  // minutes of showering (8 litres/min)
  lightbulbHours: number // hours of 10W LED (0.01 kWh/h)
}

export function calculateEquivalents(impact: ImpactResult): Equivalents {
  return {
    carKm: round2(impact.co2Kg / 0.21),
    smartphoneCharges: Math.round(impact.energyKwh / 0.005),
    showerMinutes: Math.round(impact.waterLitres / 8),
    lightbulbHours: Math.round(impact.energyKwh / 0.01),
  }
}

// ── Social share text ─────────────────────────────────────────────────────────

export function buildShareText(impact: ImpactResult, equivalents: Equivalents): string {
  return (
    `♻️ My recycling saved ${impact.co2Kg} kg of CO₂ — ` +
    `equivalent to ${equivalents.carKm} km not driven, ` +
    `${impact.treesEquivalent} trees worth of absorption, ` +
    `and ${impact.waterLitres} litres of water! ` +
    `#Scavngr #Recycling #GreenImpact`
  )
}
