import type { Rng } from '@/lib/rng'
import type { Criticality, Lead, LeadSite } from '@/types'
import { SECTOR_PROFILES, siteTowns } from './customers'
import { placeNear } from './helpers'
import { getTown, TOWNS } from './towns'

export interface LeadSiteOptions {
  rng: Rng
  leads: readonly Lead[]
}

/**
 * The sites each lead has shared with us: as many as it estimated, placed the way a
 * customer in the same sector places them. Regional organisations cluster around the
 * lead's town and national ones spread out. Lost leads keep the sites they shared.
 */
export function generateLeadSites({ rng, leads }: LeadSiteOptions): LeadSite[] {
  return leads.flatMap((lead) => {
    const profile = SECTOR_PROFILES[lead.sector]
    const towns = siteTowns(rng, getTown(lead.town), lead.estimatedSites, profile, TOWNS)
    return towns.map(
      (town, i): LeadSite => ({
        id: `${lead.id}-S${i + 1}`,
        leadId: lead.id,
        name: `${town.name} ${rng.pick(profile.siteKinds)}`,
        town: town.name,
        region: town.region,
        ...placeNear(rng, town),
        criticality: rng.int(...profile.criticality) as Criticality,
      }),
    )
  })
}
