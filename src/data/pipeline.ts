/**
 * How the pipeline is valued, worked out once from the data: each sector's
 * recommended tier at its own call-out rate (the pricing sandbox defaults), and what
 * a lead on the board is worth a year. The Pipeline page and the Overview share it,
 * so the weighted value is the same wherever it is shown.
 */
import { formatNumber } from '@/lib/format'
import { restoreBoardMoves, type BoardMoves, type BoardOptions } from '@/lib/pipeline'
import { annualMembership, recommendTier, type SectorTerms } from '@/lib/proposal'
import { DEFAULT_SCORES } from '@/lib/sectorScoring'
import type { SectorId } from '@/types'
import { PRICING_DEFAULTS, SECTOR_EVIDENCE } from './evidence'
import { DATA_AS_OF, hadDemo, leads, SECTORS } from './index'

/** Each sector's tier at its own call-out rate, at the pricing sandbox defaults. */
export const SECTOR_TERMS = Object.fromEntries(
  SECTORS.map(({ id, label }) => {
    const evidence = SECTOR_EVIDENCE[id]
    const measured = evidence.callOutsPerSiteYear
    const rate = measured ?? PRICING_DEFAULTS.callOutsPerSite
    const terms: SectorTerms = {
      recommendation: recommendTier(PRICING_DEFAULTS.tiers, rate, PRICING_DEFAULTS.payPerCallOut),
      downtimeScore: DEFAULT_SCORES[id].downtime,
      rateBasis:
        measured === null
          ? `the network average, as no ${label.toLowerCase()} site has a full year on record`
          : `the ${label.toLowerCase()} average across ${formatNumber(evidence.sites)} sites on record`,
    }
    return [id, terms]
  }),
) as Record<SectorId, SectorTerms>

/** A deal is worth its sector's recommended membership for every site the lead estimated. */
export const BOARD_OPTIONS: BoardOptions = {
  asOf: DATA_AS_OF,
  demoHeld: hadDemo,
  annualValue: (lead) =>
    annualMembership(SECTOR_TERMS[lead.sector].recommendation, lead.estimatedSites),
}

/** The board before any card is moved. */
export const NO_MOVES: BoardMoves = {}

const LEAD_IDS = new Set(leads.map((l) => l.id))

/** Saved card moves, keeping only those for leads that exist. */
export const restoreMoves = (raw: unknown): BoardMoves => restoreBoardMoves(raw, LEAD_IDS)
