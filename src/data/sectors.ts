import type { SectorId } from '@/types'

/** The nine target sectors listed on powersos.co.uk. */
export const SECTORS = [
  { id: 'medical', label: 'Medical' },
  { id: 'education', label: 'Education' },
  { id: 'hospitality', label: 'Hospitality' },
  { id: 'manufacturing', label: 'Manufacturing' },
  { id: 'aviation', label: 'Aviation' },
  { id: 'warehousing', label: 'Warehousing' },
  { id: 'agriculture', label: 'Agriculture' },
  { id: 'power', label: 'Power generation & distribution' },
  { id: 'telecoms', label: 'Telecoms & data centres' },
] as const satisfies readonly { id: SectorId; label: string }[]

export function sectorLabel(id: SectorId): string {
  const sector = SECTORS.find((s) => s.id === id)
  if (!sector) throw new Error(`Unknown sector: ${id}`)
  return sector.label
}

/**
 * Sectors grouped into three families for map colour. A map can only keep three
 * colours apart for every reader, colour-blind included; the sector filter shows
 * any one sector on its own.
 */
export const SECTOR_FAMILIES = [
  {
    id: 'critical',
    label: 'Critical services',
    sectors: ['medical', 'aviation', 'telecoms'],
  },
  {
    id: 'industry',
    label: 'Industry & energy',
    sectors: ['manufacturing', 'power', 'agriculture'],
  },
  {
    id: 'public',
    label: 'Public & commercial',
    sectors: ['education', 'hospitality', 'warehousing'],
  },
] as const satisfies readonly { id: string; label: string; sectors: readonly SectorId[] }[]

export type SectorFamilyId = (typeof SECTOR_FAMILIES)[number]['id']

export function sectorFamily(id: SectorId): SectorFamilyId {
  const family = SECTOR_FAMILIES.find((f) => (f.sectors as readonly SectorId[]).includes(id))
  if (!family) throw new Error(`Sector ${id} has no family`)
  return family.id
}
