import React from 'react'
import '@testing-library/jest-dom'

// Stub Leaflet (requires DOM APIs not available in jsdom)
vi.mock('leaflet', () => ({
  default: {
    divIcon: vi.fn(() => ({})),
    Icon: { Default: { prototype: {}, mergeOptions: vi.fn() } },
    latLngBounds: vi.fn(() => ({ isValid: () => true })),
  },
  divIcon: vi.fn(() => ({})),
}))

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => null,
  Marker: ({ children }: { children: React.ReactNode }) => <div data-testid="marker">{children}</div>,
  Popup: ({ children }: { children: React.ReactNode }) => <div data-testid="popup">{children}</div>,
  useMap: () => ({ setView: vi.fn(), fitBounds: vi.fn() }),
}))

vi.mock('react-leaflet-markercluster', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="cluster">{children}</div>,
}))

vi.mock('leaflet/dist/leaflet.css', () => ({}))
vi.mock('leaflet.markercluster/dist/MarkerCluster.css', () => ({}))
vi.mock('leaflet.markercluster/dist/MarkerCluster.Default.css', () => ({}))
