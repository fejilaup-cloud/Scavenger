// Feature: Waste Marketplace (#429)
// Tests: filterListings, sortListings, makeOffer, respondToOffer, averageRating

import { describe, it, expect } from 'vitest'
import { WasteType } from '@/api/types'
import {
  filterListings,
  sortListings,
  makeOffer,
  respondToOffer,
  averageRating,
  type MarketplaceListing,
  type RatingEntry,
} from '../WasteMarketplacePage'

const listings: MarketplaceListing[] = [
  {
    id: 'l1',
    seller: 'GABC',
    wasteType: WasteType.Paper,
    weight: 100,
    pricePerKg: 0.5,
    description: 'clean paper',
    listedAt: 1000,
    rating: 4.0,
  },
  {
    id: 'l2',
    seller: 'GDEF',
    wasteType: WasteType.Metal,
    weight: 200,
    pricePerKg: 2.0,
    description: 'scrap metal',
    listedAt: 2000,
    rating: 3.0,
  },
  {
    id: 'l3',
    seller: 'GHIJ',
    wasteType: WasteType.Paper,
    weight: 50,
    pricePerKg: 1.0,
    description: 'newspaper',
    listedAt: 3000,
    rating: 5.0,
  },
]

describe('WasteMarketplacePage — filterListings', () => {
  it('returns all listings when no filter applied', () => {
    expect(filterListings(listings, '', 'all')).toHaveLength(3)
  })

  it('filters by waste type', () => {
    const result = filterListings(listings, '', WasteType.Paper)
    expect(result).toHaveLength(2)
    result.forEach((l) => expect(l.wasteType).toBe(WasteType.Paper))
  })

  it('filters by query matching description', () => {
    const result = filterListings(listings, 'metal', 'all')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('l2')
  })

  it('filters by query matching seller', () => {
    const result = filterListings(listings, 'GABC', 'all')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('l1')
  })

  it('returns empty array when nothing matches', () => {
    expect(filterListings(listings, 'zzznomatch', 'all')).toHaveLength(0)
  })

  it('combines type and query filters', () => {
    const result = filterListings(listings, 'newspaper', WasteType.Paper)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('l3')
  })
})

describe('WasteMarketplacePage — sortListings', () => {
  it('sorts by price ascending', () => {
    const result = sortListings(listings, 'price_asc')
    expect(result[0].pricePerKg).toBeLessThanOrEqual(result[1].pricePerKg)
    expect(result[1].pricePerKg).toBeLessThanOrEqual(result[2].pricePerKg)
  })

  it('sorts by price descending', () => {
    const result = sortListings(listings, 'price_desc')
    expect(result[0].pricePerKg).toBeGreaterThanOrEqual(result[1].pricePerKg)
  })

  it('sorts by weight descending', () => {
    const result = sortListings(listings, 'weight')
    expect(result[0].weight).toBeGreaterThanOrEqual(result[1].weight)
  })

  it('sorts by rating descending', () => {
    const result = sortListings(listings, 'rating')
    expect(result[0].rating).toBeGreaterThanOrEqual(result[1].rating)
  })

  it('does not mutate original array', () => {
    const original = [...listings]
    sortListings(listings, 'price_desc')
    expect(listings).toEqual(original)
  })
})

describe('WasteMarketplacePage — makeOffer', () => {
  it('creates a pending offer with correct fields', () => {
    const offer = makeOffer(listings[0], 'GBUYER', 45)
    expect(offer.listingId).toBe('l1')
    expect(offer.buyer).toBe('GBUYER')
    expect(offer.offerPrice).toBe(45)
    expect(offer.status).toBe('pending')
    expect(offer.id).toBeTruthy()
  })

  it('generates unique ids for different offers', () => {
    const o1 = makeOffer(listings[0], 'GBUYER', 10)
    const o2 = makeOffer(listings[0], 'GBUYER', 10)
    expect(o1.id).not.toBe(o2.id)
  })
})

describe('WasteMarketplacePage — respondToOffer', () => {
  it('accepts an offer', () => {
    const offer = makeOffer(listings[0], 'GBUYER', 50)
    const updated = respondToOffer(offer, 'accepted')
    expect(updated.status).toBe('accepted')
  })

  it('rejects an offer', () => {
    const offer = makeOffer(listings[0], 'GBUYER', 50)
    const updated = respondToOffer(offer, 'rejected')
    expect(updated.status).toBe('rejected')
  })

  it('does not mutate original offer', () => {
    const offer = makeOffer(listings[0], 'GBUYER', 50)
    respondToOffer(offer, 'accepted')
    expect(offer.status).toBe('pending')
  })
})

describe('WasteMarketplacePage — averageRating', () => {
  const ratings: RatingEntry[] = [
    { listingId: 'l1', rater: 'G1', score: 4, comment: '' },
    { listingId: 'l1', rater: 'G2', score: 2, comment: '' },
    { listingId: 'l2', rater: 'G3', score: 5, comment: '' },
  ]

  it('calculates average for a listing', () => {
    expect(averageRating(ratings, 'l1')).toBe(3)
  })

  it('returns 0 for listing with no ratings', () => {
    expect(averageRating(ratings, 'l99')).toBe(0)
  })

  it('returns single rating when only one entry', () => {
    expect(averageRating(ratings, 'l2')).toBe(5)
  })
})
