/**
 * The console's synthetic data, generated once from fixed seeds. Every page reads
 * from here, so the demo shows the same organisations, sites and call-outs on
 * every load. Nothing in it is real apart from town names and coordinates.
 */
import { createRng, seedFor } from '@/lib/rng'
import type {
  CallOut,
  Customer,
  Lead,
  LeadSite,
  OnboardingRecord,
  Partner,
  Responder,
  Site,
  Supplier,
} from '@/types'
import { DATA_AS_OF } from './asOf'
import { generateDatasets, generateOnboardingRecords } from './generate'
import {
  applyOnboardingIssues,
  applySeededIssues,
  SEEDED_ISSUES,
  SEEDED_ONBOARDING_ISSUES,
} from './issues'
import { generateLeadSites } from './leadSites'

export { DATA_AS_OF } from './asOf'
export { SEEDED_ISSUES, SEEDED_ONBOARDING_ISSUES } from './issues'
export * from './labels'
export { DEMO_NOTE, hadDemo } from './leads'
export { sectorFamily, sectorLabel, SECTOR_FAMILIES, SECTORS, type SectorFamilyId } from './sectors'
export { getTown, TOWNS } from './towns'

const data = applySeededIssues(generateDatasets(DATA_AS_OF), SEEDED_ISSUES)

export const customers: readonly Customer[] = data.customers
/** Every customer's sites in one list. */
export const sites: readonly Site[] = data.customers.flatMap((customer) => customer.sites)
export const responders: readonly Responder[] = data.responders
/** Working definition: see docs/brief.md. */
export const suppliers: readonly Supplier[] = data.suppliers
/** Working definition: see docs/brief.md. */
export const partners: readonly Partner[] = data.partners
export const callOuts: readonly CallOut[] = data.callOuts
export const leads: readonly Lead[] = data.leads
/** The sites each lead has shared, from a stream of their own so no other dataset moved. */
export const leadSites: readonly LeadSite[] = generateLeadSites({
  rng: createRng(seedFor('lead-sites')),
  leads: data.leads,
})

/** Every organisation's onboarding, with the problems planted in it. */
export const onboarding: readonly OnboardingRecord[] = applyOnboardingIssues(
  generateOnboardingRecords(data, DATA_AS_OF),
  SEEDED_ONBOARDING_ISSUES,
)
